const {test}=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const vm=require('node:vm');
const p=require('../js/progress-core.js');
const legacy={wrongMap:{1:3,2:1},clippedList:[1,2],streakDays:4,lastStudyDate:'2026-11-06',quizHistory:[{date:'11/6',subject:'웹',score:80,total:10,correct:8}],earnedBadgeList:['badge_first']};
let i=0;const uuid=()=>String(++i);
test('legacy import is idempotent and preserves duplicate quiz results, bookmarks and all histories',()=>{
 const raw={...legacy,bookmarkedList:[3],quizHistory:Array.from({length:750},()=>legacy.quizHistory[0])};
 const d=p.importLegacy(p.empty(),raw), twice=p.importLegacy(d,raw), s=p.materialize(twice);
 assert.deepEqual(d,twice);assert.equal(s.quizHistory.length,750);assert.deepEqual(s.clippedList,[1,2,3]);assert.deepEqual(s.wrongMap,legacy.wrongMap);
});
test('concurrent wrong increments, recovery, clip removals and quizzes merge without overwriting',()=>{
 const d=p.importLegacy(p.empty(),legacy), before=p.materialize(d);
 const a=p.capture(d,before,{...before,wrongMap:{1:4,2:1},clippedList:[2]},uuid,100);
 const b=p.capture(d,before,{...before,wrongMap:{1:4},quizHistory:[{id:'new',date:'11/7',subject:'웹',score:100,total:5,correct:5},...before.quizHistory]},uuid,101);
 const merged=p.merge(a,b),s=p.materialize(merged);
 assert.equal(s.wrongMap[1],5);assert.equal(s.wrongMap[2],undefined);assert.deepEqual(s.clippedList,[2]);assert.equal(s.quizHistory.length,2);
 assert.equal(p.canonical(p.merge(a,b)),p.canonical(p.merge(b,a)));assert.deepEqual(p.merge(merged,merged),merged);
});
test('capture after applying a remote document does not manufacture duplicate events',()=>{
 let d=p.importLegacy(p.empty(),legacy),s=p.materialize(d);
 d=p.capture(d,s,{...s,quizHistory:[{id:'a',date:'x',subject:'웹',score:1,total:1,correct:1},...s.quizHistory]},uuid,1);
 s=p.materialize(d);assert.deepEqual(p.capture(d,s,s,uuid,2),d);
});
test('unknown versions and conflicting event IDs fail closed without mutating either input',()=>{
 const a=p.capture(p.empty(),{},legacy,()=> 'same',1); // repeated UUID is not a valid producer, test conflict separately
 const b=structuredClone(a);b.events.same.at=2;const original=JSON.stringify(a);
 assert.throws(()=>p.merge(a,b),/충돌/);assert.equal(JSON.stringify(a),original);assert.throws(()=>p.merge(p.empty(),{version:3,base:{},events:{}}));
});
test('service worker ignores Supabase, authorization headers and other apps; activation preserves foreign caches',async()=>{
 const handlers={},deleted=[],responded=[];
 const scope={self:{registration:{scope:'https://example.test/vibe/'},addEventListener:(t,f)=>handlers[t]=f,clients:{claim(){}},skipWaiting(){}},URL,Response,
 caches:{keys:async()=>['vibelearn-v9','vibelearn-v10','vibelearn-v11','linux-master-study-v2','netstudy-v3'],delete:async k=>deleted.push(k)},fetch:async()=>{throw Error('should not fetch');}};
 vm.runInNewContext(fs.readFileSync(require.resolve('../sw.js'),'utf8'),scope);
 let wait;handlers.activate({waitUntil:p=>wait=p});await wait;assert.deepEqual(deleted,['vibelearn-v9','vibelearn-v10']);
 for(const [url,headers]of [['https://project.supabase.co/rest/v1/app_progress',{}],['https://example.test/netstudy/',{}],['https://example.test/vibe/data',{authorization:'bearer test'}]]) {
  handlers.fetch({request:{method:'GET',url,headers:new Headers(headers)},respondWith:x=>responded.push(x)});
 } assert.equal(responded.length,0);
});

test('import retains the original newest-first order of timestamp-free legacy quizzes',()=>{const history=[{date:'11. 6.',subject:'웹',score:20},{date:'10. 2.',subject:'AI',score:80}];const state=p.materialize(p.importLegacy(p.empty(),{quizHistory:history}));assert.deepEqual(state.quizHistory.map(h=>h.date),history.map(h=>h.date));});
