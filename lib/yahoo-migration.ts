import { INITIAL_PAPER_CASH } from './fixtures.ts';
import type { DeskState } from './types.ts';

/** One-time ledger rebuild: fixtures and replay fills never become Yahoo positions. */
export function migrateYahooState(state:DeskState,now=Date.now()):boolean {
  if(state.yahooMigrationVersion===1)return false;
  const removed=state.orders.filter(order=>order.marketMode!=='yahoo');
  const preserved=state.orders.filter(order=>order.marketMode==='yahoo');
  const positions:DeskState['positions']=[];
  let cash=INITIAL_PAPER_CASH;
  const fills=preserved.filter(order=>order.status==='executed'&&order.fill).sort((a,b)=>Date.parse(a.fill!.time)-Date.parse(b.fill!.time));
  const excluded:string[]=[];
  for(const order of fills){
    const fill=order.fill!;
    const valid=Number.isSafeInteger(fill.quantity)&&fill.quantity>0&&fill.quantity===order.quantity&&Number.isFinite(fill.price)&&fill.price>0&&Number.isFinite(Date.parse(fill.time));
    const position=positions.find(item=>item.symbol===order.symbol);
    const cost=Math.round(fill.price*fill.quantity*100)/100;
    if(!valid||order.side==='sell'&&(!position||position.shares<fill.quantity)||order.side==='buy'&&cost>cash){excluded.push(order.id);continue;}
    if(order.side==='buy'){
      if(position){position.costBasis=(position.costBasis*position.shares+cost)/(position.shares+fill.quantity);position.shares+=fill.quantity;}
      else positions.push({symbol:order.symbol,shares:fill.quantity,costBasis:fill.price});
      cash=Math.round((cash-cost)*100)/100;
    }else{position!.shares-=fill.quantity;cash=Math.round((cash+cost)*100)/100;}
  }
  // Preserve excluded Yahoo records for inspection rather than inventing inventory to replay them.
  for(const order of preserved){
    if(order.status==='approved'||order.status==='queued'){
      order.status='review';delete order.approval;delete order.queue;
      order.reviewReason='Portfolio reset to Yahoo-only history. Review this exact order again.';
    }
  }
  const removedIds=new Set(removed.map(order=>order.id));
  state.orders=preserved;
  state.positions=positions.filter(position=>position.shares>0);
  state.cash=cash;state.initialCash=INITIAL_PAPER_CASH;state.portfolioVersion++;
  state.research=state.research.filter(research=>!research.id.startsWith('seed-'));
  state.audit=state.audit.filter(event=>!event.id.startsWith('seed-')&&!(event.orderId&&removedIds.has(event.orderId)));
  state.audit.unshift({id:crypto.randomUUID(),time:new Date(now).toISOString(),agent:'system',tool:'workspace.yahoo_migration',decision:'allowed',message:`Removed ${removed.length} synthetic orders and seeded holdings. Rebuilt the paper ledger from $250,000 and ${fills.length-excluded.length} verifiable Yahoo fills.`,traceId:crypto.randomUUID(),details:{removedSyntheticOrders:removed.length,preservedYahooOrders:preserved.length,replayedYahooFills:fills.length-excluded.length,excludedYahooFillIds:excluded,initialCash:INITIAL_PAPER_CASH}});
  state.evidence??=[];state.yahooMigrationVersion=1;
  if(state.policy.maxQuoteAgeSeconds===30){state.policy.maxQuoteAgeSeconds=120;state.policy.version++;}
  return true;
}
