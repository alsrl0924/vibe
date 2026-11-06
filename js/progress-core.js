(function (root) {
  'use strict';
  const copy = x => JSON.parse(JSON.stringify(x));
  const canonical = x => Array.isArray(x) ? '[' + x.map(canonical).join(',') + ']' : x && typeof x === 'object' ? '{' + Object.keys(x).sort().map(k => JSON.stringify(k) + ':' + canonical(x[k])).join(',') + '}' : JSON.stringify(x);
  const unique = values => [...new Set(values)];
  const integer = x => Math.max(0, Number.isFinite(Number(x)) ? Math.floor(Number(x)) : 0);
  function snapshot(x = {}) {
    const wrongMap = {};
    for (const [id, count] of Object.entries(x.wrongMap || {})) if (/^[1-9]\d*$/.test(id) && integer(count)) wrongMap[id] = integer(count);
    return { wrongMap, clippedList: unique([...(x.clippedList || []), ...(x.bookmarkedList || [])]).filter(id => Number.isInteger(id) && id > 0),
      streakDays: integer(x.streakDays), lastStudyDate: /^\d{4}-\d{2}-\d{2}$/.test(x.lastStudyDate || '') ? x.lastStudyDate : '',
      quizHistory: (x.quizHistory || []).map(h => ({...h, date: String(h.date || ''), subject: String(h.subject || ''), score: integer(h.score), total: integer(h.total), correct: integer(h.correct)})),
      earnedBadgeList: unique(x.earnedBadgeList || []).filter(id => typeof id === 'string') };
  }
  // Legacy arrays have no IDs. Retain the maximum multiplicity of each complete
  // record, rather than dropping identical quizzes or counting an import twice.
  function histories(a, b) {
    const result = copy(a), have = new Map(), seen = new Map();
    a.forEach(h => {const k = canonical(h); have.set(k, (have.get(k) || 0) + 1);});
    b.forEach(h => {const k = canonical(h), n = (seen.get(k) || 0) + 1; seen.set(k,n); if(n > (have.get(k) || 0)) result.push(copy(h));});
    return result;
  }
  function mergeBase(a, b) {
    a = snapshot(a); b = snapshot(b);
    const wrongMap = {...a.wrongMap};
    for (const [id,n] of Object.entries(b.wrongMap)) wrongMap[id] = Math.max(wrongMap[id] || 0,n);
    const daily = a.lastStudyDate > b.lastStudyDate ? a : b.lastStudyDate > a.lastStudyDate ? b : {lastStudyDate:a.lastStudyDate,streakDays:Math.max(a.streakDays,b.streakDays)};
    return {wrongMap,clippedList:unique([...a.clippedList,...b.clippedList]).sort((x,y)=>x-y),streakDays:daily.streakDays,lastStudyDate:daily.lastStudyDate,
      // Old records have no absolute timestamp: keep their original display
      // order instead of pretending a lexical sort is chronological.
      quizHistory:histories(a.quizHistory,b.quizHistory),earnedBadgeList:unique([...a.earnedBadgeList,...b.earnedBadgeList]).sort()};
  }
  const empty = () => ({version:2,base:snapshot(),events:{}});
  function validate(doc) {
    if(!doc || doc.version !== 2 || !doc.base || !doc.events || typeof doc.events !== 'object' || Array.isArray(doc.events)) throw Error('지원하지 않는 기록 형식입니다. 기존 기록은 보존됩니다.');
    for(const [id,e] of Object.entries(doc.events)) {
      if(!id || !e || !Number.isFinite(e.at) || !['wrong','clip','quiz','badge','day'].includes(e.kind)) throw Error('학습 기록 형식을 확인해 주세요.');
      if(['wrong','clip'].includes(e.kind) && (!Number.isInteger(e.term) || e.term < 1)) throw Error('문항 기록 오류');
      if(e.kind === 'wrong' && !Number.isInteger(e.delta)) throw Error('오답 기록 오류');
      if(e.kind === 'clip' && typeof e.value !== 'boolean') throw Error('클립 기록 오류');
      if(e.kind === 'quiz' && (!e.value || typeof e.value !== 'object')) throw Error('퀴즈 기록 오류');
      if(e.kind === 'badge' && typeof e.value !== 'string') throw Error('배지 기록 오류');
      if(e.kind === 'day' && (!/^\d{4}-\d{2}-\d{2}$/.test(e.date) || !Number.isInteger(e.streak))) throw Error('출석 기록 오류');
    }
    return doc;
  }
  function merge(a, b) {
    validate(a); validate(b);
    const events = {...a.events};
    for(const [id,e] of Object.entries(b.events)) {
      if(Object.hasOwn(events,id) && canonical(events[id]) !== canonical(e)) throw Error('기록 충돌이 있습니다. 두 기록을 보존하고 동기화를 중단했습니다.');
      Object.defineProperty(events,id,{value:copy(e),enumerable:true,writable:true,configurable:true});
    }
    return {version:2,base:mergeBase(a.base,b.base),events};
  }
  function materialize(doc) {
    validate(doc);
    const s = snapshot(doc.base), clips = new Set(s.clippedList), badges = new Set(s.earnedBadgeList), quizzes=[];
    Object.entries(doc.events).sort(([ai,a],[bi,b])=>a.at-b.at || ai.localeCompare(bi)).forEach(([id,e])=>{
      if(e.kind === 'wrong') {const n=Math.max(0,(s.wrongMap[e.term] || 0)+e.delta); if(n)s.wrongMap[e.term]=n; else delete s.wrongMap[e.term];}
      if(e.kind === 'clip') {if(e.value)clips.add(e.term);else clips.delete(e.term);}
      if(e.kind === 'badge')badges.add(e.value);
      if(e.kind === 'quiz')quizzes.push({...e.value,id:e.value.id || id});
      if(e.kind === 'day' && e.date >= s.lastStudyDate) {s.streakDays=e.date===s.lastStudyDate?Math.max(s.streakDays,e.streak):e.streak;s.lastStudyDate=e.date;}
    });
    s.clippedList=[...clips].sort((a,b)=>a-b);s.earnedBadgeList=[...badges].sort();s.quizHistory=[...quizzes.reverse(),...s.quizHistory];
    return snapshot(s);
  }
  function capture(doc, before, after, uuid, now = Date.now()) {
    validate(doc); before=snapshot(before);after=snapshot(after);const result=copy(doc);
    const add=e=>{result.events[uuid()]={...e,at:now};};
    for(const id of unique([...Object.keys(before.wrongMap),...Object.keys(after.wrongMap)])) {
      const delta=(after.wrongMap[id] || 0)-(before.wrongMap[id] || 0);if(delta)add({kind:'wrong',term:Number(id),delta});
    }
    for(const term of unique([...before.clippedList,...after.clippedList])) {
      const value=after.clippedList.includes(term);if(value!==before.clippedList.includes(term))add({kind:'clip',term,value});
    }
    const oldCounts=new Map(); before.quizHistory.forEach(h=>{const k=canonical(h);oldCounts.set(k,(oldCounts.get(k)||0)+1);});
    for(const h of [...after.quizHistory].reverse()) {const k=canonical(h), n=oldCounts.get(k)||0;if(n)oldCounts.set(k,n-1);else add({kind:'quiz',value:h});}
    after.earnedBadgeList.filter(id=>!before.earnedBadgeList.includes(id)).forEach(value=>add({kind:'badge',value}));
    if(after.lastStudyDate && (before.lastStudyDate!==after.lastStudyDate || before.streakDays!==after.streakDays))add({kind:'day',date:after.lastStudyDate,streak:after.streakDays});
    return result;
  }
  const api={empty,snapshot,canonical,validate,merge,materialize,capture,importLegacy:(doc,raw)=>merge(doc,{version:2,base:snapshot(raw),events:{}})};
  if(typeof module !== 'undefined' && module.exports)module.exports=api;else root.VibeProgress=api;
})(typeof globalThis !== 'undefined' ? globalThis : this);
