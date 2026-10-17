import type { Check, DeskState, Evidence, Order, Quote, Research } from './types.ts';

export const REPLAY_DATE = '2025-08-29';
export const CAPABILITIES:Record<string,readonly string[]> = {
  'research-agent':['market.read','research.retrieve','research.compose'],
  'portfolio-agent':['portfolio.read','orders.propose'],
  'execution-agent':['orders.execute'],
  'human-reviewer':['orders.approve','orders.reject','orders.queue','mandate.update'],
};

export function toolPermission(actor:string,tool:string):Check {
  const passed=CAPABILITIES[actor]?.includes(tool)===true;
  return {key:'capability',label:'Agent capability',passed,reason:passed?`${actor} may call ${tool}`:`${actor} is not authorized to call ${tool}`};
}

export function portfolioValue(state:DeskState,market:Quote[]):number {
  return state.cash+state.positions.reduce((sum,p)=>sum+p.shares*(market.find(q=>q.symbol===p.symbol)?.price??p.costBasis),0);
}

// An authorization is bound to the exact order, mandate version and portfolio revision.
export async function fingerprintOrder(order:Pick<Order,'id'|'researchId'|'symbol'|'side'|'quantity'|'price'|'evidenceIds'|'marketMode'>,state:DeskState):Promise<string>{
  const value=JSON.stringify([order.id,order.researchId,order.symbol,order.side,order.quantity,order.price,[...order.evidenceIds].sort(),state.policy.version,state.portfolioVersion,order.marketMode??'replay']);
  const hash=await crypto.subtle.digest('SHA-256',new TextEncoder().encode(value));
  return Array.from(new Uint8Array(hash),b=>b.toString(16).padStart(2,'0')).join('');
}

/** Queue consent binds the exact order and policy, while risk is re-evaluated against the latest portfolio. */
export async function fingerprintQueuedOrder(order:Order,state:DeskState):Promise<string>{
  const value=JSON.stringify(['yahoo-queue-v1',order.id,order.researchId,order.symbol,order.side,order.quantity,order.price,[...order.evidenceIds].sort(),order.marketMode,order.quoteTimestamp,state.policy.version,order.queue?.queuedAt,order.queue?.expiresAt,order.queue?.maxPriceDriftPercent]);
  const hash=await crypto.subtle.digest('SHA-256',new TextEncoder().encode(value));
  return Array.from(new Uint8Array(hash),b=>b.toString(16).padStart(2,'0')).join('');
}

export function evaluateOrder(order:Order,state:DeskState,market:Quote[],evidence:Evidence[],now=Date.now(),phase:'reference'|'execution'='execution'):Check[]{
  const checks:Check[]=[];
  const add=(key:string,label:string,passed:boolean,reason:string)=>checks.push({key,label,passed,reason});
  const policy=state.policy,quote=market.find(q=>q.symbol===order.symbol);
  const marketMode=order.marketMode;
  const report=state.research.find(r=>r.id===order.researchId);
  const qtyValid=Number.isSafeInteger(order.quantity)&&order.quantity>0&&order.quantity<=100000;
  const sideValid=order.side==='buy'||order.side==='sell';
  const priceValid=!!quote&&Number.isFinite(quote.price)&&quote.price>0&&Number.isFinite(order.price)&&order.price>0;
  add('parameters','Valid order parameters',qtyValid&&sideValid&&priceValid,'Positive whole shares, known symbol and finite price are required');
  add('market_source','Yahoo Finance source',quote?.source==='yahoo'&&marketMode==='yahoo','Only Yahoo Finance observations can authorize a paper order');
  if(marketMode==='yahoo'){
    if(phase==='execution')add('market_session','Regular market session',quote?.marketState==='open','Paper execution requires an open regular market session');
    const complete=state.positions.filter(p=>p.shares>0).every(p=>{const q=market.find(item=>item.symbol===p.symbol);const quoteAge=q?(now-Date.parse(q.timestamp))/1000:Infinity;return q?.source==='yahoo'&&!q.stale&&Number.isFinite(q.price)&&q.price>0&&quoteAge>=-2&&quoteAge<=(phase==='reference'&&q.marketState==='closed'?7*86400:policy.maxQuoteAgeSeconds);});
    add('portfolio_quotes','Complete portfolio pricing',complete,`Every holding needs a Yahoo price within ${policy.maxQuoteAgeSeconds}s before position limits can be evaluated`);
  }
  add('allowlist','Approved security',policy.allowedSymbols.includes(order.symbol),`${order.symbol} ${policy.allowedSymbols.includes(order.symbol)?'is':'is not'} in the mandate universe`);
  const age=quote?(now-Date.parse(quote.timestamp))/1000:Infinity;
  const referenceClosed=phase==='reference'&&quote?.marketState==='closed';
  add('freshness',referenceClosed?'Latest closing reference':'Fresh market snapshot',!quote?.stale&&age>=-2&&age<=(referenceClosed?7*86400:policy.maxQuoteAgeSeconds),referenceClosed?'Latest valid Yahoo close is a reference for review; it cannot be used as an execution price':`Provider quote must be within ${policy.maxQuoteAgeSeconds}s; age ${Number.isFinite(age)?Math.max(0,Math.round(age)):'unknown'}s${quote?.stale?'; source marked stale':''}`);
  const slippage=priceValid?Math.abs(quote!.price-order.price)/order.price:Infinity;
  add('price','Price drift within 1%',slippage<=.01,'Reference price must stay within 1% of the executable quote');
  const notional=priceValid&&qtyValid?quote!.price*order.quantity:Infinity;
  add('notional','Order notional limit',Number.isFinite(notional)&&notional<=policy.maxOrderValue,`$${Number.isFinite(notional)?notional.toFixed(2):'invalid'} requested · $${policy.maxOrderValue.toLocaleString()} limit`);
  const held=state.positions.find(p=>p.symbol===order.symbol)?.shares??0;
  const remaining=held+(order.side==='buy'?order.quantity:-order.quantity);
  add('inventory','Cash and inventory',qtyValid&&sideValid&&(order.side==='buy'?notional<=state.cash:order.quantity<=held),order.side==='buy'?`$${state.cash.toFixed(2)} available cash`:`${held} shares available; shorting is disabled`);
  const nav=portfolioValue(state,market),weight=priceValid&&nav>0?remaining*quote!.price/nav:Infinity;
  add('concentration','Position concentration',remaining>=0&&weight<=policy.maxPositionWeight,`${Number.isFinite(weight)?(weight*100).toFixed(1):'invalid'}% after trade · ${(policy.maxPositionWeight*100).toFixed(0)}% limit`);
  const validEvidence=report&&report.symbol===order.symbol&&report.claims.length>0&&report.claims.every(c=>c.supported&&c.evidenceIds.length>0&&c.evidenceIds.every(id=>order.evidenceIds.includes(id)&&evidence.some(e=>e.id===id&&e.symbol===order.symbol))&&c.evidenceIds.some(id=>evidence.find(e=>e.id===id)?.text===c.text))&&order.evidenceIds.length>0&&order.evidenceIds.every(id=>report.evidenceIds.includes(id)&&evidence.some(e=>e.id===id&&e.symbol===order.symbol));
  add('evidence','Source-backed research',!!validEvidence,'Every factual claim must match a stored issuer disclosure or canonical Yahoo historical calculation for this security');
  const asOf=now;
  const freshEvidence=order.evidenceIds.length>0&&order.evidenceIds.every(id=>{const e=evidence.find(x=>x.id===id);const days=e?(asOf-Date.parse(e.publishedAt))/86400000:Infinity;return days>=0&&days<=policy.maxEvidenceAgeDays;});
  add('source_age','Evidence date policy',freshEvidence,`Sources must be within ${policy.maxEvidenceAgeDays} days of the current date`);
  const historySources=order.evidenceIds.map(id=>evidence.find(source=>source.id===id)).filter(source=>source?.provenance);
  if(report?.mode==='strategy'||historySources.length){
    const history=report?.history;
    const valid=!!history&&report?.mode==='strategy'&&history.provider==='yahoo'&&history.asOf===history.latestAvailableDate&&historySources.length===1&&historySources.every(source=>{
      const provenance=source!.provenance!;
      return source!.id===history.evidenceId&&provenance.provider==='yahoo'&&provenance.kind==='historical-strategy'&&provenance.symbol===order.symbol&&provenance.strategyId===history.strategyId&&provenance.asOf===history.asOf&&provenance.latestAvailableDate===history.latestAvailableDate&&Date.parse(provenance.retrievedAt)<=now+2000&&Date.parse(source!.publishedAt)<=now;
    });
    add('historical_provenance','Current Yahoo historical strategy',valid,'Historical signals must come from stored Yahoo observations through the latest complete session. Earlier as-of inspections cannot authorize current orders.');
  }
  return checks;
}

export function approvalRequired(order:Order,state:DeskState,executionPrice=order.price):boolean{return state.policy.requireApproval||executionPrice*order.quantity>=state.policy.approvalAbove;}

export function applyFill(state:DeskState,order:Order,quote:Quote,now=Date.now()):void {
  if(order.marketMode!=='yahoo'||quote.source!=='yahoo')throw new Error('Paper fills require an observed Yahoo Finance price.');
  if(order.status==='executed'||order.fill)throw new Error('This order has already executed.');
  const cost=Math.round(quote.price*order.quantity*100)/100;
  const position=state.positions.find(p=>p.symbol===order.symbol);
  if(order.side==='buy'){
    if(cost>state.cash)throw new Error('Insufficient cash at execution.');
    if(position){position.costBasis=(position.costBasis*position.shares+cost)/(position.shares+order.quantity);position.shares+=order.quantity;}
    else state.positions.push({symbol:order.symbol,shares:order.quantity,costBasis:quote.price});
    state.cash=Math.round((state.cash-cost)*100)/100;
  }else{
    if(!position||position.shares<order.quantity)throw new Error('Insufficient shares at execution.');
    position.shares-=order.quantity;state.cash=Math.round((state.cash+cost)*100)/100;
    state.positions=state.positions.filter(p=>p.shares>0);
  }
  order.status='executed';order.fill={price:quote.price,quantity:order.quantity,time:new Date(now).toISOString()};
  state.portfolioVersion++;
}

export function canonicalSample(symbol:string,evidence:Evidence[],traceId:string,now=Date.now()):Research {
  const sources=evidence.filter(e=>e.symbol===symbol);
  if(!sources.length)throw new Error(`No verified source documents for ${symbol}. Select NVDA, MSFT or AAPL.`);
  return {id:crypto.randomUUID(),symbol,title:`${symbol}: evidence before execution`,summary:'A sample research note built from historical issuer disclosures. Review the original sources before using the proposed paper order.',claims:sources.map(e=>({text:e.text,evidenceIds:[e.id],supported:true})),risks:['Historical disclosures are not current market information.','A supported factual claim does not prove an investment thesis or predict returns.'],evidenceIds:sources.map(e=>e.id),score:100,createdAt:new Date(now).toISOString(),mode:'sample',model:'deterministic sample',recommendation:{side:'buy',quantity:10,rationale:'Illustrative paper sizing for the permission workflow, not a return forecast.'},traceId};
}
