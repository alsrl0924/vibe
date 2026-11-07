const {test}=require('node:test');
const assert=require('node:assert/strict');
const shared=require('../js/shared-auth-core.js');
const A='00000000-0000-4000-8000-000000000001',B='00000000-0000-4000-8000-000000000002';
function token(id,expires=100,project=shared.PROJECT){return JSON.stringify({user:{id},access_token:'test.'+Buffer.from(JSON.stringify({iss:`https://${project}.supabase.co/auth/v1`})).toString('base64url')+'.test',refresh_token:'test-only',expires_at:expires});}
function storage(seed={}){const values=new Map(Object.entries(seed));return {getItem:k=>values.has(k)?values.get(k):null,setItem:(k,v)=>values.set(k,String(v)),removeItem:k=>values.delete(k)};}
const linux=`linux-master-${shared.PROJECT}-auth-v1`,vibe=`vibe-${shared.PROJECT}-auth-v1`;
test('all apps reuse the existing network login without choosing a different legacy account',()=>{const raw=token(A),s=storage({[shared.authKey()]:raw,[linux]:token(B),[vibe]:token(B)});shared.prepare(s);assert.equal(s.getItem(shared.authKey()),raw);assert.equal(shared.owner(s),A);});
test('one legacy account migrates once and retains its original session',()=>{const raw=token(A),s=storage({[linux]:raw});shared.prepare(s);assert.equal(s.getItem(shared.authKey()),raw);assert.equal(s.getItem(linux),raw);assert.equal(shared.owner(s),A);});
test('same-account legacy sessions select the freshest session deterministically',()=>{const recent=token(A,200),s=storage({[linux]:token(A,100),[vibe]:recent});shared.prepare(s);assert.equal(s.getItem(shared.authKey()),recent);});
test('different legacy accounts require an explicit fresh login and never silently select one',()=>{const s=storage({[linux]:token(A),[vibe]:token(B)});shared.prepare(s);assert.equal(s.getItem(shared.authKey()),null);assert.equal(shared.owner(s),null);assert.equal(s.getItem(shared.markerKey()),'1');});
test('logout is not undone by leftover legacy sessions when another app opens',()=>{const s=storage({[linux]:token(A)});shared.prepare(s);s.removeItem(shared.authKey());shared.prepare(s);assert.equal(shared.owner(s),null);assert(s.getItem(linux));});
test('empty first visit is marked so a later stale legacy login cannot resurrect',()=>{const s=storage();shared.prepare(s);s.setItem(vibe,token(A));assert.equal(shared.owner(s),null);});
test('foreign-project or malformed legacy tokens do not enter the common login',()=>{for(const raw of [token(A,100,'old-deleted-project'),'{invalid']){const s=storage({[linux]:raw});shared.prepare(s);assert.equal(s.getItem(shared.authKey()),null);}});
test('guest, accounts, study apps and quiz sessions retain separate storage namespaces',()=>{assert.equal(shared.scopedKey('linux-progress',null),'linux-progress');assert.notEqual(shared.scopedKey('linux-progress',A),shared.scopedKey('linux-progress',B));assert.notEqual(shared.scopedKey('linux-progress',A),shared.scopedKey('net-progress',A));assert.notEqual(shared.scopedKey('linux-progress',A),shared.scopedKey('linux-session',A));});
