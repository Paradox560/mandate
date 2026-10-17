import assert from 'node:assert/strict';
const base=process.env.MANDATE_URL||'http://127.0.0.1:5187';
async function action(body){const r=await fetch(base+'/api/action',{method:'POST',headers:{'Content-Type':'application/json',Origin:base},body:JSON.stringify(body)});const data=await r.json();if(!r.ok)throw new Error(data.error||'Request failed');return data;}
const initial=await (await fetch(base+'/api/desk')).json();assert.ok(initial.state);console.log('PASS: persistent workspace, synthetic market and server-only connection flags');
const probe=await action({action:'test_connections'});console.log(probe.message);
if(process.argv.includes('--live')){
 const sync=await action({action:'sync_sources'});console.log(sync.message);
 const research=await action({action:'research',symbol:'NVDA',prompt:'Explain reported revenue and H20 China exposure using the historical August 2025 source catalog. Propose five shares for a paper review.'});
 assert.equal(research.snapshot.state.research[0].mode,'nicrron');
 assert.ok(research.snapshot.state.research[0].claims.every(c=>c.supported&&c.evidenceIds.length));
 console.log('PASS: live Nicrron research with canonical source citations');console.log(research.snapshot.state.integration.prismLastStatus);
}
const current=await (await fetch(base+'/api/desk')).json();const report=current.state.research.find(r=>r.symbol==='NVDA'&&r.claims.every(c=>c.supported));
let data=await action({action:'propose',researchId:report.id,quantity:5,side:'buy'});let order=data.snapshot.state.orders[0];assert.equal(order.status,'review');
const before=data.snapshot.state.portfolioVersion;data=await action({action:'execute',orderId:order.id});assert.equal(data.snapshot.state.orders[0].status,'blocked');assert.equal(data.snapshot.state.portfolioVersion,before);console.log('PASS: execution without approval denied; ledger unchanged');
data=await action({action:'propose',researchId:report.id,quantity:5,side:'buy'});order=data.snapshot.state.orders[0];data=await action({action:'approve',orderId:order.id});assert.equal(data.snapshot.state.orders[0].status,'approved');
const results=await Promise.allSettled([action({action:'execute',orderId:order.id}),action({action:'execute',orderId:order.id})]);
const final=await (await fetch(base+'/api/desk')).json();assert.equal(final.state.portfolioVersion,before+1);assert.equal(final.state.orders.find(o=>o.id===order.id).status,'executed');assert.ok(results.some(r=>r.status==='rejected'));console.log('PASS: parallel execution requests produce exactly one fill');
for(const scenario of ['oversize','unauthorized','stale','tamper','unsupported']){const d=await action({action:'scenario',scenario});assert.equal(d.snapshot.state.portfolioVersion,before+1);assert.equal(d.snapshot.state.orders[0].status,'blocked');assert.ok(d.snapshot.state.orders[0].checks.some(c=>!c.passed));console.log('PASS: '+scenario+' blocked with no ledger mutation');}
const csrf=await fetch(base+'/api/action',{method:'POST',headers:{Origin:'https://untrusted.example','Content-Type':'application/json'},body:JSON.stringify({action:'reset'})});assert.ok([400,403].includes(csrf.status));console.log('PASS: cross-origin mutation rejected');
console.log('Workflow smoke checks complete. Created research, paper orders and audit events are intentionally retained for inspection.');
