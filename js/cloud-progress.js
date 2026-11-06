(function () {
  'use strict';
  const core=window.VibeProgress, APP='vibe-glossary', PROJECT='lkokgqqhsppezflqkbgx';
  const GUEST='vibe_progress_state', LEGACY='vibe_guest_state';
  let client, bridge, user=null, doc=core.empty(), previous=core.snapshot(), ready=false, running=false, pending=false, timer, generation=0;
  const key=()=>user?`vibe_progress_user_${user.id}`:GUEST;
  const docKey=()=>`vibe_cloud_events_v2_${user.id}`;
  const uuid=()=>crypto.randomUUID();
  const readJSON=k=>{const raw=localStorage.getItem(k);return raw?JSON.parse(raw):null;};
  const status=(text)=>{document.getElementById('vibe-cloud-status').textContent=text;};
  function persist() {
    const cached=readJSON(docKey());if(cached)doc=core.merge(doc,cached);
    localStorage.setItem(docKey(),JSON.stringify(doc));
  }
  function apply() {
    previous=core.materialize(doc);
    localStorage.setItem(key(),JSON.stringify(previous));
    bridge.apply(previous);
  }
  function queue() {pending=true;clearTimeout(timer);timer=setTimeout(()=>void sync(),1000);}
  function saved(payload) {
    if(!user || !ready)return;
    try {
      const updated=core.capture(doc,previous,payload,uuid);
      const changed=core.canonical(updated)!==core.canonical(doc);
      doc=updated;previous=core.snapshot(payload);persist();if(changed)queue();
    } catch {status('기기 저장 실패 · 이 화면을 닫기 전에 다시 동기화해 주세요.');}
  }
  async function sync() {
    if(!user || !ready || running){if(user)pending=true;return;}
    if(!navigator.onLine){status('오프라인 · 이 기기에 저장됨');return;}
    running=true;pending=false;const epoch=generation, uid=user.id;
    status('동기화 중');
    try {
      let committed=false;
      for(let attempt=0;attempt<5;attempt++) {
        const controller=new AbortController(), timeout=setTimeout(()=>controller.abort(),15000);
        try {
          const {data,error}=await client.from('app_progress').select('progress,updated_at').eq('app_id',APP).eq('user_id',uid).abortSignal(controller.signal).maybeSingle();
          if(epoch!==generation)return;
          if(error)throw error;
          if(data)doc=core.merge(doc,core.validate(data.progress));
          persist();
          // Include changes made while the read was in flight. Write only if the
          // server version still matches, so another device cannot be overwritten.
          const write=JSON.parse(JSON.stringify(doc));
          const updatedAt=new Date(Math.max(Date.now(),Date.parse(data?.updated_at || '')+1 || 0)).toISOString();
          const row={app_id:APP,user_id:uid,progress:write,updated_at:updatedAt};
          const query=data?client.from('app_progress').update(row).eq('app_id',APP).eq('user_id',uid).eq('updated_at',data.updated_at):client.from('app_progress').insert(row);
          const result=await query.select('updated_at').abortSignal(controller.signal);
          if(epoch!==generation)return;
          if(result.error?.code==='23505')continue;
          if(result.error)throw result.error;
          if(!result.data?.length)continue;
          persist();apply();committed=true;break;
        } finally {clearTimeout(timeout);}
      }
      if(!committed)throw Error('동시 저장 충돌');
      if(epoch===generation)status('동기화 완료');
    } catch {if(epoch===generation)status('동기화 보류 · 기기 기록 유지 · 다시 동기화해 주세요.');}
    finally {running=false;if(pending && epoch===generation){pending=false;queue();}}
  }
  function renderAccount() {
    document.getElementById('vibe-auth-open').textContent=user?'내 계정':'로그인';
    document.getElementById('vibe-account-name').textContent=user?.email || '기기에서 학습 중';
    document.getElementById('vibe-google-login').hidden=!!user;
    document.getElementById('vibe-cloud-sync').hidden=!user;
    document.getElementById('vibe-logout').hidden=!user;
    document.getElementById('vibe-import-guest').hidden=!user || !(localStorage.getItem(GUEST)||localStorage.getItem(LEGACY));
  }
  function activate(next) {
    if(ready && user?.id===next?.id)return;
    if(ready && user?.id!==next?.id){location.reload();return;}
    user=next;generation++;
    if(user) {
      const cached=readJSON(docKey());
      doc=cached?core.validate(cached):core.empty();
      // Account caches never fall back to the guest record or another account.
      if(!cached) {const account=readJSON(key());if(account)doc=core.importLegacy(doc,account);}
      ready=true;persist();apply();renderAccount();void sync();
    } else {ready=true;renderAccount();status('이 기기에 저장됨');}
  }
  async function login() {
    try {
      if(!client)throw Error('연결 준비 중');
      const {error}=await client.auth.signInWithOAuth({provider:'google',options:{redirectTo:new URL('./',location.href).href}});
      if(error)throw error;
    } catch {status('로그인 연결에 실패했습니다. 기기 기록은 유지됩니다.');}
  }
  async function logout() {
    clearTimeout(timer);
    if(user)persist();
    const {error}=await client.auth.signOut({scope:'local'});
    if(error){status('로그아웃 확인이 필요합니다. 다시 시도해 주세요.');return;}
    location.reload();
  }
  function importGuest() {
    if(!user || !ready)return;
    const raw=readJSON(GUEST)||readJSON(LEGACY);if(!raw)return;
    if(!window.confirm('이 기기에 남아 있는 게스트 오답·클립·퀴즈 기록을 현재 계정에 합칠까요? 다른 사람이 사용한 기록인지 먼저 확인해 주세요. 원래 기기 기록은 남겨 둡니다.'))return;
    try {doc=core.importLegacy(doc,raw);persist();apply();queue();status('기기 기록을 합쳤습니다. 동기화 중');}
    catch {status('기기 기록을 읽지 못했습니다. 원본은 보존됩니다.');}
  }
  function init(appBridge) {
    bridge=appBridge;
    document.getElementById('vibe-auth-open').onclick=()=>document.getElementById('vibe-account-dialog').showModal();
    document.getElementById('vibe-auth-close').onclick=()=>document.getElementById('vibe-account-dialog').close();
    document.getElementById('vibe-google-login').onclick=()=>void login();
    document.getElementById('vibe-cloud-sync').onclick=()=>void sync();
    document.getElementById('vibe-logout').onclick=()=>void logout();
    document.getElementById('vibe-import-guest').onclick=importGuest;
    try {
      client=window.supabase.createClient(`https://${PROJECT}.supabase.co`,'sb_publishable_kdFzHxEd7IoUvNlgdsIx9Q_31k-HxHF',{
        auth:{storageKey:`vibe-${PROJECT}-auth-v1`,persistSession:true,autoRefreshToken:true,detectSessionInUrl:true}});
      client.auth.onAuthStateChange((_event,session)=>setTimeout(()=>{
        try {activate(session?.user || null);}catch {ready=false;status('기기 기록을 읽지 못해 계정 저장을 멈췄습니다. 원본 기록은 유지됩니다.');}
      },0));
      void client.auth.getSession().then(({data,error})=>{if(error)throw error;activate(data.session?.user || null);}).catch(()=>{
        ready=false;status('로그인 상태를 확인하지 못했습니다. 새로고침해 주세요.');
      });
    } catch {ready=true;status('오프라인 · 게스트 기록은 이 기기에 저장됩니다.');document.getElementById('vibe-google-login').disabled=true;}
    addEventListener('online',()=>void sync());
    addEventListener('offline',()=>{if(user)status('오프라인 · 이 기기에 저장됨');});
    addEventListener('focus',()=>{if(user)void sync();});
    addEventListener('storage',e=>{
      if(user && e.key===docKey() && e.newValue) {
        try {doc=core.merge(doc,JSON.parse(e.newValue));apply();queue();}catch {status('다른 탭의 기록을 확인해 주세요. 기존 기록은 보존됩니다.');}
      }
    });
  }
  // Prevent interaction from being recorded against the previous/guest account
  // while the initial authentication state is unresolved.
  document.addEventListener('click',e=>{
    if(!ready && e.target.closest('main,nav,#vibe-google-login,#vibe-import-guest')) {e.preventDefault();e.stopImmediatePropagation();}
  },true);
  window.VibeCloud={init,saved,storageKey:key};
})();
