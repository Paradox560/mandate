import { marketSnapshot } from './helpers/market-fixture.ts';
import test from 'node:test';
import assert from 'node:assert/strict';
import { EVIDENCE, seededState } from '../lib/fixtures.ts';
import { approvalRequired, applyFill, canonicalSample, evaluateOrder, fingerprintOrder, portfolioValue, toolPermission } from '../lib/permissions.ts';
import type { Order } from '../lib/types.ts';

const now=Date.parse('2026-10-17T15:00:00Z');
const evidence=EVIDENCE.map(source=>({...source,publishedAt:'2026-10-15'}));
function setup(){const state=seededState(now);state.positions=[{symbol:'NVDA',shares:220,costBasis:156},{symbol:'MSFT',shares:100,costBasis:480},{symbol:'AAPL',shares:140,costBasis:218}];const market=marketSnapshot(now).map(q=>({...q,source:'yahoo' as const,marketState:'open' as const,stale:false}));const report=canonicalSample('NVDA',evidence,'test-trace',now);state.research.unshift(report);const price=market.find(q=>q.symbol==='NVDA')!.price;const order:Order={id:'test-order',researchId:report.id,symbol:'NVDA',side:'buy',quantity:10,price,notional:price*10,status:'review',checks:[],evidenceIds:report.evidenceIds,createdAt:new Date(now).toISOString(),traceId:'test-trace',fingerprint:'',marketMode:'yahoo'};return {state,market,order};}
function failed(key:string,update:(s:ReturnType<typeof setup>)=>void){const s=setup();update(s);assert.equal(evaluateOrder(s.order,s.state,s.market,evidence,now).find(c=>c.key===key)?.passed,false,key+' should fail');}

test('valid sourced paper order passes objective mandate rules',()=>{const s=setup();assert.ok(evaluateOrder(s.order,s.state,s.market,evidence,now).every(c=>c.passed));});
test('price movement across the approval threshold requires human authorization at execution',()=>{const {state,order}=setup();state.policy.requireApproval=false;state.policy.approvalAbove=1810;order.quantity=10;order.price=180.45;order.notional=1804.5;assert.equal(approvalRequired(order,state),false);assert.equal(approvalRequired(order,state,181.10),true);});
test('research agent cannot execute orders, unknown agents default deny',()=>{assert.equal(toolPermission('research-agent','orders.execute').passed,false);assert.equal(toolPermission('rogue','orders.execute').passed,false);assert.equal(toolPermission('execution-agent','orders.execute').passed,true);});
test('oversized order cannot pass even with sufficient cash',()=>failed('notional',s=>{s.order.quantity=100;}));
test('restricted security is denied',()=>failed('allowlist',s=>{s.state.policy.allowedSymbols=['AAPL'];}));
test('stale quote is denied',()=>failed('freshness',s=>{s.market[0].timestamp=new Date(now-600000).toISOString();}));
test('future-dated quote is denied',()=>failed('freshness',s=>{s.market[0].timestamp=new Date(now+60000).toISOString();}));
test('invalid quantities including NaN, infinity, negative and fractional fail closed',()=>{for(const quantity of [NaN,Infinity,-5,0,1.5,Number.MAX_SAFE_INTEGER])failed('parameters',s=>{s.order.quantity=quantity;});});
test('missing quote cannot become a zero-cost trade',()=>failed('parameters',s=>{s.market=s.market.filter(q=>q.symbol!=='NVDA');}));
test('non-finite price is denied',()=>failed('parameters',s=>{s.market[0].price=NaN;}));
test('cash is checked before buying',()=>failed('inventory',s=>{s.state.cash=1;}));
test('overselling cannot create a short position',()=>failed('inventory',s=>{s.order.side='sell';s.order.quantity=500;}));
test('concentration is calculated against total portfolio value',()=>failed('concentration',s=>{s.state.policy.maxPositionWeight=.01;}));
test('unsupported evidence cannot grant trade permission',()=>failed('evidence',s=>{s.state.research[0].claims[0].supported=false;}));
test('a valid citation identifier cannot launder a fabricated numeric claim',()=>failed('evidence',s=>{s.state.research[0].claims[0].text='Revenue was $900 billion.';}));
test('evidence from another security is rejected',()=>failed('evidence',s=>{s.order.evidenceIds=['AAPL-FY25-Q3-REVENUE'];}));
test('unknown source IDs are denied',()=>failed('evidence',s=>{s.order.evidenceIds=['fabricated'];}));
test('out-of-policy historical evidence is denied',()=>failed('source_age',s=>{s.state.policy.maxEvidenceAgeDays=1;}));
test('price movement outside the reviewed price tolerance is denied',()=>failed('price',s=>{s.market[0].price*=1.02;}));
test('approval fingerprint changes with quantity, symbol, side, price, evidence, portfolio or policy',async()=>{const {state,order}=setup();const base=await fingerprintOrder(order,state);for(const patch of [{quantity:11},{symbol:'AAPL'},{side:'sell'},{price:order.price+1},{evidenceIds:['AAPL-FY25-Q3-REVENUE']}])assert.notEqual(await fingerprintOrder({...order,...patch} as Order,state),base);state.policy.version++;assert.notEqual(await fingerprintOrder(order,state),base);state.policy.version--;state.portfolioVersion++;assert.notEqual(await fingerprintOrder(order,state),base);});
test('paper fill debits cash, increases shares and portfolio revision exactly once',()=>{const {state,order,market}=setup();const quote=market[0],cash=state.cash,shares=state.positions.find(p=>p.symbol==='NVDA')!.shares,nav=portfolioValue(state,market);applyFill(state,order,quote,now);assert.equal(state.cash,Math.round((cash-quote.price*10)*100)/100);assert.equal(state.positions.find(p=>p.symbol==='NVDA')!.shares,shares+10);assert.equal(state.portfolioVersion,2);assert.equal(order.status,'executed');assert.ok(Math.abs(portfolioValue(state,market)-nav)<.01);assert.throws(()=>applyFill(state,order,quote,now),/already executed/);});
test('sell credits cash and removes exhausted position',()=>{const {state,order,market}=setup();order.side='sell';order.quantity=220;const cash=state.cash;applyFill(state,order,market[0],now);assert.ok(state.cash>cash);assert.equal(state.positions.some(p=>p.symbol==='NVDA'),false);});
test('new workspace has paper cash but no generated holdings, orders or research',()=>{const state=seededState(now);assert.equal(state.cash,250000);assert.deepEqual([state.positions,state.orders,state.research],[[],[],[]]);});
