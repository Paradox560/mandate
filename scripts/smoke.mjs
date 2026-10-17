import assert from 'node:assert/strict';
const base=(process.env.MANDATE_URL||'http://127.0.0.1:5189').replace(/\/$/,'');
async function snapshot(workspace='demo'){
  const response=await fetch(`${base}/api/desk?marketMode=yahoo&workspace=${workspace}`);
  const body=await response.json();assert.ok(response.ok,body.error);return body;
}
async function action(body){
  const response=await fetch(base+'/api/action',{method:'POST',headers:{'Content-Type':'application/json',Origin:base},body:JSON.stringify({...body,marketMode:'yahoo',workspace:'demo'})});
  const data=await response.json();assert.ok(response.ok,data.error);return data.snapshot;
}
const mainBefore=(await snapshot('desk')).state;
let state=await action({action:'start_demo'});
assert.equal(state.state.cash,250000);assert.deepEqual(state.state.positions,[]);assert.deepEqual(state.state.orders,[]);
assert.ok(state.market.length>0,'Actual Yahoo observations must be available.');
assert.ok(state.market.every(quote=>quote.source==='yahoo'));
console.log('PASS: isolated cash-only workspace and actual Yahoo quotes');
state=await action({action:'strategy_research',symbol:'MSFT',strategyId:'buy-and-hold'});
const research=state.state.research[0];assert.equal(research.mode,'strategy');assert.equal(research.history.asOf,research.history.latestAvailableDate);
assert.ok(state.evidence.find(source=>source.id===research.evidenceIds[0])?.provenance?.provider==='yahoo');
console.log(`PASS: source-linked historical research through ${research.history.asOf}`);
state=await action({action:'propose',researchId:research.id,quantity:1,side:'buy'});
let order=state.state.orders[0];assert.equal(order.status,'review',JSON.stringify(order.checks.filter(check=>!check.passed)));
state=await action({action:'approve',orderId:order.id});assert.equal(state.state.orders.find(item=>item.id===order.id).status,'approved');
const quote=state.market.find(item=>item.symbol==='MSFT');
if(quote.marketState==='closed'){
  state=await action({action:'queue',orderId:order.id});order=state.state.orders.find(item=>item.id===order.id);assert.equal(order.status,'queued');assert.equal(order.queue.maxPriceDriftPercent,1);
  const ledger=JSON.stringify({cash:state.state.cash,positions:state.state.positions,revision:state.state.portfolioVersion});
  state=await action({action:'process_queue'});assert.equal(state.state.orders.find(item=>item.id===order.id).status,'queued');assert.equal(JSON.stringify({cash:state.state.cash,positions:state.state.positions,revision:state.state.portfolioVersion}),ledger);
  console.log('PASS: explicit approval and queue consent; closed market cannot fill or change ledger');
  state=await action({action:'reject',orderId:order.id});assert.equal(state.state.orders.find(item=>item.id===order.id).status,'rejected');
  console.log('PASS: cancellation revokes unattended execution');
}else{
  state=await action({action:'execute',orderId:order.id});order=state.state.orders.find(item=>item.id===order.id);assert.equal(order.status,'executed',JSON.stringify(order.checks.filter(check=>!check.passed)));assert.ok(order.fill);
  console.log('PASS: actual open-session Yahoo paper fill');
}
const beforeOversize=state.state.portfolioVersion;
state=await action({action:'propose',researchId:research.id,quantity:Math.ceil(state.state.policy.maxOrderValue/quote.price)+10,side:'buy'});
const oversized=state.state.orders[0];assert.equal(oversized.status,'blocked');assert.ok(oversized.checks.some(check=>check.key==='notional'&&!check.passed));assert.equal(state.state.portfolioVersion,beforeOversize);
if(state.connections.prism.enforce){const check=oversized.checks.find(check=>check.key==='prism');assert.ok(check&&!check.passed&&check.reason.startsWith('PRISM blocked'),check?.reason);}
console.log('PASS: actual Yahoo oversized proposal blocked with unchanged ledger');
const denied=await fetch(base+'/api/action',{method:'POST',headers:{'Content-Type':'application/json',Origin:'https://invalid.example'},body:JSON.stringify({action:'reset',workspace:'demo'})});assert.ok([400,403].includes(denied.status));
const replay=await fetch(base+'/api/desk?marketMode=replay');assert.equal(replay.status,400);
assert.deepEqual((await snapshot('desk')).state,mainBefore);
console.log('PASS: replay rejected, cross-origin action rejected, main desk unchanged');
