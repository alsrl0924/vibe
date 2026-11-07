(function (root) {
  'use strict';
  const PROJECT = 'lkokgqqhsppezflqkbgx';
  const authKey = (project = PROJECT) => `sb-${project}-auth-token`;
  const markerKey = (project = PROJECT) => `study-shared-auth-${project}-migrated-v1`;
  function session(raw) {
    if (!raw) return null;
    try {
      const value = JSON.parse(raw);
      return typeof value?.user?.id === 'string' && typeof value.access_token === 'string' && typeof value.refresh_token === 'string' ? value : null;
    } catch { return null; }
  }
  function belongsToProject(value, project) {
    try {
      const payload = JSON.parse(atob(value.access_token.split('.')[1].replace(/-/g, '+').replace(/_/g, '/')));
      // Routing/migration validation only; the SDK and database verify identity.
      return payload.iss === `https://${project}.supabase.co/auth/v1`;
    } catch { return false; }
  }
  function prepare(storage, project = PROJECT) {
    const key = authKey(project);
    const existing = storage.getItem(key);
    if (existing !== null) {
      storage.setItem(markerKey(project), '1');
      return;
    }
    if (storage.getItem(markerKey(project))) return;
    const candidates = [`linux-master-${project}-auth-v1`, `vibe-${project}-auth-v1`]
      .map(key => ({raw:storage.getItem(key)}))
      .map(item => ({...item,value:session(item.raw)}))
      .filter(item => item.value && belongsToProject(item.value, project));
    // Record the one-time decision even when signed out or old accounts differ.
    // Otherwise logging out could resurrect a leftover legacy login next visit.
    storage.setItem(markerKey(project), '1');
    const owners = new Set(candidates.map(item => item.value.user.id));
    if (owners.size !== 1) return;
    candidates.sort((a,b) => (Number(b.value.expires_at) || 0) - (Number(a.value.expires_at) || 0));
    if (storage.getItem(key) === null) storage.setItem(key, candidates[0].raw);
  }
  function owner(storage, project = PROJECT) {
    prepare(storage, project);
    return session(storage.getItem(authKey(project)))?.user.id || null;
  }
  function scopedKey(base, userId) { return userId ? `${base}:user:${userId}` : base; }
  const api = {PROJECT,authKey,markerKey,prepare,owner,scopedKey};
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  else root.StudySharedAuth = api;
})(typeof globalThis !== 'undefined' ? globalThis : this);
