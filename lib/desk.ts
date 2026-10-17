import type { Action, AuditEvent, DeskSnapshot, DeskState, Order, Policy, MarketMode, WorkspaceMode, SymbolCode, Evidence, Check } from './types';
import { assertDemoStarted, assertWorkspaceAction, createDemoState, workspaceMarketMode, workspaceState, workspaceStorageKey } from './demo-workspace';
import { getMarketData } from './market-data';
import { getHistoricalStrategy } from './strategies';
import { EVIDENCE, seededState } from './fixtures';
import { approvalRequired, applyFill, canonicalSample, evaluateOrder, fingerprintOrder, fingerprintQueuedOrder, toolPermission } from './permissions';
import { connections, prismCheck, runResearch, syncSources, testConnections, traceEvent, type IntegrationConfig } from './integrations';
import { readState, saveState, listQueuedWorkspaceKeys } from '../db/store';
import { z } from 'zod';

const policySchema=z.object({maxOrderValue:z.number().finite().min(100).max(100000),maxPositionWeight:z.number().finite().min(.01).max(1),approvalAbove:z.number().finite().min(0).max(100000),allowedSymbols:z.array(z.enum(['NVDA','MSFT','AAPL','GOOGL','AMZN','META'])).min(1).max(6),maxQuoteAgeSeconds:z.number().int().min(1).max(300),maxEvidenceAgeDays:z.number().int().min(1).max(365),requireApproval:z.boolean()}).partial().strict();
export const actionSchema=z.object({action:z.enum(['research','strategy_research','propose','approve','queue','process_queue','execute','reject','policy','scenario','test_connections','sync_sources','reset','start_demo','demo_sample']),symbol:z.string().max(8).optional(),strategyId:z.enum(['buy-and-hold','sma-20-50','momentum-20']).optional(),asOf:z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional(),prompt:z.string().max(2000).optional(),researchId:z.string().max(100).optional(),quantity:z.number().finite().optional(),side:z.enum(['buy','sell']).optional(),orderId:z.string().max(100).optional(),policy:policySchema.optional(),scenario:z.enum(['oversize','unauthorized','stale','tamper','unsupported']).optional(),marketMode:z.literal('yahoo').optional(),workspace:z.enum(['desk','demo']).optional()}).strict();

function audit(state:DeskState,agent:string,tool:string,decision:AuditEvent['decision'],message:string,traceId=crypto.randomUUID(),orderId?:string,details?:Record<string,unknown>){
  const event:AuditEvent={id:crypto.randomUUID(),time:new Date().toISOString(),agent,tool,decision,message,traceId,orderId,details};
  state.audit.unshift(event);return event;
}
function demand(actor:string,tool:string){const check=toolPermission(actor,tool);if(!check.passed)throw new Error(check.reason);return check;}
function allEvidence(state:DeskState):Evidence[]{return [...EVIDENCE,...(state.evidence??[])];}
function reasons(order:Order){return order.checks.filter(check=>!check.passed).map(check=>check.reason).join('; ');}
async function currentHistoryCheck(order:Order,state:DeskState):Promise<Check[]>{
  const report=state.research.find(item=>item.id===order.researchId);
  if(report?.mode!=='strategy'||!report.history)return [];
  try{
    const current=await getHistoricalStrategy(order.symbol as SymbolCode,report.history.strategyId as 'buy-and-hold'|'sma-20-50'|'momentum-20');
    const passed=report.history.asOf===current.latestAvailableDate&&current.asOf===current.latestAvailableDate;
    return [{key:'latest_strategy_session',label:'Latest completed strategy session',passed,reason:passed?`Yahoo confirms ${current.latestAvailableDate} is the latest completed session`:`This note ends ${report.history.asOf}; Yahoo now has ${current.latestAvailableDate}. Generate a current strategy note before trading.`}];
  }catch{return [{key:'latest_strategy_session',label:'Latest completed strategy session',passed:false,reason:'Yahoo historical data could not be refreshed to validate this strategy. No execution is authorized.'}];}
}
export async function snapshot(userId:string,config:IntegrationConfig,marketMode:MarketMode='yahoo',workspace:WorkspaceMode='desk'):Promise<DeskSnapshot>{
  workspaceMarketMode(workspace,marketMode);
  const storageKey=await workspaceStorageKey(userId,workspace);
  const [stored,data]=await Promise.all([readState(storageKey),getMarketData('yahoo')]);
  const state=workspaceState(stored,workspace);
  return {state,...data,evidence:allEvidence(state),connections:connections(config),workspace};
}

export type QueueResult={workspaces:number;processed:number;executed:number;waiting:number;review:number;expired:number;conflicts:number;errors:number};
function emptyQueueResult():QueueResult{return {workspaces:0,processed:0,executed:0,waiting:0,review:0,expired:0,conflicts:0,errors:0};}

/** Only already-consented queued orders are eligible. No GET endpoint invokes this. */
async function processStoredQueue(storageKey:string,config:IntegrationConfig,limit=5):Promise<QueueResult>{
  const result=emptyQueueResult();
  const state=await readState(storageKey),expected=state.version;
  const queued=state.orders.filter(order=>order.status==='queued').sort((a,b)=>Date.parse(a.queue?.lastCheckedAt??a.queue?.queuedAt??a.createdAt)-Date.parse(b.queue?.lastCheckedAt??b.queue?.queuedAt??b.createdAt)).slice(0,Math.min(5,limit));
  if(!queued.length)return result;
  result.workspaces=1;
  const {market}=await getMarketData('yahoo');
  let changed=false;
  for(const order of queued){
    result.processed++;
    const now=Date.now(),traceId=crypto.randomUUID(),grant=order.queue;
    if(grant){grant.lastCheckedAt=new Date(now).toISOString();changed=true;}
    const stop=(status:'review'|'expired',reason:string)=>{
      order.status=status;order.reviewReason=reason;delete order.approval;delete order.queue;changed=true;result[status]++;
      audit(state,'execution-agent','orders.queue.review',status==='review'?'review':'blocked',reason,traceId,order.id,{executionAttempted:false,ledgerBefore:state.portfolioVersion,ledgerAfter:state.portfolioVersion});
    };
    if(!grant||order.marketMode!=='yahoo'||grant.policyVersion!==state.policy.version||grant.maxPriceDriftPercent!==1||grant.fingerprint!==await fingerprintQueuedOrder(order,state)){
      stop('review','Queue authorization changed or no longer matches the mandate. Review and explicitly queue the order again.');continue;
    }
    if(!Number.isFinite(Date.parse(grant.expiresAt))||now>=Date.parse(grant.expiresAt)){
      stop('expired','The seven-day queue authorization expired without a fill. Create or review a new proposal.');continue;
    }
    const quote=market.find(item=>item.symbol===order.symbol);
    const quoteTime=quote?Date.parse(quote.timestamp):NaN;
    // Closed, missing, cached/pre-queue, delayed or unavailable observations never become fills.
    if(!quote||quote.source!=='yahoo'||quote.marketState!=='open'||quote.stale||!Number.isFinite(quoteTime)||quoteTime<Date.parse(grant.queuedAt)||now-quoteTime>state.policy.maxQuoteAgeSeconds*1000||quoteTime>now+2000){result.waiting++;continue;}
    const ledgerBefore=state.portfolioVersion;
    order.checks=[demand('execution-agent','orders.execute'),...evaluateOrder(order,state,market,allEvidence(state),now),...await currentHistoryCheck(order,state)];
    if(!order.checks.every(check=>check.passed)){stop('review',reasons(order));continue;}
    const external=await prismCheck(config,{action:'execute_paper_order',mode:'paper',symbol:order.symbol,side:order.side,quantity:order.quantity,permission:'queued_exact_order',marketMode:'yahoo',quoteTimestamp:quote.timestamp,queuedAt:grant.queuedAt},traceId);
    if(connections(config).prism.enforce)order.checks.push({key:'prism',label:'PRISM enforcement',passed:external.allowed,reason:external.status});
    if(!order.checks.every(check=>check.passed)){stop('review',reasons(order));continue;}
    // Guardrail latency cannot turn an old observation into an executable quote.
    const finalHistoryChecks=await currentHistoryCheck(order,state);
    const finalMarket=(await getMarketData('yahoo')).market,finalQuote=finalMarket.find(item=>item.symbol===order.symbol),fillTime=Date.now();
    if(fillTime>=Date.parse(grant.expiresAt)){stop('expired','Queue authorization expired while checking execution permissions.');continue;}
    if(!finalQuote||finalQuote.marketState!=='open'||finalQuote.stale||Date.parse(finalQuote.timestamp)<Date.parse(grant.queuedAt)||fillTime-Date.parse(finalQuote.timestamp)>state.policy.maxQuoteAgeSeconds*1000){result.waiting++;continue;}
    const finalChecks=[...evaluateOrder(order,state,finalMarket,allEvidence(state),fillTime),...finalHistoryChecks];
    if(!finalChecks.every(check=>check.passed)){order.checks=finalChecks;stop('review',reasons(order));continue;}
    order.checks=[...finalChecks,...order.checks.filter(check=>check.key==='prism')];
    applyFill(state,order,finalQuote,fillTime);changed=true;result.executed++;
    audit(state,'execution-agent','orders.execute','allowed',`${order.side.toUpperCase()} ${order.quantity} ${order.symbol} queued paper order filled at Yahoo $${finalQuote.price.toFixed(2)}.`,traceId,order.id,{marketMode:'yahoo',quoteTimestamp:finalQuote.timestamp,queuedAt:grant.queuedAt,queueFingerprint:grant.fingerprint,ledgerBefore,ledgerAfter:state.portfolioVersion,mode:'paper'});
  }
  if(changed){
    try{await saveState(storageKey,state,expected);}catch(error){
      if(error instanceof Error&&/Workspace changed/.test(error.message))return {...emptyQueueResult(),workspaces:1,processed:result.processed,conflicts:1};
      throw error;
    }
  }
  return result;
}
export async function processQueuedOrders(userId:string,config:IntegrationConfig,workspace:WorkspaceMode='desk'):Promise<QueueResult>{return processStoredQueue(await workspaceStorageKey(userId,workspace),config);}
/** Trusted owner-private runner only; storage keys are never accepted from an HTTP payload. */
export async function processAllQueuedOrders(config:IntegrationConfig):Promise<QueueResult>{
  const total=emptyQueueResult();
  for(const key of await listQueuedWorkspaceKeys(20)){
    if(total.processed>=5)break;
    try{const result=await processStoredQueue(key,config,5-total.processed);for(const field of Object.keys(total) as (keyof QueueResult)[])total[field]+=result[field];}
    catch{total.errors++;}
  }
  return total;
}

export async function act(userId:string,config:IntegrationConfig,input:Action):Promise<{snapshot:DeskSnapshot;message:string}>{
  const body=actionSchema.parse(input),workspace=body.workspace??'desk';
  assertWorkspaceAction(body.action,workspace);
  const marketMode=workspaceMarketMode(workspace,body.marketMode),storageKey=await workspaceStorageKey(userId,workspace);
  let state=workspaceState(await readState(storageKey),workspace);const expected=state.version;
  assertDemoStarted(body.action,workspace,state);
  let message='Updated.';let event:AuditEvent|undefined;const traceId=crypto.randomUUID();
  if(body.action==='process_queue'){
    const result=await processQueuedOrders(userId,config,workspace);
    return {snapshot:await snapshot(userId,config,marketMode,workspace),message:result.executed?`${result.executed} queued paper order${result.executed===1?'':'s'} filled using fresh Yahoo prices.`:result.review||result.expired?'Queue checked. Some orders need review or expired.':'Queue checked. Waiting for an eligible fresh Yahoo regular-session quote.'};
  }
  if(body.action==='start_demo'){
    demand('human-reviewer','mandate.update');state=createDemoState(Date.now(),true);
    event=audit(state,'human-reviewer','workspace.demo.start','allowed','Started an isolated Yahoo-powered paper workspace with $250,000 virtual cash and no holdings or orders.',traceId,undefined,{workspace:'demo',marketMode:'yahoo'});
    message='Guided workspace started. Every price and strategy observation comes from Yahoo.';
  }
  if(body.action==='strategy_research'||body.action==='demo_sample'){
    demand('research-agent','research.retrieve');demand('research-agent','research.compose');
    const symbol=(body.action==='demo_sample'?'MSFT':body.symbol??'NVDA') as SymbolCode;
    const result=await getHistoricalStrategy(symbol,body.strategyId??'sma-20-50',body.asOf);
    state.evidence??=[];state.evidence=state.evidence.filter(source=>source.id!==result.evidence.id);state.evidence.push(result.evidence);
    const research={id:crypto.randomUUID(),symbol,title:`${symbol} · ${result.strategy.name} through ${result.asOf}`,summary:result.evidence.text,claims:[{text:result.evidence.text,evidenceIds:[result.evidence.id],supported:true}],risks:['Historical backtests do not predict future returns.','The historical model assumes 10 basis points per entry or exit; actual spread, slippage, taxes and execution outcomes can differ.','Any paper fill requires a fresh Yahoo regular-session quote and a separate approval.'],evidenceIds:[result.evidence.id],score:100,createdAt:new Date().toISOString(),mode:'strategy' as const,model:'Deterministic Yahoo history analysis',history:{provider:'yahoo' as const,asOf:result.asOf,latestAvailableDate:result.latestAvailableDate,strategyId:result.strategy.id,generatedAt:new Date().toISOString(),evidenceId:result.evidence.id},recommendation:{side:'buy' as const,signal:result.signal.side,quantity:result.signal.side==='buy'?1:0,rationale:`Historical signal: ${result.signal.side}. ${result.signal.explanation} Share count is a reviewable proposal, not an automatic instruction.`},traceId};
    state.research.unshift(research);event=audit(state,'research-agent','research.strategy','allowed',`Calculated ${result.strategy.name} from Yahoo history through ${result.asOf}.`,traceId,undefined,{researchId:research.id,evidenceId:result.evidence.id,asOf:result.asOf,latestAvailableDate:result.latestAvailableDate});
    message=result.asOf===result.latestAvailableDate?'Yahoo historical strategy added. Review its source and propose an order separately.':'Historical inspection saved. Earlier as-of research cannot authorize a current paper order.';
  }
  if(body.action==='research'){
    const symbol=body.symbol??'NVDA';
    if(!EVIDENCE.some(source=>source.symbol===symbol))throw new Error('Historical issuer evidence is available for NVDA, MSFT and AAPL. Use Yahoo strategy research for other securities.');
    demand('research-agent','research.retrieve');demand('research-agent','research.compose');
    const result=await runResearch(config,symbol,body.prompt??'Review the historical disclosures. Clearly state their dates and do not claim they are current.',EVIDENCE,traceId);
    state.research.unshift(result.research);state.integration.prismLastStatus=result.telemetry;state.integration.prismLastTraceId=traceId;
    event=audit(state,'research-agent','research.compose','allowed',`Historical disclosure research with ${result.research.claims.length} cited claims. Current order evidence-age rules still apply.`,traceId,undefined,{mode:result.research.mode,model:result.research.model});
    message='Historical issuer research created. Use a current Yahoo strategy note for current-market proposals.';
  }
  if(body.action==='propose'){
    demand('portfolio-agent','orders.propose');
    const research=state.research.find(report=>report.id===body.researchId);if(!research)throw new Error('Select a research note before proposing an order.');
    const {market}=await getMarketData('yahoo'),quote=market.find(item=>item.symbol===research.symbol);if(!quote)throw new Error('Yahoo price is unavailable for this security. Retry after the source recovers.');
    const quantity=body.quantity??research.recommendation.quantity;
    const order:Order={id:crypto.randomUUID(),researchId:research.id,symbol:research.symbol,side:body.side??research.recommendation.side,quantity,price:quote.price,notional:Math.round(quantity*quote.price*100)/100,status:'review',checks:[],evidenceIds:[...research.evidenceIds],createdAt:new Date().toISOString(),traceId,fingerprint:'',marketMode:'yahoo',quoteTimestamp:quote.timestamp};
    order.checks=[toolPermission('portfolio-agent','orders.propose'),...evaluateOrder(order,state,market,allEvidence(state),Date.now(),'reference'),...await currentHistoryCheck(order,state)];
    const external=await prismCheck(config,{action:'propose_order',mode:'paper',symbol:order.symbol,side:order.side,quantity,notional:order.notional,permission:'pending',...(order.checks.some(check=>!check.passed)?{risk:'MANDATE_BLOCK'}:{}),marketMode:'yahoo',quoteTimestamp:quote.timestamp},traceId);
    if(connections(config).prism.enforce)order.checks.push({key:'prism',label:'PRISM enforcement',passed:external.allowed,reason:external.status});
    order.status=order.checks.every(check=>check.passed)?'review':'blocked';order.fingerprint=await fingerprintOrder(order,state);state.orders.unshift(order);
    event=audit(state,'portfolio-agent','orders.propose',order.status==='blocked'?'blocked':'review',order.status==='blocked'?reasons(order):'Yahoo reference-price proposal is ready for human review. No fill occurred.',traceId,order.id,{marketMode:'yahoo',quoteTimestamp:quote.timestamp,marketState:quote.marketState,executionAttempted:false});
    message=order.status==='blocked'?'Proposal blocked. Inspect the failed checks.':quote.marketState==='closed'?'Proposal uses the latest Yahoo close. Approve and explicitly queue it for the next eligible session.':'Proposal is ready for human approval.';
  }
  if(['approve','queue','execute','reject'].includes(body.action)){
    const order=state.orders.find(item=>item.id===body.orderId);if(!order)throw new Error('Order not found.');
    if(order.marketMode!=='yahoo')throw new Error('Synthetic orders are retired. Create a Yahoo-based proposal.');
    if(order.status==='executed')throw new Error('This order already executed. Duplicate execution was prevented.');
    if(order.status==='rejected'||order.status==='expired')throw new Error('This order is closed. Create a new proposal.');
    if(body.action==='reject'){
      demand('human-reviewer','orders.reject');order.status='rejected';delete order.approval;delete order.queue;
      event=audit(state,'human-reviewer','orders.reject','allowed','Reviewer cancelled the order and any queued execution authorization. No fill occurred.',traceId,order.id);message='Order cancelled.';
    }else if(body.action==='approve'){
      demand('human-reviewer','orders.approve');if(order.status==='blocked'||order.status==='queued')throw new Error('This order cannot be approved in its current state. Cancel or create a new proposal.');
      const {market}=await getMarketData('yahoo');order.checks=[...evaluateOrder(order,state,market,allEvidence(state),Date.now(),'reference'),...await currentHistoryCheck(order,state)];
      if(!order.checks.every(check=>check.passed)){order.status='blocked';message='Approval stopped because current mandate checks fail.';event=audit(state,'human-reviewer','orders.approve','blocked',reasons(order),traceId,order.id);}
      else{order.fingerprint=await fingerprintOrder(order,state);order.approval={fingerprint:order.fingerprint,portfolioVersion:state.portfolioVersion,policyVersion:state.policy.version,approvedAt:new Date().toISOString()};order.status='approved';delete order.reviewReason;event=audit(state,'human-reviewer','orders.approve','allowed','Approval bound to this exact order, portfolio revision and mandate version. Queue execution requires separate consent.',traceId,order.id,{fingerprint:order.fingerprint});message='Order approved. Execute with a fresh open-session quote, or explicitly authorize queued execution.';}
    }else if(body.action==='queue'){
      demand('human-reviewer','orders.queue');
      const fingerprint=await fingerprintOrder(order,state);
      const approved=order.status==='approved'&&order.approval?.fingerprint===fingerprint&&order.approval.policyVersion===state.policy.version&&order.approval.portfolioVersion===state.portfolioVersion&&Date.now()-Date.parse(order.approval.approvedAt)<=300000;
      if(!approved)throw new Error('Review and approve this exact order before authorizing queued execution.');
      const {market}=await getMarketData('yahoo');order.checks=[...evaluateOrder(order,state,market,allEvidence(state),Date.now(),'reference'),...await currentHistoryCheck(order,state)];
      if(!order.checks.every(check=>check.passed))throw new Error(`Queue authorization stopped: ${reasons(order)}`);
      const now=Date.now();order.queue={fingerprint:'',policyVersion:state.policy.version,queuedAt:new Date(now).toISOString(),expiresAt:new Date(now+7*86400000).toISOString(),maxPriceDriftPercent:1};order.queue.fingerprint=await fingerprintQueuedOrder(order,state);order.status='queued';delete order.reviewReason;
      event=audit(state,'human-reviewer','orders.queue','allowed','Explicitly authorized unattended paper execution for seven days, within 1% of the approved reference price. Fresh Yahoo session, portfolio risk and PRISM checks must pass again.',traceId,order.id,{...order.queue,referencePrice:order.price,marketMode:'yahoo',executionAttempted:false});
      message='Paper order queued. It can fill at the next eligible fresh Yahoo regular-session quote within 1% of this reference price, for up to seven days.';
    }else{
      if(order.status==='queued')throw new Error('This order is already queued. Check the queue or cancel its authorization.');
      const capability=demand('execution-agent','orders.execute'),ledgerBefore=state.portfolioVersion;
      const {market}=await getMarketData('yahoo'),quote=market.find(item=>item.symbol===order.symbol);
      if(quote?.marketState==='closed')throw new Error('The market is closed. Explicitly queue this approved order to authorize a later paper fill.');
      order.checks=[capability,...evaluateOrder(order,state,market,allEvidence(state))];
      const fingerprint=await fingerprintOrder(order,state),executionPrice=quote?.price??Infinity;
      const bound=order.status==='approved'&&fingerprint===order.fingerprint&&(!approvalRequired(order,state,executionPrice)||(order.approval?.fingerprint===fingerprint&&order.approval.portfolioVersion===state.portfolioVersion&&order.approval.policyVersion===state.policy.version&&Date.now()-Date.parse(order.approval.approvedAt)<=300000));
      order.checks.push({key:'approval',label:'Exact-order authorization',passed:bound,reason:bound?'Exact order, mandate and portfolio match the authorization':'Approval is missing or stale. Review the exact order again.'});
      const external=await prismCheck(config,{action:'execute_paper_order',mode:'paper',symbol:order.symbol,side:order.side,quantity:order.quantity,permission:bound?'approved':'pending',marketMode:'yahoo'},traceId);
      if(connections(config).prism.enforce)order.checks.push({key:'prism',label:'PRISM enforcement',passed:external.allowed,reason:external.status});
      const finalHistoryChecks=await currentHistoryCheck(order,state);
      const finalMarket=(await getMarketData('yahoo')).market,finalQuote=finalMarket.find(item=>item.symbol===order.symbol),fillTime=Date.now();
      const finalApproval=bound&&(!approvalRequired(order,state,finalQuote?.price??Infinity)||(!!order.approval&&fillTime-Date.parse(order.approval.approvedAt)<=300000));
      order.checks=[...order.checks.filter(check=>['capability','prism'].includes(check.key)),{key:'approval',label:'Exact-order authorization',passed:finalApproval,reason:finalApproval?'Authorization is still current at execution':'Approval expired during permission checks. Review the exact order again.'},...evaluateOrder(order,state,finalMarket,allEvidence(state),fillTime),...finalHistoryChecks];
      if(order.checks.every(check=>check.passed)){
        applyFill(state,order,finalQuote!,fillTime);event=audit(state,'execution-agent','orders.execute','allowed',`${order.side.toUpperCase()} ${order.quantity} ${order.symbol} filled at Yahoo $${order.fill!.price.toFixed(2)} in the paper ledger.`,traceId,order.id,{fingerprint,ledgerBefore,ledgerAfter:state.portfolioVersion,mode:'paper',marketMode:'yahoo',quoteTimestamp:finalQuote?.timestamp});message='Paper order filled from a fresh Yahoo observation.';
      }else{order.status='blocked';delete order.approval;event=audit(state,'execution-agent','orders.execute','blocked',reasons(order),traceId,order.id,{ledgerBefore,ledgerAfter:state.portfolioVersion,executionAttempted:false,blockHonored:true});message='Execution blocked. The paper ledger is unchanged.';}
    }
  }
  if(body.action==='policy'){
    demand('human-reviewer','mandate.update');const change=policySchema.parse(body.policy??{});if(!Object.keys(change).length)throw new Error('No mandate changes supplied.');
    state.policy={...state.policy,...change,version:state.policy.version+1} as Policy;
    for(const order of state.orders)if(order.status==='approved'||order.status==='queued'){order.status='review';delete order.approval;delete order.queue;order.reviewReason='Mandate changed. Review and explicitly authorize again.';}
    event=audit(state,'human-reviewer','mandate.update','allowed',`Mandate updated to version ${state.policy.version}. Existing approvals and queues require review.`,traceId);message='Mandate saved. Previous approvals and queue authorizations were invalidated.';
  }
  if(body.action==='scenario'){
    const scenario=body.scenario??'oversize',research=canonicalSample('NVDA',EVIDENCE,traceId);state.research.unshift(research);
    const {market}=await getMarketData('yahoo'),quote=market.find(item=>item.symbol==='NVDA');if(!quote)throw new Error('Yahoo price is unavailable. A failure check cannot use an invented quote.');
    const order:Order={id:crypto.randomUUID(),researchId:research.id,symbol:'NVDA',side:'buy',quantity:scenario==='oversize'?Math.ceil(state.policy.maxOrderValue/quote.price)+10:5,price:quote.price,notional:0,status:'blocked',checks:[],evidenceIds:[...research.evidenceIds],createdAt:new Date().toISOString(),traceId,fingerprint:'',scenario,marketMode:'yahoo',quoteTimestamp:quote.timestamp};
    order.notional=Math.round(order.quantity*order.price*100)/100;order.fingerprint=await fingerprintOrder(order,state);order.checks=[toolPermission(scenario==='unauthorized'?'research-agent':'execution-agent','orders.execute'),...evaluateOrder(order,state,market,allEvidence(state))];
    order.checks.push({key:'scenario',label:'Deliberate denied request',passed:false,reason:`${scenario} is an explicit denied permission check; it never executes.`});
    const external=await prismCheck(config,{action:'execute_paper_order',scenario,mode:'paper',symbol:order.symbol,quantity:order.quantity,permission:'denied',risk:'MANDATE_BLOCK',marketMode:'yahoo'},traceId);
    if(connections(config).prism.enforce)order.checks.push({key:'prism',label:'PRISM enforcement',passed:external.allowed,reason:external.status});state.orders.unshift(order);
    event=audit(state,'execution-agent','orders.execute','blocked',`Permission check: ${scenario}. ${reasons(order)}`,traceId,order.id,{scenario,executionAttempted:false,blockHonored:true,ledgerBefore:state.portfolioVersion,ledgerAfter:state.portfolioVersion,prism:external.status});message='Denied request recorded against a real Yahoo reference. No paper fill occurred.';
  }
  if(body.action==='test_connections'){
    const status=await testConnections(config);state.integration.prismLastStatus=status.prism;event=audit(state,'system','connections.test','allowed',`Nicrron: ${status.nicrron}. PRISM: ${status.prism}.`,traceId);message=`Nicrron: ${status.nicrron}. PRISM: ${status.prism}.`;
  }
  if(body.action==='sync_sources'){message=await syncSources(config,EVIDENCE);state.integration.knowledgeBaseSynced=true;event=audit(state,'research-agent','research.retrieve','allowed','Historical issuer documents uploaded to PRISM knowledge base.',traceId);}
  if(body.action==='reset'){
    state=workspace==='demo'?createDemoState(Date.now(),true):seededState();event=audit(state,'human-reviewer','workspace.reset','allowed','Reset this paper workspace to $250,000 virtual cash, zero positions and no pending orders.',traceId);message='Paper workspace reset. Yahoo remains the only price source.';
  }
  await saveState(storageKey,state,expected);
  if(event&&body.action!=='research'&&body.action!=='test_connections'){
    const status=await traceEvent(config,event),fresh=await readState(storageKey);fresh.integration.prismLastStatus=status;fresh.integration.prismLastTraceId=event.traceId;
    try{await saveState(storageKey,fresh,fresh.version);}catch{/* The committed ledger outcome wins over telemetry. */}
  }
  return {snapshot:await snapshot(userId,config,marketMode,workspace),message};
}
