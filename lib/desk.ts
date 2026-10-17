import type { Action, AuditEvent, DeskSnapshot, DeskState, Order, Policy } from './types';
import { EVIDENCE, marketSnapshot, seededState } from './fixtures';
import { approvalRequired, applyFill, canonicalSample, evaluateOrder, fingerprintOrder, toolPermission } from './permissions';
import { connections, prismCheck, runResearch, syncSources, testConnections, traceEvent, type IntegrationConfig } from './integrations';
import { readState, saveState } from '../db/store';
import { z } from 'zod';

const policySchema=z.object({maxOrderValue:z.number().finite().min(100).max(100000),maxPositionWeight:z.number().finite().min(.01).max(1),approvalAbove:z.number().finite().min(0).max(100000),allowedSymbols:z.array(z.enum(['NVDA','MSFT','AAPL','GOOGL','AMZN','META'])).min(1).max(6),maxQuoteAgeSeconds:z.number().int().min(1).max(300),maxEvidenceAgeDays:z.number().int().min(1).max(365),requireApproval:z.boolean()}).partial().strict();
export const actionSchema=z.object({action:z.enum(['research','propose','approve','execute','reject','policy','scenario','test_connections','sync_sources','reset']),symbol:z.string().max(8).optional(),prompt:z.string().max(2000).optional(),researchId:z.string().max(100).optional(),quantity:z.number().finite().optional(),side:z.enum(['buy','sell']).optional(),orderId:z.string().max(100).optional(),policy:policySchema.optional(),scenario:z.enum(['oversize','unauthorized','stale','tamper','unsupported']).optional()}).strict();

function audit(state:DeskState,agent:string,tool:string,decision:AuditEvent['decision'],message:string,traceId=crypto.randomUUID(),orderId?:string,details?:Record<string,unknown>){
  const event:AuditEvent={id:crypto.randomUUID(),time:new Date().toISOString(),agent,tool,decision,message,traceId,orderId,details};
  state.audit.unshift(event);return event;
}
function demand(actor:string,tool:string){const check=toolPermission(actor,tool);if(!check.passed)throw new Error(check.reason);return check;}
export async function snapshot(userId:string,config:IntegrationConfig):Promise<DeskSnapshot>{return {state:await readState(userId),market:marketSnapshot(),evidence:EVIDENCE,connections:connections(config)};}

export async function act(userId:string,config:IntegrationConfig,input:Action):Promise<{snapshot:DeskSnapshot;message:string}>{
  const body=actionSchema.parse(input);
  let state=await readState(userId);const expected=state.version;
  let message='Updated.';let event:AuditEvent|undefined;
  const traceId=crypto.randomUUID();

  if(body.action==='research'){
    const symbol=body.symbol??'NVDA';
    if(!EVIDENCE.some(e=>e.symbol===symbol))throw new Error('Verified issuer evidence is available for NVDA, MSFT and AAPL. Select one of those securities.');
    demand('research-agent','research.retrieve');audit(state,'research-agent','research.retrieve','allowed',`Retrieved approved historical issuer disclosures for ${symbol}`,traceId);
    demand('research-agent','research.compose');
    const result=await runResearch(config,symbol,body.prompt??'Review the earnings evidence and propose a small paper order within the mandate.',EVIDENCE,traceId);
    state.research.unshift(result.research);state.integration.prismLastStatus=result.telemetry;state.integration.prismLastTraceId=traceId;
    event=audit(state,'research-agent','research.compose','allowed',`${result.research.mode==='nicrron'?'Nicrron generated':'Sample'} research: ${result.research.claims.length} source-backed factual claims`,traceId,undefined,{mode:result.research.mode,model:result.research.model});
    message=result.research.mode==='nicrron'?'Research generated through Nicrron. Factual evidence is linked below.':'Sample research generated. Connect Nicrron to use live model inference.';
  }

  if(body.action==='propose'){
    demand('portfolio-agent','orders.propose');
    const research=state.research.find(r=>r.id===body.researchId);if(!research)throw new Error('Select a research note before proposing an order.');
    const quote=marketSnapshot().find(q=>q.symbol===research.symbol);if(!quote)throw new Error('Unknown security.');
    const quantity=body.quantity??research.recommendation.quantity;
    const order:Order={id:crypto.randomUUID(),researchId:research.id,symbol:research.symbol,side:body.side??research.recommendation.side,quantity,price:quote.price,notional:Math.round(quantity*quote.price*100)/100,status:'review',checks:[],evidenceIds:[...research.evidenceIds],createdAt:new Date().toISOString(),traceId,fingerprint:''};
    order.checks=[toolPermission('portfolio-agent','orders.propose'),...evaluateOrder(order,state,marketSnapshot(),EVIDENCE)];
    const external=await prismCheck(config,{action:'propose_order',mode:'paper',symbol:order.symbol,side:order.side,quantity:order.quantity,notional:order.notional,permission:'pending'},traceId);
    if(connections(config).prism.enforce)order.checks.push({key:'prism',label:'PRISM enforcement',passed:external.allowed,reason:external.status});
    order.status=order.checks.every(c=>c.passed)?(approvalRequired(order,state)?'review':'approved'):'blocked';
    order.fingerprint=await fingerprintOrder(order,state);state.orders.unshift(order);
    event=audit(state,'portfolio-agent','orders.propose',order.status==='blocked'?'blocked':order.status==='review'?'review':'allowed',order.status==='blocked'?order.checks.filter(c=>!c.passed).map(c=>c.reason).join('; '):'Order checked against the current mandate. No paper fill has occurred.',traceId,order.id,{orderFingerprint:order.fingerprint,portfolioVersion:state.portfolioVersion,policyVersion:state.policy.version,executionAttempted:false});
    message=order.status==='blocked'?'Order blocked. Inspect the failed permission checks.':order.status==='review'?'Order is ready for human review.':'Order is within automatic-approval limits. You can execute it in the paper ledger.';
  }

  if(['approve','execute','reject'].includes(body.action)){
    const order=state.orders.find(o=>o.id===body.orderId);if(!order)throw new Error('Order not found.');
    if(order.status==='executed')throw new Error('This order already executed. Duplicate execution was prevented.');
    if(order.status==='rejected')throw new Error('This order was rejected. Create a new proposal.');
    if(body.action==='reject'){
      demand('human-reviewer','orders.reject');order.status='rejected';delete order.approval;
      event=audit(state,'human-reviewer','orders.reject','allowed','Reviewer rejected the proposal. No fill occurred.',traceId,order.id);message='Proposal rejected.';
    }else if(body.action==='approve'){
      demand('human-reviewer','orders.approve');
      if(order.status==='blocked')throw new Error('Blocked orders cannot be approved. Fix the cause and create a new proposal.');
      order.checks=evaluateOrder(order,state,marketSnapshot(),EVIDENCE);
      if(!order.checks.every(c=>c.passed)){order.status='blocked';message='Approval stopped because the mandate checks no longer pass.';event=audit(state,'human-reviewer','orders.approve','blocked',message,traceId,order.id);}
      else{order.fingerprint=await fingerprintOrder(order,state);order.approval={fingerprint:order.fingerprint,portfolioVersion:state.portfolioVersion,policyVersion:state.policy.version,approvedAt:new Date().toISOString()};order.status='approved';event=audit(state,'human-reviewer','orders.approve','allowed','Approval bound to this exact order, portfolio revision and mandate version.',traceId,order.id,{fingerprint:order.fingerprint});message='Exact order approved. Permission and price are checked again at paper execution.';}
    }else{
      const capability=demand('execution-agent','orders.execute');
      const ledgerBefore=state.portfolioVersion;
      const external=await prismCheck(config,{action:'execute_paper_order',symbol:order.symbol,side:order.side,quantity:order.quantity,permission:order.approval?'approved':'pending',mode:'paper'},traceId);
      const market=marketSnapshot();order.checks=[capability,...evaluateOrder(order,state,market,EVIDENCE)];
      const fingerprint=await fingerprintOrder(order,state);
      const executionPrice=market.find(q=>q.symbol===order.symbol)?.price??Infinity;
      const bound=order.status==='approved'&&fingerprint===order.fingerprint&&(!approvalRequired(order,state,executionPrice)||(order.approval?.fingerprint===fingerprint&&order.approval.portfolioVersion===state.portfolioVersion&&order.approval.policyVersion===state.policy.version&&Date.now()-Date.parse(order.approval.approvedAt)<=300000));
      order.checks.push({key:'approval',label:'Exact-order authorization',passed:bound,reason:bound?'Order, mandate and portfolio match the authorization':'Approval is missing or stale. A changed order, portfolio or mandate requires a new review.'});
      if(connections(config).prism.enforce)order.checks.push({key:'prism',label:'PRISM enforcement',passed:external.allowed,reason:external.status});
      if(order.checks.every(c=>c.passed)){
        applyFill(state,order,market.find(q=>q.symbol===order.symbol)!);
        event=audit(state,'execution-agent','orders.execute','allowed',`${order.side.toUpperCase()} ${order.quantity} ${order.symbol} filled in the paper ledger at $${order.fill!.price.toFixed(2)}`,traceId,order.id,{fingerprint,ledgerBefore,ledgerAfter:state.portfolioVersion,mode:'paper'});message='Paper order filled. Portfolio and audit history updated atomically.';
      }else{order.status='blocked';delete order.approval;event=audit(state,'execution-agent','orders.execute','blocked',order.checks.filter(c=>!c.passed).map(c=>c.reason).join('; '),traceId,order.id,{ledgerBefore,ledgerAfter:state.portfolioVersion,executionAttempted:false,blockHonored:ledgerBefore===state.portfolioVersion});message='Execution blocked. The paper ledger is unchanged.';}
    }
  }

  if(body.action==='policy'){
    demand('human-reviewer','mandate.update');const change=policySchema.parse(body.policy??{});
    if(!Object.keys(change).length)throw new Error('No mandate changes supplied.');
    state.policy={...state.policy,...change,version:state.policy.version+1} as Policy;
    for(const order of state.orders){if(order.status==='approved'){order.status='review';delete order.approval;}}
    event=audit(state,'human-reviewer','mandate.update','allowed',`Mandate updated to version ${state.policy.version}. Existing approvals invalidated.`,traceId);message='Mandate saved. Pending approvals must be reviewed against the new version.';
  }

  if(body.action==='scenario'){
    const scenario=body.scenario??'oversize';const research=canonicalSample('NVDA',EVIDENCE,traceId);
    if(scenario==='unsupported'){research.claims[0]={text:'Revenue will double next week.',evidenceIds:[],supported:false};research.score=0;}
    state.research.unshift(research);const market=marketSnapshot();
    if(scenario==='stale')market.forEach(q=>q.timestamp=new Date(Date.now()-3600000).toISOString());
    const quote=market.find(q=>q.symbol==='NVDA')!;
    const order:Order={id:crypto.randomUUID(),researchId:research.id,symbol:'NVDA',side:'buy',quantity:scenario==='oversize'?Math.ceil(state.policy.maxOrderValue/quote.price)+10:5,price:quote.price,notional:0,status:'review',checks:[],evidenceIds:[...research.evidenceIds],createdAt:new Date().toISOString(),traceId,fingerprint:'',scenario};
    order.notional=Math.round(order.quantity*quote.price*100)/100;order.fingerprint=await fingerprintOrder(order,state);
    if(scenario==='tamper'){const approved=order.fingerprint;order.quantity+=1;order.notional=order.quantity*order.price;order.checks.push({key:'approval',label:'Exact-order authorization',passed:approved===await fingerprintOrder(order,state),reason:'Requested quantity changed after approval. The prior authorization is invalid.'});}
    order.checks.push(toolPermission(scenario==='unauthorized'?'research-agent':'execution-agent','orders.execute'),...evaluateOrder(order,state,market,EVIDENCE));
    const external=await prismCheck(config,{action:'execute_paper_order',scenario,mode:'paper',symbol:order.symbol,quantity:order.quantity,permission:'denied',risk:'MANDATE_BLOCK'},traceId);
    if(connections(config).prism.enforce)order.checks.push({key:'prism',label:'PRISM enforcement',passed:external.allowed,reason:external.status});
    order.status='blocked';state.orders.unshift(order);
    event=audit(state,scenario==='unauthorized'?'research-agent':'execution-agent','orders.execute','blocked',`Failure replay: ${scenario}. ${order.checks.filter(c=>!c.passed).map(c=>c.reason).join('; ')}`,traceId,order.id,{scenario,executionAttempted:false,blockHonored:true,ledgerBefore:state.portfolioVersion,ledgerAfter:state.portfolioVersion,prism:external.status});
    message='Failure replay blocked. Inspect its checks and unchanged ledger in the audit trail.';
  }

  if(body.action==='test_connections'){
    const status=await testConnections(config);state.integration.prismLastStatus=status.prism;
    event=audit(state,'system','connections.test','allowed',`Nicrron: ${status.nicrron}. PRISM: ${status.prism}.`,traceId);message=`Nicrron: ${status.nicrron}. PRISM: ${status.prism}.`;
  }
  if(body.action==='sync_sources'){
    message=await syncSources(config,EVIDENCE);state.integration.knowledgeBaseSynced=true;event=audit(state,'research-agent','research.retrieve','allowed','Approved source documents uploaded to PRISM knowledge base.',traceId);
  }
  if(body.action==='reset'){
    state=seededState();event=audit(state,'human-reviewer','workspace.reset','allowed','Reset the sample portfolio and demo records.',traceId);message='Paper workspace reset. API credentials were preserved.';
  }
  await saveState(userId,state,expected);
  // Telemetry is reported separately from the transactional ledger outcome.
  // An unavailable observability service cannot undo or duplicate a committed fill.
  if(event&&body.action!=='research'&&body.action!=='test_connections'){
    const status=await traceEvent(config,event);
    const fresh=await readState(userId);fresh.integration.prismLastStatus=status;fresh.integration.prismLastTraceId=event.traceId;
    try{await saveState(userId,fresh,fresh.version);}catch{/* Concurrent activity wins; ledger mutation above remains committed. */}
  }
  return {snapshot:await snapshot(userId,config),message};
}
