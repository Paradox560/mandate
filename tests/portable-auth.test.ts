import assert from 'node:assert/strict';
import {test} from 'node:test';
import {createPortableSession,verifyPortableSession,checkAccessCode,safeReturnTo,sessionCookie,PortableLoginLimiter,portableAuthConfig} from '../lib/portable-auth.ts';
const config={secret:'test-session-secret-must-be-at-least-32-characters',accessCode:'test-access-code',mode:'code' as const};
test('portable sessions are signed, expiring, isolated and never reuse the owner identity',async()=>{
  const a=await createPortableSession(config,1000),b=await createPortableSession(config,1000);
  assert.notEqual(a.userId,b.userId);assert.match(a.userId,/^ninoo:session:/);
  assert.equal(await verifyPortableSession(a.token,config,1001),a.userId);
  assert.equal(await verifyPortableSession(a.token,config,1000+12*60*60*1000),null);
  assert.equal(await verifyPortableSession(a.token,{...config,secret:'different-32-character-server-secret-value'},1001),null);
  assert.equal(await verifyPortableSession(a.token.slice(0,-8)+'tampered',config,1001),null);
  assert.equal(await verifyPortableSession('local-mandate-owner',config),null);
});
test('portable session parsing rejects multiple segments and picks only the exact cookie',async()=>{
  assert.equal(await verifyPortableSession('a.b.c',config),null);
  assert.equal(sessionCookie(new Request('https://demo.example',{headers:{cookie:'other=foo; mandate_session=signed.value; fake_mandate_session=wrong'}})),'signed.value');
  assert.equal(sessionCookie(new Request('https://demo.example',{headers:{cookie:'mandate_session=attacker.value; mandate_session=visitor.value'}})),undefined);
});
test('portable login throttle reserves concurrent checks and releases successful checks only once',()=>{
  const limiter=new PortableLoginLimiter(2,60_000);
  const first=limiter.reserve(1000),second=limiter.reserve(1000);
  assert.ok(first);assert.ok(second);assert.equal(limiter.reserve(1001),null);
  first(false);first(false);
  const third=limiter.reserve(1002);assert.ok(third);assert.equal(limiter.reserve(1003),null);
  second(true);third(true);
  assert.equal(limiter.reserve(1004),null);
  assert.ok(limiter.reserve(61_000));
});
test('portable access code configuration matches the form length limits',t=>{
  const keys=['MANDATE_SESSION_SECRET','MANDATE_ACCESS_MODE','MANDATE_ACCESS_CODE'];
  const original=keys.map(key=>[key,process.env[key]] as const);
  t.after(()=>{for(const [key,value] of original){if(value===undefined)delete process.env[key];else process.env[key]=value;}});
  process.env.MANDATE_SESSION_SECRET=config.secret;
  process.env.MANDATE_ACCESS_MODE='code';
  process.env.MANDATE_ACCESS_CODE='x'.repeat(129);
  assert.throws(()=>portableAuthConfig(),/between 12 and 128/);
  process.env.MANDATE_ACCESS_CODE='x'.repeat(128);
  assert.equal(portableAuthConfig().accessCode?.length,128);
});
test('access code checks do not accept partial matches and return paths stay in the app',async()=>{
  assert.equal(await checkAccessCode('test-access-code','test-access-code'),true);
  assert.equal(await checkAccessCode('test-access-codE','test-access-code'),false);
  for(const input of ['https://evil.example','//evil.example','/\\evil.example','/api/session','/access?returnTo=/access'])assert.equal(safeReturnTo(input),'/?judge=1');
  assert.equal(safeReturnTo('/?judge=1'),'/?judge=1');assert.equal(safeReturnTo('/?marketMode=yahoo'),'/?marketMode=yahoo');
});
