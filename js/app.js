/* ליגת הניחושים — מונדיאל 2026 · Eshkolot Oranim care home
   Vanilla-JS port of the design prototype: full re-render on state changes,
   targeted updates for text inputs and the 1s countdown tick (to keep focus). */

const CONFIG = {
  adminPin: '2026',
  defaultLang: 'he',
  accent: '#F2B32B',
  hideLocked: false,
  showAdmin: true
};

const state = {
  tab: 'picks',
  name: '',
  picks: {},
  submitted: false,
  toast: '',
  results: {},
  adv: {},
  lang: '',
  adminUnlocked: false,
  pinInput: '',
  pinError: false,
  now: Date.now()
};

const root = document.getElementById('app');
let toastTimer = null;

/* ---------- helpers ---------- */

function esc(s) {
  return String(s == null ? '' : s)
    .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;').replace(/'/g, '&#39;');
}

function lang() { return state.lang || CONFIG.defaultLang; }
function dir() { return lang() === 'en' ? 'ltr' : 'rtl'; }
function t() { return STRINGS[lang()] || STRINGS.he; }

function tName(nm) {
  const L = lang();
  if (L === 'he') return nm;
  return TEAM_T[nm] ? TEAM_T[nm][L] : nm;
}

function badgeHtml(colors, small) {
  const g = 'linear-gradient(135deg,' + colors[0] + ' 0 34%,' + colors[1] + ' 34% 67%,' + colors[2] + ' 67% 100%)';
  return '<span class="badge' + (small ? ' sm' : '') + '" style="background:' + g + '"></span>';
}

function resolved() {
  return resolveMatches(buildMatches(t(), tName), state.results, state.adv, state.now, t(), tName);
}

function score(picks) {
  const res = state.results || {};
  return Object.keys(res).reduce((n, id) => n + (res[id] && picks && picks[id] === res[id] ? 1 : 0), 0);
}

function persistMe() {
  Store.saveMe({ name: state.name, picks: state.picks, submitted: state.submitted });
}

/* Registered participants, with this device's live name/picks overriding its stored row. */
function participants() {
  const reg = Store.loadBoard();
  const myId = Store.deviceId();
  const parts = Object.entries(reg).map(([id, v]) => ({
    name: id === myId && state.name.trim() ? state.name.trim() : (v.name || '—'),
    picks: id === myId ? state.picks : (v.picks || {}),
    isMe: id === myId
  }));
  if (!parts.some(p => p.isMe) && state.name.trim()) {
    parts.push({ name: state.name.trim(), picks: state.picks, isMe: true });
  }
  return parts;
}

function standingsRows() {
  const rows = participants().map(p => ({ name: p.name, pts: score(p.picks), isMe: p.isMe }));
  rows.sort((a, b) => b.pts - a.pts || a.name.localeCompare(b.name, lang()));
  return rows;
}

function cupChampion(all) {
  const rFin = (state.results || {}).fin;
  const finM = all.find(m => m.id === 'fin');
  if (!(rFin && finM && finM.known)) return '';
  return rFin === '1' ? finM.home[0] : rFin === '2' ? finM.away[0] : ((state.adv || {}).fin || '');
}

function countdownFor(m) {
  if (m.locked || !m.lockAt) return null;
  const diff = m.lockAt - state.now;
  if (diff <= 0) return null;
  const s = Math.floor(diff / 1000), d = Math.floor(s / 86400);
  const pad = x => String(x).padStart(2, '0');
  const hms = pad(Math.floor(s % 86400 / 3600)) + ':' + pad(Math.floor(s % 3600 / 60)) + ':' + pad(s % 60);
  return { text: d > 0 ? t().lockIn + d + t().days + hms : t().lockIn + hms, urgent: diff < 3600000 };
}

function openPickCount(all) {
  return all.filter(m => !m.locked && state.picks[m.id]).length;
}

function submitState(all) {
  const count = openPickCount(all);
  const canSubmit = count > 0 && state.name.trim().length > 1;
  const label = !state.name.trim() ? t().enterName :
    count === 0 ? t().pickOne :
    (state.submitted ? t().update : t().send) + count + t().guesses;
  return { count, canSubmit, label };
}

/* ---------- screens ---------- */

function renderPicksScreen(all) {
  const shown = CONFIG.hideLocked ? all.filter(m => !m.locked) : all;
  const S = t();
  const finished = !!cupChampion(all);

  const cards = shown.map(m => {
    const pick = state.picks[m.id];
    const cd = countdownFor(m);
    const dis = m.locked ? ' disabled' : '';
    const btn = (v, cls) => 'class="pick-btn' + (pick === v ? ' selected' : '') + (cls || '') + '" data-action="pick" data-match="' + m.id + '" data-val="' + v + '"' + dis;
    return '' +
      '<div class="match-card' + (m.locked ? ' locked' : '') + '" data-mid="' + m.id + '">' +
        '<div class="match-head">' +
          '<span class="match-round">' + esc(m.round) + '</span>' +
          '<span class="match-date">' + esc(m.date) + '</span>' +
        '</div>' +
        (cd ? '<div class="countdown' + (cd.urgent ? ' urgent' : '') + '" data-countdown="' + m.id + '" dir="' + dir() + '">' + esc(cd.text) + '</div>' : '') +
        '<div class="pick-grid">' +
          '<button ' + btn('1') + '>' + badgeHtml(m.home[1]) +
            '<span class="pick-team">' + esc(tName(m.home[0])) + '</span><span class="pick-num">1</span></button>' +
          '<button ' + btn('X') + '><span class="pick-x">X</span>' +
            '<span class="pick-draw">' + esc(S.draw) + '</span><span class="pick-num">' + esc(S.min90) + '</span></button>' +
          '<button ' + btn('2') + '>' + badgeHtml(m.away[1]) +
            '<span class="pick-team">' + esc(tName(m.away[0])) + '</span><span class="pick-num">2</span></button>' +
        '</div>' +
        (m.note ? '<div class="match-note">' + esc(m.note) + '</div>' : '') +
      '</div>';
  }).join('');

  const sub = submitState(all);
  const shareBtn = (sub.count > 0
    ? '<button class="wa-btn" data-action="share-picks">' + esc(S.shareWa) + '</button>' : '') +
    '<button class="wa-btn" data-action="share-app">' + esc(S.shareApp) + '</button>';

  return '' +
    '<div class="screen-picks">' +
      (finished ? '<div class="finished-banner">' + esc(S.finishedBanner) + '</div>' : '') +
      '<div class="name-card">' +
        '<span class="name-label">' + esc(S.yourName) + '</span>' +
        '<input class="name-input" data-input="name" value="' + esc(state.name) + '" placeholder="' + esc(S.namePh) + '">' +
      '</div>' +
      cards + shareBtn +
    '</div>' +
    '<div class="submit-bar">' +
      '<button class="submit-btn' + (sub.canSubmit ? ' enabled' : '') + '" data-action="submit">' + esc(sub.label) + '</button>' +
    '</div>';
}

/* Per-match cards listing each participant's pick. includeUnlocked=true is the
   admin view (behind the PIN gate) — it also shows picks for open matches. */
function breakdownGroups(all, includeUnlocked) {
  const S = t();
  const parts = participants();
  return all.filter(m => m.known && (includeUnlocked || m.locked)).map(m => {
    const res = (state.results || {})[m.id];
    const prow = parts.filter(p => p.picks && p.picks[m.id]).map(p => {
      const v = p.picks[m.id];
      const label = v === 'X' ? 'X · ' + S.draw : v === '1' ? '1 · ' + tName(m.home[0]) : '2 · ' + tName(m.away[0]);
      const ok = res ? v === res : null;
      const cls = ok === null ? '' : ok ? ' ok' : ' bad';
      return '<div class="breakdown-row"><span class="breakdown-name">' + esc(p.name) + '</span>' +
        '<span class="pick-chip' + cls + '">' + esc(label) + '</span></div>';
    });
    if (!prow.length) return '';
    return '<div class="breakdown-card">' +
      '<div class="breakdown-card-head">' +
        '<span class="breakdown-match">' + esc(tName(m.home[0]) + ' — ' + tName(m.away[0])) + '</span>' +
        '<span class="breakdown-round">' + esc(m.round) + '</span>' +
      '</div>' + prow.join('') + '</div>';
  }).filter(Boolean);
}

function renderBoardScreen(all) {
  const S = t();
  const rows = standingsRows();
  const champ = cupChampion(all);
  const finished = !!champ;

  const champCard = finished && rows.length ? '' +
    '<div class="champ-card">' +
      '<span class="champ-label">' + esc(S.champLabel) + '</span>' +
      '<span class="champ-name">' + esc(rows[0].name) + '</span>' +
      '<span class="champ-sub">' + esc(rows[0].pts + S.champSubA + tName(champ)) + '</span>' +
    '</div>' : '';

  const rowsHtml = rows.map((r, i) => '' +
    '<div class="board-row' + (r.isMe ? ' me' : '') + '">' +
      '<span class="rank' + (i < 3 ? ' r' + (i + 1) : '') + '">' + (i + 1) + '</span>' +
      '<span class="board-name">' + esc(r.name) + '</span>' +
      (r.isMe ? '<span class="you-badge">' + esc(S.youBadge) + '</span>' : '') +
      '<span class="board-pts">' + r.pts + '</span>' +
    '</div>').join('');

  /* Picks are revealed per match only once it locks, to prevent copying. */
  const groups = breakdownGroups(all, false);
  return '' +
    '<div class="screen-board">' +
      '<div class="section-head">' +
        '<span class="section-title">' + esc(S.boardTitle) + '</span>' +
        '<span class="section-sub">' + esc(S.boardSub) + '</span>' +
      '</div>' +
      champCard +
      (rows.length ? rowsHtml : '<div class="empty-card">' + esc(S.boardEmptyText) + '</div>') +
      '<div class="board-footer">' + esc(S.footerA + rows.length + S.footerB) + '</div>' +
      '<button class="wa-btn" style="margin-top:4px" data-action="share-board">' + esc(S.shareWa) + '</button>' +
      '<div class="breakdown-wrap">' +
        '<div class="breakdown-head">' +
          '<span class="breakdown-title">' + esc(S.whoPicked) + '</span>' +
          '<span class="breakdown-note">' + esc(S.revealNote) + '</span>' +
        '</div>' +
        (groups.length ? groups.join('') : '<div class="breakdown-empty">' + esc(S.breakdownEmptyText) + '</div>') +
      '</div>' +
    '</div>';
}

function treeNode(m, isFinal) {
  const r = (state.results || {})[m.id];
  const advSel = (state.adv || {})[m.id];
  const winnerName = r ? (r === '1' ? m.home[0] : r === '2' ? m.away[0] : advSel || null) : null;
  const nameCls = nm =>
    winnerName ? (winnerName === nm ? 'winner' : 'loser') : (m.known ? 'known' : '');
  const meta = winnerName
    ? t().advancedTo + tName(winnerName)
    : (r === 'X' && !advSel ? t().pendingDraw : m.date);
  return '<div class="tree-node' + (isFinal ? ' final' : '') + '">' +
    '<div class="tree-team">' + badgeHtml(m.home[1], true) +
      '<span class="tree-name ' + nameCls(m.home[0]) + '">' + esc(tName(m.home[0])) + '</span></div>' +
    '<div class="tree-team">' + badgeHtml(m.away[1], true) +
      '<span class="tree-name ' + nameCls(m.away[0]) + '">' + esc(tName(m.away[0])) + '</span></div>' +
    '<div class="tree-meta">' + esc(meta) + '</div>' +
  '</div>';
}

function renderTreeScreen(all) {
  const S = t();
  const byId = {};
  all.forEach(m => { byId[m.id] = m; });
  const champ = cupChampion(all);
  const champChip = champ ? '' +
    '<div class="tree-champ-chip">' +
      '<span class="tree-champ-label">' + esc(S.worldChamp) + '</span>' +
      '<span class="tree-champ-name">' + esc(tName(champ)) + '</span>' +
    '</div>' : '';

  return '' +
    '<div class="screen-tree">' +
      '<div class="section-head">' +
        '<span class="section-title">' + esc(S.treeTitle) + '</span>' +
        '<span class="section-sub">' + esc(S.treeSub) + '</span>' +
      '</div>' +
      '<div class="tree-scroll"><div class="tree-cols">' +
        '<div class="tree-col"><div class="tree-col-title">' + esc(S.colQF) + '</div>' +
          '<div class="tree-col-body">' + ['qf1', 'qf2', 'qf3', 'qf4'].map(id => treeNode(byId[id])).join('') + '</div></div>' +
        '<div class="tree-col"><div class="tree-col-title">' + esc(S.colSF) + '</div>' +
          '<div class="tree-col-body">' + ['sf1', 'sf2'].map(id => treeNode(byId[id])).join('') + '</div></div>' +
        '<div class="tree-col"><div class="tree-col-title gold">' + esc(S.colFin) + '</div>' +
          '<div class="tree-col-body center">' + treeNode(byId.fin, true) + champChip + '</div></div>' +
      '</div></div>' +
      '<div class="tree-hint">' + esc(S.treeHint) + '</div>' +
    '</div>';
}

function renderPinScreen() {
  const S = t();
  return '' +
    '<div class="screen-pin">' +
      '<div class="pin-glyph">#</div>' +
      '<div class="pin-title">' + esc(S.adminArea) + '</div>' +
      '<div class="pin-hint">' + esc(S.adminPinHint) + '</div>' +
      '<input class="pin-input" data-input="pin" type="password" inputmode="numeric" maxlength="6" value="' + esc(state.pinInput) + '" placeholder="••••">' +
      (state.pinError ? '<div class="pin-error">' + esc(S.wrongPin) + '</div>' : '') +
      '<button class="pin-enter" data-action="try-pin">' + esc(S.enter) + '</button>' +
    '</div>';
}

function renderAdminScreen(all) {
  const S = t();
  const cards = all.filter(m => m.known).map(m => {
    const r = (state.results || {})[m.id];
    const sel = (state.adv || {})[m.id];
    const btn = v => 'class="pick-btn' + (r === v ? ' res-selected' : '') + '" data-action="result" data-match="' + m.id + '" data-val="' + v + '"';
    const advRow = r === 'X' ? '' +
      '<div class="adv-wrap">' +
        '<span class="adv-label">' + esc(S.drawWho) + '</span>' +
        '<div class="adv-row">' +
          '<button class="adv-btn' + (sel === m.home[0] ? ' on' : '') + '" data-action="adv" data-match="' + m.id + '" data-val="' + esc(m.home[0]) + '">' + esc(S.advancedWord + tName(m.home[0])) + '</button>' +
          '<button class="adv-btn' + (sel === m.away[0] ? ' on' : '') + '" data-action="adv" data-match="' + m.id + '" data-val="' + esc(m.away[0]) + '">' + esc(S.advancedWord + tName(m.away[0])) + '</button>' +
        '</div>' +
      '</div>' : '';
    return '' +
      '<div class="match-card">' +
        '<div class="match-head">' +
          '<span class="match-round admin">' + esc(m.round) + '</span>' +
          '<span class="match-date">' + esc(m.date) + '</span>' +
        '</div>' +
        '<div class="pick-grid">' +
          '<button ' + btn('1') + '>' + badgeHtml(m.home[1]) +
            '<span class="pick-team">' + esc(tName(m.home[0])) + '</span><span class="pick-num">1</span></button>' +
          '<button ' + btn('X') + '><span class="pick-x">X</span>' +
            '<span class="pick-draw">' + esc(S.draw) + '</span><span class="pick-num">' + esc(S.min90) + '</span></button>' +
          '<button ' + btn('2') + '>' + badgeHtml(m.away[1]) +
            '<span class="pick-team">' + esc(tName(m.away[0])) + '</span><span class="pick-num">2</span></button>' +
        '</div>' +
        advRow +
      '</div>';
  }).join('');

  const groups = breakdownGroups(all, true);
  const picksSection = '' +
    '<div class="breakdown-wrap">' +
      '<div class="breakdown-head">' +
        '<span class="breakdown-title">' + esc(S.adminPicksTitle) + '</span>' +
        '<span class="breakdown-note">' + esc(S.adminPicksNote) + '</span>' +
      '</div>' +
      (groups.length ? groups.join('') : '<div class="breakdown-empty">' + esc(S.adminPicksEmpty) + '</div>') +
    '</div>';

  return '' +
    '<div class="screen-admin">' +
      '<div class="admin-info">' + esc(S.adminInfo) + '</div>' +
      cards +
      '<button class="reset-btn" data-action="reset-results">' + esc(S.resetResults) + '</button>' +
      picksSection +
    '</div>';
}

/* ---------- full render ---------- */

function render() {
  const S = t();
  const all = resolved();
  const L = lang();

  document.documentElement.lang = L;
  document.documentElement.dir = dir();
  document.title = S.title;

  const langBtn = (l, label) =>
    '<button class="lang-btn' + (L === l ? ' active' : '') + '" data-action="lang" data-val="' + l + '">' + label + '</button>';
  const tabBtn = (tab, label) =>
    '<button class="tab-btn' + (state.tab === tab ? ' active' : '') + '" data-action="tab" data-val="' + tab + '">' + esc(label) + '</button>';

  let screen;
  if (state.tab === 'board') screen = renderBoardScreen(all);
  else if (state.tab === 'tree') screen = renderTreeScreen(all);
  else if (state.tab === 'admin') screen = state.adminUnlocked ? renderAdminScreen(all) : renderPinScreen();
  else screen = renderPicksScreen(all);

  root.innerHTML = '' +
    '<div class="lang-row">' + langBtn('he', 'עברית') + langBtn('ar', 'العربية') + langBtn('en', 'EN') + '</div>' +
    '<header class="app-header">' +
      '<div class="logo-tile"><img src="assets/logo.jpg" alt="אשכולות אורנים"></div>' +
      '<div class="head-text">' +
        '<div class="app-title">' + esc(S.title) + '</div>' +
        '<div class="app-subtitle">' + esc(S.subtitle) + '</div>' +
      '</div>' +
    '</header>' +
    '<div class="prize-banner">' +
      '<div class="prize-coin">₪</div>' +
      '<div class="prize-text">' +
        '<span class="prize-title">' + esc(S.prizeTitle) + '</span>' +
        '<span class="prize-sub">' + esc(S.prizeSub) + '</span>' +
      '</div>' +
    '</div>' +
    '<div class="tab-row">' +
      tabBtn('picks', S.tabPicks) + tabBtn('board', S.tabBoard) + tabBtn('tree', S.tabTree) +
      (CONFIG.showAdmin ? tabBtn('admin', S.tabAdmin) : '') +
    '</div>' +
    screen +
    (state.toast ? '<div class="toast">' + esc(state.toast) + '</div>' : '');
}

/* ---------- targeted updates (keep input focus, 1s tick) ---------- */

function updateSubmitBar() {
  const btn = root.querySelector('[data-action="submit"]');
  if (!btn) return;
  const sub = submitState(resolved());
  btn.textContent = sub.label;
  btn.classList.toggle('enabled', sub.canSubmit);
}

function tick() {
  state.now = Date.now();
  const all = resolved();
  let needsFullRender = false;
  root.querySelectorAll('[data-countdown]').forEach(el => {
    const m = all.find(x => x.id === el.getAttribute('data-countdown'));
    const cd = m && countdownFor(m);
    if (!cd) { needsFullRender = true; return; } // crossed the lock boundary
    el.textContent = cd.text;
    el.classList.toggle('urgent', cd.urgent);
  });
  if (needsFullRender) render();
}

/* ---------- actions ---------- */

function showToast(msg) {
  state.toast = msg;
  render();
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => { state.toast = ''; render(); }, 2600);
}

function tryPin() {
  if (state.pinInput === String(CONFIG.adminPin)) {
    state.adminUnlocked = true; state.pinInput = ''; state.pinError = false;
  } else {
    state.pinError = true; state.pinInput = '';
  }
  render();
}

function saveResultsState(results, adv) {
  state.results = results;
  state.adv = adv;
  Store.saveResults(results, adv);
}

function waShare(text) {
  try { window.open('https://wa.me/?text=' + encodeURIComponent(text), '_blank'); } catch (e) {}
}

function sharePicksText(all) {
  const S = t();
  const pickLabelFor = m => {
    const v = state.picks[m.id];
    return v === 'X' ? 'X (' + S.draw + ')' : v === '1' ? tName(m.home[0]) : tName(m.away[0]);
  };
  const lines = all.filter(m => state.picks[m.id])
    .map(m => '- ' + tName(m.home[0]) + ' / ' + tName(m.away[0]) + ': ' + pickLabelFor(m)).join('\n');
  return S.title + '\n' + (state.name.trim() ? state.name.trim() + ' — ' : '') + S.shareMyPicks + '\n' + lines + '\n\n' + S.prizeTitle;
}

function shareAppText() {
  const S = t();
  return '⚽ ' + S.title + ' — ' + S.subtitle + ' 🏆\n' + S.inviteText + '\n' + location.href;
}

function shareBoardText() {
  const S = t();
  return S.title + '\n' + S.boardTitle + ':\n' +
    standingsRows().map((p, i) => (i + 1) + '. ' + p.name + ' — ' + p.pts).join('\n');
}

root.addEventListener('click', e => {
  const el = e.target.closest('[data-action]');
  if (!el || el.disabled) return;
  const action = el.getAttribute('data-action');
  const mid = el.getAttribute('data-match');
  const val = el.getAttribute('data-val');
  const all = resolved();

  switch (action) {
    case 'lang':
      state.lang = val;
      Store.saveLang(val);
      render();
      break;
    case 'tab':
      state.tab = val;
      render();
      break;
    case 'pick': {
      const m = all.find(x => x.id === mid);
      if (!m || m.locked) return;
      state.picks = { ...state.picks, [mid]: state.picks[mid] === val ? undefined : val };
      persistMe();
      render();
      break;
    }
    case 'submit': {
      const sub = submitState(all);
      if (!sub.canSubmit) return;
      Store.upsertParticipant(Store.deviceId(), state.name.trim(), state.picks);
      state.submitted = true;
      persistMe();
      showToast(t().toastSaved);
      break;
    }
    case 'share-picks':
      waShare(sharePicksText(all));
      break;
    case 'share-board':
      waShare(shareBoardText());
      break;
    case 'share-app':
      waShare(shareAppText());
      break;
    case 'try-pin':
      tryPin();
      break;
    case 'result': {
      const cur = (state.results || {})[mid];
      const results = { ...state.results, [mid]: cur === val ? undefined : val };
      const adv = { ...state.adv };
      if (results[mid] !== 'X') delete adv[mid];
      saveResultsState(results, adv);
      render();
      break;
    }
    case 'adv': {
      const adv = { ...state.adv, [mid]: (state.adv || {})[mid] === val ? undefined : val };
      saveResultsState({ ...state.results }, adv);
      render();
      break;
    }
    case 'reset-results':
      saveResultsState({}, {});
      render();
      break;
  }
});

root.addEventListener('input', e => {
  const el = e.target.closest('[data-input]');
  if (!el) return;
  if (el.getAttribute('data-input') === 'name') {
    state.name = el.value;
    persistMe();
    updateSubmitBar();
  } else if (el.getAttribute('data-input') === 'pin') {
    const clean = el.value.replace(/\D/g, '');
    if (clean !== el.value) el.value = clean;
    state.pinInput = clean;
    if (state.pinError) {
      state.pinError = false;
      const err = root.querySelector('.pin-error');
      if (err) err.remove();
    }
  }
});

root.addEventListener('keydown', e => {
  const el = e.target.closest('[data-input="pin"]');
  if (el && e.key === 'Enter') tryPin();
});

/* ---------- init ---------- */

(function init() {
  const me = Store.loadMe();
  state.name = me.name || '';
  state.picks = me.picks || {};
  state.submitted = !!me.submitted;
  const r = Store.loadResults();
  state.results = r.results;
  state.adv = r.adv;
  state.lang = Store.loadLang();
  render();
  setInterval(tick, 1000);
})();
