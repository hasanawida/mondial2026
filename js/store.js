/* Persistence layer.
   The prototype (and this build) stores everything in localStorage PER DEVICE.
   Production must swap these functions for a shared backend (Firebase/Supabase/
   Google Sheet) so all 30 employees see one live state — see README. The rest of
   the app only talks to this module, so only this file needs to change. */

const KEYS = {
  me: 'wc26-oranim',            // { name, picks, submitted }
  board: 'wc26-oranim-board',   // { [deviceId]: { name, picks } }
  results: 'wc26-oranim-results', // { results: {matchId:'1'|'X'|'2'}, adv: {matchId: team} }
  lang: 'wc26-oranim-lang',
  id: 'wc26-oranim-id'
};

const Store = {
  loadMe() {
    try { return JSON.parse(localStorage.getItem(KEYS.me) || '{}'); } catch (e) { return {}; }
  },
  saveMe(me) {
    try { localStorage.setItem(KEYS.me, JSON.stringify(me)); } catch (e) {}
  },
  loadResults() {
    try {
      const r = JSON.parse(localStorage.getItem(KEYS.results) || '{}');
      return r && r.results ? { results: r.results, adv: r.adv || {} } : { results: r || {}, adv: {} };
    } catch (e) { return { results: {}, adv: {} }; }
  },
  saveResults(results, adv) {
    try { localStorage.setItem(KEYS.results, JSON.stringify({ results, adv })); } catch (e) {}
  },
  loadBoard() {
    try { return JSON.parse(localStorage.getItem(KEYS.board) || '{}'); } catch (e) { return {}; }
  },
  upsertParticipant(id, name, picks) {
    const b = this.loadBoard();
    b[id] = { name, picks, submittedAt: b[id] && b[id].submittedAt ? b[id].submittedAt : new Date().toISOString() };
    try { localStorage.setItem(KEYS.board, JSON.stringify(b)); } catch (e) {}
  },
  loadLang() {
    try { return localStorage.getItem(KEYS.lang) || ''; } catch (e) { return ''; }
  },
  saveLang(lang) {
    try { localStorage.setItem(KEYS.lang, lang); } catch (e) {}
  },
  deviceId() {
    try {
      let id = localStorage.getItem(KEYS.id);
      if (!id) { id = 'u' + Math.random().toString(36).slice(2, 10); localStorage.setItem(KEYS.id, id); }
      return id;
    } catch (e) { return 'me'; }
  }
};
