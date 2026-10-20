// Friend Garden: the screens, and what the buttons do.

import { plantSVG, KINDS, kindName, WOBBLE_DEFS, rng } from './plants.js';
import * as L from './logic.js';
import { load, save, storage, backupJSON, readBackup, DEFAULT_GROUPS, emptyState } from './store.js';
import { sampleFriends } from './sample.js';
import { icon, skySVG, fireflies, wateringCan, seedPacket } from './scene.js';

const $ = (sel, el = document) => el.querySelector(sel);
const $$ = (sel, el = document) => [...el.querySelectorAll(sel)];
const esc = (s) => String(s ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]);
const reduced = () => matchMedia('(prefers-reduced-motion: reduce)').matches;
const wait = (ms) => new Promise((r) => setTimeout(r, ms));
const plural = (n, one, many) => (n === 1 ? one : many.replace('#', n));

let state = load();
let today = L.todayISO();
const view = $('#view');
const mqDark = matchMedia('(prefers-color-scheme: dark)');
const ui = { justPlanted: null };

const commit = () => save(state);
const dusk = () => state.settings.theme === 'dusk' || (state.settings.theme === 'auto' && mqDark.matches);
const friendById = (id) => state.friends.find((f) => f.id === id);
const groupName = (id) => (state.groups.find((g) => g.id === id) || {}).name || '';
const hasSample = () => state.friends.some((f) => f.sample);
const friendHref = (fr) => `#/friend/${encodeURIComponent(fr.id)}`;

function plantOf(fr, label, o = {}) {
  return plantSVG({ kind: fr.plant, stage: L.stage(fr), mood: L.mood(fr, today), seed: fr.id, dusk: dusk(), dew: L.dewy(fr, today), label, crop: true, ...o });
}

// Every plant sways a little differently in the breeze.
function swayStyle(id) {
  const r = rng(`sway${id}`);
  return `--sway:${(5.5 + r() * 3).toFixed(2)}s;--sway-delay:-${(r() * 6).toFixed(2)}s;--tilt:${((r() - 0.5) * 5).toFixed(1)}deg`;
}

function lastLine(fr) {
  const last = L.lastTouch(fr);
  const days = L.daysSince(fr, today);
  if (!last) return `Not in touch yet. Planted ${L.ago(days)}.`;
  return `Last in touch ${L.ago(days)}, ${L.howOf(last.how).past}.`;
}

// ---------------------------------------------------------------- routes

function route() {
  const h = location.hash.replace(/^#\/?/, '');
  const [path, query] = h.split('?');
  const parts = path.split('/').filter(Boolean);
  return { name: parts[0] || 'garden', id: parts[1] ? decodeURIComponent(parts[1]) : null, q: new URLSearchParams(query || '') };
}

function render(nav = false) {
  today = L.todayISO();
  const r = route();
  let html, title, tab = r.name;
  if (r.name === 'today') [html, title] = [todayView(), 'Today'];
  else if (r.name === 'friend') {
    const fr = friendById(r.id);
    [html, title] = fr ? [friendView(fr), fr.name] : [missingView(), 'Not here'];
    tab = 'garden';
  } else if (r.name === 'add') [html, title] = [formView(null, r.q), 'Add a friend'];
  else if (r.name === 'edit') {
    const fr = friendById(r.id);
    [html, title] = fr ? [formView(fr, r.q), `Edit ${fr.name}`] : [missingView(), 'Not here'];
    tab = 'garden';
  } else if (r.name === 'settings') [html, title] = [settingsView(), 'Settings'];
  else [html, title, tab] = [gardenView(), '', 'garden'];
  view.innerHTML = html;
  view.dataset.screen = r.name;
  document.title = title ? `${title} · Friend Garden` : 'Friend Garden';
  for (const a of $$('.tabs a')) {
    if (a.dataset.tab === tab) a.setAttribute('aria-current', 'page');
    else a.removeAttribute('aria-current');
  }
  if (nav) {
    window.scrollTo(0, 0);
    const h = view.querySelector('h1');
    if (h) h.focus({ preventScroll: true });
  }
  if (r.name === 'garden' && ui.justPlanted) {
    const el = view.querySelector(`[data-plant="${CSS.escape(ui.justPlanted)}"]`);
    ui.justPlanted = null;
    if (el) {
      el.classList.add('planted');
      el.scrollIntoView({ block: 'center', behavior: reduced() ? 'auto' : 'smooth' });
    }
  }
}

function go(hash) {
  if (location.hash === hash) render(true);
  else location.hash = hash;
}

// ---------------------------------------------------------------- garden

function storageNote() {
  if (storage.ok) return '';
  return `<p class="note-bar">${icon('drop')}This browser isn't keeping anything right now (a private window, maybe), so this garden lasts only until you close the tab.</p>`;
}

function sampleNote() {
  if (!hasSample()) return '';
  return `<div class="note-bar sample-bar"><p>This is a sample garden. Everyone in it is made up.</p><button class="btn small" data-act="sample-clear">Clear the sample</button></div>`;
}

function gardenView() {
  const n = state.friends.length;
  if (!n) return emptyGarden();
  const due = L.dueFriends(state.friends, today).length;
  const { sort, view: mode } = state.settings;
  const pressed = (a, b) => `aria-pressed="${a === b}"`;
  return `
  <section class="page-head garden-head">
    <h1 tabindex="-1">Your garden</h1>
    <p class="lede">${plural(n, 'One friend', '# friends')}${due ? `, and ${plural(due, 'one would', '# would')} love a hello. <a href="#/today">See today</a>` : '. Everyone is watered.'}</p>
  </section>
  ${storageNote()}${sampleNote()}
  <div class="toolbar">
    <div class="seg" role="group" aria-label="Order">
      <button type="button" data-act="sort" data-v="beds" ${pressed(sort, 'beds')}>${icon('beds')}<span>By group</span></button>
      <button type="button" data-act="sort" data-v="thirsty" ${pressed(sort, 'thirsty')}>${icon('drop')}<span>Thirstiest first</span></button>
    </div>
    <div class="seg" role="group" aria-label="Show as">
      <button type="button" data-act="view" data-v="garden" ${pressed(mode, 'garden')}>${icon('garden')}<span>Garden</span></button>
      <button type="button" data-act="view" data-v="list" ${pressed(mode, 'list')}>${icon('list')}<span>List</span></button>
    </div>
  </div>
  ${mode === 'list' ? listView() : `<div class="garden-wrap"><div class="garden-main">${bedsView()}</div>${notebook()}</div>`}`;
}

const wideMQ = matchMedia('(min-width: 1200px)');

// A watering list, pinned beside the garden when there's room for it.
function notebook() {
  const due = L.dueFriends(state.friends, today);
  const bd = L.upcomingBirthdays(state.friends, today, 14);
  const when = (b) => (b.inDays === 0 ? 'today' : b.inDays === 1 ? 'tomorrow' : b.inDays < 7 ? L.weekdayName(b.date) : L.longDate(b.date, false));
  return `<aside class="notebook" aria-labelledby="nb-h">
    <h2 id="nb-h">Watering list</h2>
    ${due.length ? `<ul role="list">${due.slice(0, 7).map((f) => `<li><a href="${friendHref(f)}">${icon('drop')}${esc(f.name)}</a><small>${L.ago(L.daysSince(f, today)).replace(' ago', '')}</small></li>`).join('')}</ul>
      ${due.length > 7 ? `<button class="link" type="button" data-act="see-thirsty">and ${due.length - 7} more</button>` : ''}` : "<p>Everyone's watered.</p>"}
    ${bd.length ? `<h3>Birthdays soon</h3><ul role="list">${bd.slice(0, 4).map((b) => `<li><a href="${friendHref(b.friend)}">${icon('cake')}${esc(b.friend.name)}</a><small>${when(b)}</small></li>`).join('')}</ul>` : ''}
  </aside>`;
}

function beds() {
  if (state.settings.sort === 'thirsty') {
    return [{ id: null, name: 'Thirstiest first', friends: [...state.friends].sort(L.byThirst(today)), all: true }];
  }
  const byName = (a, b) => a.name.localeCompare(b.name);
  const out = state.groups.map((g) => ({ id: g.id, name: g.name, friends: state.friends.filter((f) => f.group === g.id).sort(byName) }));
  const loose = state.friends.filter((f) => !f.group).sort(byName);
  if (loose.length || !out.length) out.push({ id: '', name: out.length ? 'Everyone else' : 'Your friends', friends: loose });
  return out;
}

function plantCell(fr) {
  const m = L.mood(fr, today);
  const label = `${fr.name}. ${kindName(fr.plant)}, ${L.MOOD_WORDS[m].toLowerCase()}. ${lastLine(fr)}`;
  return `<div role="listitem" class="cell"><a class="plant mood-${m}" href="${friendHref(fr)}" aria-label="${esc(label)}" data-plant="${esc(fr.id)}" style="${swayStyle(fr.id)}">
    <span class="plant-art">${plantOf(fr)}</span>
    <span class="tag">${m !== 'fresh' ? icon('drop', 'thirst') : ''}<span>${esc(fr.name)}</span></span>
  </a></div>`;
}

function seedCell(b) {
  return `<div role="listitem" class="cell"><a class="plant seed-spot" href="#/add${b.id ? `?group=${encodeURIComponent(b.id)}` : ''}">
    <span class="spot">${icon('add')}</span><span class="tag"><span>Add someone</span></span>
  </a></div>`;
}

// Planters are as long as their plants need, up to the width of the page.
function gardenLayout() {
  const narrow = window.innerWidth <= 760;
  const inner = Math.min(window.innerWidth, 1200) - (narrow ? 32 : 48) - (wideMQ.matches ? 330 : 0);
  const cell = narrow ? Math.floor((inner - 8) / 3) : window.innerWidth < 1000 ? 140 : 158;
  const max = Math.max(3, Math.floor((inner - 20) / cell));
  return { cell, max, key: `${cell}x${max}` };
}

function bedsView() {
  const lay = gardenLayout();
  ui.layout = lay.key;
  return `<div class="beds" style="--cell:${lay.cell}px">${beds().map((b, i) => {
    const cells = b.friends.map(plantCell);
    // A spot to add someone, unless it would sit alone on a planter of its own.
    if (!b.all && (!cells.length || cells.length % lay.max)) cells.push(seedCell(b));
    const cols = Math.min(cells.length, lay.max);
    const rows = [];
    for (let k = 0; k < cells.length; k += cols) rows.push(cells.slice(k, k + cols).join(''));
    return `<section class="bed" aria-labelledby="bed-${i}" style="--c:${cols}">
      <h2 class="bed-sign" id="bed-${i}"><span>${esc(b.name)}</span></h2>
      <div class="bed-rows" role="list" aria-labelledby="bed-${i}">${rows.map((r) => `<div class="planter" role="none">${r}</div>`).join('')}</div>
    </section>`;
  }).join('')}</div>`;
}

function listView() {
  const order = state.settings.sort === 'thirsty' ? [...state.friends].sort(L.byThirst(today)) : beds().flatMap((b) => b.friends);
  return `<ul class="friend-list card" role="list">${order.map((fr) => {
    const m = L.mood(fr, today);
    const g = groupName(fr.group);
    return `<li><a class="row" href="${friendHref(fr)}" data-plant="${esc(fr.id)}">
      <span class="thumb">${plantOf(fr)}</span>
      <span class="who"><strong>${esc(fr.name)}</strong><small>${g ? `${esc(g)} · ` : ''}${L.rhythmOf(fr.rhythm).label}</small></span>
      <span class="when">${esc(lastLine(fr))}</span>
      <span class="mood-chip mood-${m}">${icon('drop')}${L.MOOD_WORDS[m]}</span>
    </a></li>`;
  }).join('')}</ul>`;
}

function emptyGarden() {
  return `
  <section class="empty">
    ${storageNote()}
    <div class="empty-art" aria-hidden="true">${seedPacket()}</div>
    <h1 tabindex="-1">Your garden is ready</h1>
    <p class="lede">Every friend is a plant, and getting in touch waters it. A plant that's gone a while without water looks a little thirsty, which is a gentle nudge to say hello.</p>
    <div class="actions">
      <a class="btn primary" href="#/add">${icon('add')}Add a friend</a>
      <button class="btn" type="button" data-act="sample-load">${icon('garden')}Try it with a sample garden</button>
    </div>
    <p class="small muted">Everything stays in this browser, on this device.</p>
    <div class="empty-planter" aria-hidden="true"><div class="planter">${['fern', 'sunflower', 'tulip'].map((k) => `<div class="cell">${plantSVG({ kind: k, stage: 0, seed: `empty-${k}`, dusk: dusk(), crop: true })}</div>`).join('')}</div></div>
  </section>`;
}

// ---------------------------------------------------------------- today

function todayView() {
  const hr = new Date().getHours();
  const greet = hr < 12 ? 'Good morning' : hr < 17 ? 'Good afternoon' : 'Good evening';
  const head = `<section class="page-head"><h1 tabindex="-1">${greet}</h1><p class="lede">${L.weekdayName(today)}, ${L.longDate(today, false)}</p></section>`;
  if (!state.friends.length) {
    return `${head}<section class="card today-empty"><h2>Nobody in the garden yet</h2><p>Add a friend, or try the sample garden, and this page will suggest who to say hello to.</p><div class="actions"><a class="btn primary" href="#/add">${icon('add')}Add a friend</a><button class="btn" type="button" data-act="sample-load">Try it with a sample garden</button></div></section>`;
  }
  const sug = L.suggestions(state.friends, today);
  const due = L.dueFriends(state.friends, today);
  const bdays = L.upcomingBirthdays(state.friends, today, 7);
  const recent = L.inTouchRecently(state.friends, today, 7);

  let hello;
  if (sug.length) {
    const more = due.length - sug.length;
    hello = `<h2>Due for a hello</h2>
      <div class="suggest-grid">${sug.map(suggestCard).join('')}</div>
      ${more > 0 ? `<p class="more">${plural(more, 'One more would', '# more would')} like a hello too. <button class="link" type="button" data-act="see-thirsty">See the thirstiest first</button></p>` : ''}`;
  } else {
    const next = L.nextUp(state.friends, today);
    hello = `<h2>Everyone is watered</h2><p class="calm">Nobody's due for a hello today.${next ? ` Next up is <a href="${friendHref(next)}">${esc(next.name)}</a>, ${L.dueIn(next, today) <= 1 ? 'tomorrow' : `in about ${L.dueIn(next, today)} days`}.` : ''}</p>`;
  }

  const anyBday = state.friends.some((f) => L.parseBirthday(f.birthday));
  const bdayList = bdays.length
    ? `<ul class="bday-list" role="list">${bdays.map((b) => `<li>
        <span class="bday-when"><strong>${L.whenText(b.inDays, b.date)}</strong><small>${L.longDate(b.date, false)}</small></span>
        <span class="bday-who"><a href="${friendHref(b.friend)}">${esc(b.friend.name)}</a>${b.turns ? `<small>turns ${b.turns}</small>` : ''}</span>
        ${icon('cake', 'bday-ico')}
      </li>`).join('')}</ul>`
    : `<p class="calm">No birthdays in the next 7 days.</p>`;

  const week = recent.length
    ? `<p class="calm">You were in touch with ${plural(recent.length, 'one person', '# people')} in the past 7 days.</p>
       <ul class="mini-garden" role="list">${recent.map((fr) => `<li><a href="${friendHref(fr)}" style="${swayStyle(fr.id)}"><span class="plant-art">${plantOf(fr)}</span><span class="tag"><span>${esc(fr.name)}</span></span></a></li>`).join('')}</ul>`
    : `<p class="calm">No hellos in the past 7 days yet. There's plenty of time.</p>`;

  return `${head}
  <div class="today-grid">
    <section class="card hello">${hello}</section>
    <section class="card bdays"><h2>Birthdays this week</h2>${bdayList}
      ${anyBday ? `<button class="btn quiet small" type="button" data-act="ics">${icon('calendar')}Add birthdays to my calendar</button>` : ''}</section>
    <section class="card week"><h2>This week</h2>${week}</section>
  </div>`;
}

function suggestCard(fr) {
  return `<article class="suggest">
    <a class="s-plant" href="${friendHref(fr)}" data-plant="${esc(fr.id)}" tabindex="-1" aria-hidden="true" style="${swayStyle(fr.id)}"><span class="plant-art">${plantOf(fr)}</span></a>
    <div class="s-body">
      <h3><a href="${friendHref(fr)}">${esc(fr.name)}</a></h3>
      <p class="s-meta">${esc(lastLine(fr))}</p>
      ${fr.note ? `<p class="ask-note"><span class="ask-label">Ask about</span>${esc(fr.note)}</p>` : ''}
      <button class="btn primary" type="button" data-act="talked" data-id="${esc(fr.id)}">${icon('can')}We talked</button>
    </div>
  </article>`;
}

// ---------------------------------------------------------------- one friend

function friendView(fr) {
  const m = L.mood(fr, today), st = L.stage(fr);
  const hist = L.touchesNewestFirst(fr);
  const g = groupName(fr.group);
  const bd = L.nextBirthday(fr.birthday, today);
  const n = L.daysInTouch(fr);
  let bdText = '';
  if (fr.birthday) {
    bdText = L.birthdayText(fr.birthday);
    if (bd && bd.inDays === 0) bdText += bd.turns ? `, turns ${bd.turns} today` : ', today!';
    else if (bd && bd.inDays <= 30) bdText += ` (${bd.turns ? `turns ${bd.turns} ` : ''}in ${plural(bd.inDays, 'one day', '# days')})`;
  }
  return `
  <a class="back" href="#/">${icon('back')}Garden</a>
  <article class="friend">
    <div class="friend-stage">
      <div class="friend-plant" data-plant="${esc(fr.id)}" style="${swayStyle(fr.id)}"><span class="plant-art">${plantOf(fr, `${kindName(fr.plant)}, ${L.MOOD_WORDS[m].toLowerCase()}`)}</span></div>
    </div>
    <div class="friend-info">
      <p class="kicker">${g ? `${esc(g)} · ` : ''}${kindName(fr.plant)}${fr.sample ? ' · <span class="sample-chip">Sample</span>' : ''}</p>
      <h1 tabindex="-1">${esc(fr.name)}</h1>
      <p class="mood-line"><span class="mood-chip mood-${m}">${icon('drop')}${L.MOOD_WORDS[m]}</span><span>${esc(lastLine(fr))}</span></p>
      <div class="ask-box">
        <h2>Ask about next time</h2>
        ${fr.note ? `<p class="ask-note">${esc(fr.note)}</p>` : '<p class="muted">Nothing yet.</p>'}
        <button class="btn quiet small" type="button" data-act="edit-note" data-id="${esc(fr.id)}">${icon('edit')}${fr.note ? 'Change' : 'Add something'}</button>
      </div>
      <div class="actions">
        <button class="btn primary big" type="button" data-act="talked" data-id="${esc(fr.id)}">${icon('can')}We talked</button>
        <a class="btn" href="#/edit/${encodeURIComponent(fr.id)}">${icon('edit')}Edit</a>
      </div>
      <dl class="facts">
        <div><dt>Keep in touch</dt><dd>${L.rhythmOf(fr.rhythm).label}</dd></div>
        <div><dt>Birthday</dt><dd>${bdText ? esc(bdText) : '<span class="muted">Not added</span>'}</dd></div>
        <div><dt>Growing</dt><dd>${L.STAGE_WORDS[st]}${n ? `, ${plural(n, 'one day', '# days')} of hellos` : ''}</dd></div>
      </dl>
    </div>
  </article>
  <section class="card history" aria-labelledby="hist-h">
    <h2 id="hist-h">History</h2>
    ${hist.length ? `<ol class="timeline">${hist.map((t) => {
      const h = L.howOf(t.how);
      return `<li>
        <span class="t-icon">${icon(t.how)}</span>
        <div class="t-body">
          <p class="t-head"><strong>${h.label}</strong> <time datetime="${t.date}">${L.longDate(t.date)}</time> <span class="muted">${L.ago(L.daysBetween(t.date, today))}</span></p>
          ${t.note ? `<p class="t-note">${esc(t.note)}</p>` : ''}
        </div>
        <button class="icon-btn" type="button" data-act="del-touch" data-id="${esc(fr.id)}" data-t="${esc(t.id)}" aria-label="Remove the ${h.label.toLowerCase()} on ${L.longDate(t.date)}">${icon('trash')}</button>
      </li>`;
    }).join('')}</ol>` : `<p class="muted">Nothing here yet. When you talk, tap "We talked" and it shows up here.</p>`}
  </section>`;
}

function missingView() {
  return `<section class="page-head"><h1 tabindex="-1">This plant isn't here</h1><p class="lede">It may have been removed, or it was in a garden on another device.</p><p><a class="btn" href="#/">${icon('back')}Back to the garden</a></p></section>`;
}

// ---------------------------------------------------------------- add and edit

function formView(fr, q) {
  const isNew = !fr;
  const v = fr || { name: '', rhythm: 'month', plant: '', birthday: '', group: q.get('group') || '', note: '' };
  const bd = L.parseBirthday(v.birthday) || {};
  const back = isNew ? '#/' : friendHref(fr);
  const sel = (a, b) => (a === b ? ' selected' : '');
  const chk = (a, b) => (a === b ? ' checked' : '');
  return `
  <a class="back" href="${back}">${icon('back')}${isNew ? 'Garden' : esc(fr.name)}</a>
  <section class="page-head"><h1 tabindex="-1">${isNew ? 'Add a friend' : `Edit ${esc(fr.name)}`}</h1></section>
  <form class="form card" id="friend-form" data-id="${isNew ? '' : esc(fr.id)}" novalidate>
    <div class="field">
      <label for="f-name">Name</label>
      <input id="f-name" name="name" autocomplete="off" maxlength="80" value="${esc(v.name)}" aria-describedby="f-name-err">
      <p class="err" id="f-name-err" hidden>Add a name first.</p>
    </div>
    <fieldset class="field">
      <legend>How often would you like to be in touch?</legend>
      <div class="chips">${L.RHYTHMS.map((r) => `<label class="chip"><input type="radio" name="rhythm" value="${r.id}"${chk(v.rhythm, r.id)}><span>${r.label}</span></label>`).join('')}</div>
    </fieldset>
    <fieldset class="field">
      <legend>Their plant</legend>
      <div class="plant-pick">
        ${isNew ? `<label class="pp"><input type="radio" name="plant" value=""${chk(v.plant, '')}><span class="pp-card"><span class="pp-art pick-for-me">${seedPacket()}</span><span class="pp-name">Pick for me</span></span></label>` : ''}
        ${KINDS.map((k) => `<label class="pp"><input type="radio" name="plant" value="${k.id}"${chk(v.plant, k.id)}><span class="pp-card"><span class="pp-art">${plantSVG({ kind: k.id, stage: 3, mood: 'fresh', seed: `pick-${k.id}`, dusk: dusk(), crop: true, inset: 14 })}</span><span class="pp-name">${k.name}</span></span></label>`).join('')}
      </div>
    </fieldset>
    <div class="field">
      <label for="f-group">Group <span class="opt">(optional)</span></label>
      <select id="f-group" name="group">
        <option value="">No group</option>
        ${state.groups.map((g) => `<option value="${esc(g.id)}"${sel(v.group, g.id)}>${esc(g.name)}</option>`).join('')}
        <option value="__new">New group…</option>
      </select>
      <input id="f-newgroup" name="newgroup" maxlength="40" placeholder="Name of the new group" aria-label="Name of the new group" hidden>
    </div>
    <fieldset class="field">
      <legend>Birthday <span class="opt">(optional)</span></legend>
      <div class="bday">
        <select name="bmonth" aria-label="Month"><option value="">Month</option>${L.MONTHS.map((mo, i) => `<option value="${i + 1}"${sel(bd.month, i + 1)}>${mo}</option>`).join('')}</select>
        <select name="bday" aria-label="Day"><option value="">Day</option>${Array.from({ length: 31 }, (_, i) => `<option value="${i + 1}"${sel(bd.day, i + 1)}>${i + 1}</option>`).join('')}</select>
        <input name="byear" inputmode="numeric" maxlength="4" placeholder="Year" aria-label="Year (optional)" value="${bd.year || ''}" aria-describedby="f-bday-err">
      </div>
      <p class="err" id="f-bday-err" hidden></p>
    </fieldset>
    <div class="field">
      <label for="f-note">Ask about next time <span class="opt">(optional)</span></label>
      <textarea id="f-note" name="note" rows="2" maxlength="500" placeholder="Their new job, the trip, the garden">${esc(v.note)}</textarea>
    </div>
    <div class="form-actions">
      <button class="btn primary" type="submit">${isNew ? `${icon('garden')}Add to the garden` : 'Save'}</button>
      <a class="btn quiet" href="${back}">Cancel</a>
      ${isNew ? '' : `<button type="button" class="btn quiet danger" data-act="remove-friend" data-id="${esc(fr.id)}">${icon('trash')}Remove from the garden</button>`}
    </div>
  </form>`;
}

function readForm(form) {
  const d = new FormData(form);
  const name = String(d.get('name') || '').trim();
  const showErr = (id, msg) => {
    const el = $(`#${id}`, form);
    el.textContent = msg;
    el.hidden = !msg;
  };
  let ok = true;
  showErr('f-name-err', name ? '' : 'Add a name first.');
  $('#f-name', form).setAttribute('aria-invalid', String(!name));
  if (!name) ok = false;
  const month = +d.get('bmonth') || 0, day = +d.get('bday') || 0;
  const yearRaw = String(d.get('byear') || '').trim();
  let birthday = '';
  let bErr = '';
  if (month || day || yearRaw) {
    const year = yearRaw ? +yearRaw : 0;
    if (!month || !day) bErr = 'Pick both a month and a day.';
    else if (yearRaw && (!/^\d{4}$/.test(yearRaw) || year < 1900 || `${yearRaw}-01-01` > today)) bErr = 'That year looks off. You can leave it empty.';
    else {
      const mm = String(month).padStart(2, '0'), dd = String(day).padStart(2, '0');
      birthday = year ? `${yearRaw}-${mm}-${dd}` : `${mm}-${dd}`;
      if (!L.parseBirthday(birthday) || (year && `${yearRaw}-${mm}-${dd}` > today)) bErr = "That date doesn't exist.";
    }
  }
  showErr('f-bday-err', bErr);
  if (bErr) ok = false;
  let group = String(d.get('group') || '');
  const newGroup = String(d.get('newgroup') || '').trim();
  if (group === '__new') group = newGroup ? `new:${newGroup}` : '';
  if (!ok) {
    const first = form.querySelector('.err:not([hidden])');
    const target = first && first.id === 'f-name-err' ? $('#f-name', form) : form.querySelector('[name="bmonth"]');
    if (target) target.focus();
    return null;
  }
  return { name, rhythm: String(d.get('rhythm') || 'month'), plant: String(d.get('plant') || ''), group, birthday, note: String(d.get('note') || '').trim().slice(0, 500) };
}

function saveFriend(form) {
  const v = readForm(form);
  if (!v) return;
  if (v.group.startsWith('new:')) {
    const name = v.group.slice(4).slice(0, 40);
    const existing = state.groups.find((g) => g.name.toLowerCase() === name.toLowerCase());
    if (existing) v.group = existing.id;
    else {
      const g = { id: L.uid(), name };
      state.groups.push(g);
      v.group = g.id;
    }
  }
  const id = form.dataset.id;
  if (id) {
    const fr = friendById(id);
    Object.assign(fr, { name: v.name, rhythm: v.rhythm, plant: v.plant || fr.plant, group: v.group, birthday: v.birthday, note: v.note });
    commit();
    toast('Saved.');
    go(friendHref(fr));
  } else {
    const fr = { id: L.uid(), name: v.name, rhythm: v.rhythm, plant: v.plant || L.pickKind(state.friends), birthday: v.birthday, group: v.group, note: v.note, added: today, sample: false, grown: 0, touches: [] };
    state.friends.push(fr);
    commit();
    ui.justPlanted = fr.id;
    toast(`${fr.name} is planted. Here's their ${kindName(fr.plant).toLowerCase()}.`);
    go('#/');
  }
}

// ---------------------------------------------------------------- settings

function settingsView() {
  const t = state.settings.theme;
  const sampleOn = hasSample();
  const anyBday = state.friends.some((f) => L.parseBirthday(f.birthday));
  const count = (id) => state.friends.filter((f) => f.group === id).length;
  return `
  <section class="page-head"><h1 tabindex="-1">Settings</h1></section>
  ${storageNote()}
  <div class="settings-grid">
    <section class="card" aria-labelledby="s-groups">
      <h2 id="s-groups">Groups</h2>
      <p class="muted">Each group is a bed in your garden, in this order.</p>
      <ul class="group-list" role="list">${state.groups.map((g, i) => `<li>
        <input value="${esc(g.name)}" maxlength="40" data-group="${esc(g.id)}" aria-label="Name of the group ${esc(g.name)}">
        <span class="g-count">${plural(count(g.id), 'one plant', '# plants')}</span>
        <button class="icon-btn" type="button" data-act="group-up" data-id="${esc(g.id)}" aria-label="Move ${esc(g.name)} up"${i === 0 ? ' disabled' : ''}>${icon('up')}</button>
        <button class="icon-btn" type="button" data-act="group-down" data-id="${esc(g.id)}" aria-label="Move ${esc(g.name)} down"${i === state.groups.length - 1 ? ' disabled' : ''}>${icon('down')}</button>
        <button class="icon-btn" type="button" data-act="group-del" data-id="${esc(g.id)}" aria-label="Remove the group ${esc(g.name)}">${icon('trash')}</button>
      </li>`).join('')}</ul>
      <form class="group-add" id="group-add">
        <input name="name" maxlength="40" placeholder="A new group" aria-label="Name of a new group">
        <button class="btn small" type="submit">${icon('add')}Add</button>
      </form>
    </section>

    <section class="card" aria-labelledby="s-data">
      <h2 id="s-data">Your garden's data</h2>
      <p>Your garden lives only in this browser, on this device. Nothing you put in it is sent anywhere, and there's no account. Clearing your browser's data clears your garden too, so download a backup now and then.</p>
      <div class="actions">
        <button class="btn" type="button" data-act="export">${icon('download')}Download a backup</button>
        <button class="btn" type="button" data-act="import">${icon('upload')}Restore a backup</button>
        <input type="file" id="import-file" accept="application/json,.json" hidden>
      </div>
      <p class="small muted">${state.settings.lastBackup ? `Last backup: ${L.longDate(state.settings.lastBackup)}.` : 'No backup yet.'}</p>
    </section>

    <section class="card" aria-labelledby="s-bday">
      <h2 id="s-bday">Birthdays</h2>
      <p>A calendar file with everyone's birthday, repeating every year. Open it and your calendar app adds them.</p>
      <button class="btn" type="button" data-act="ics"${anyBday ? '' : ' disabled'}>${icon('calendar')}Download birthdays (.ics)</button>
      ${anyBday ? '' : '<p class="small muted">No birthdays yet. You can add one when you edit a friend.</p>'}
    </section>

    <section class="card" aria-labelledby="s-look">
      <h2 id="s-look">Look</h2>
      <p>The garden is in daylight or at dusk, following your device, or the one you choose.</p>
      <div class="seg" role="group" aria-label="Look">
        <button type="button" data-act="theme" data-v="auto" aria-pressed="${t === 'auto'}">${icon('auto')}<span>Automatic</span></button>
        <button type="button" data-act="theme" data-v="day" aria-pressed="${t === 'day'}">${icon('sun')}<span>Day</span></button>
        <button type="button" data-act="theme" data-v="dusk" aria-pressed="${t === 'dusk'}">${icon('moon')}<span>Dusk</span></button>
      </div>
    </section>

    <section class="card" aria-labelledby="s-sample">
      <h2 id="s-sample">Sample garden</h2>
      ${sampleOn
        ? `<p>The sample garden is planted. Everyone in it is made up, and clearing it leaves your own friends where they are.</p><button class="btn" type="button" data-act="sample-clear">Clear the sample garden</button>`
        : `<p>Twelve made-up people with a few months of history, to see how the garden grows.</p><button class="btn" type="button" data-act="sample-load">${icon('garden')}Try it with a sample garden</button>`}
    </section>

    <section class="card" aria-labelledby="s-about">
      <h2 id="s-about">About</h2>
      <p>Friend Garden is a small, free app for keeping in touch. It has no account and no ads, what you put in it never leaves your device, and once it has loaded it works without the internet.</p>
      <p class="links"><a href="https://docs.tiresia.xyz/friend-garden/" target="_blank" rel="noopener">How it works</a> · <a href="https://github.com/franz-rosenzweig/friend-garden" target="_blank" rel="noopener">Source code</a> · MIT license</p>
    </section>

    <section class="card danger-zone" aria-labelledby="s-wipe">
      <h2 id="s-wipe">Start over</h2>
      <p>Removes every friend, note and group from this browser.</p>
      <button class="btn quiet danger" type="button" data-act="wipe">${icon('trash')}Remove everything</button>
    </section>
  </div>`;
}

// ---------------------------------------------------------------- dialogs

const dlg = $('#dlg');
let dlgDone = null;

function openSheet(html, labelId) {
  dlg.innerHTML = html;
  dlg.setAttribute('aria-labelledby', labelId);
  if (!dlg.open) dlg.showModal();
  const first = dlg.querySelector('[autofocus], textarea, input:checked, input, button');
  if (first) first.focus();
}

function closeSheet(result) {
  const done = dlgDone;
  dlgDone = null;
  if (dlg.open) dlg.close();
  if (done) done(result);
}

dlg.addEventListener('click', (e) => {
  if (e.target === dlg) closeSheet(null);
  else if (e.target.closest('[data-close]')) closeSheet(null);
});
dlg.addEventListener('close', () => {
  if (dlgDone) {
    const done = dlgDone;
    dlgDone = null;
    done(null);
  }
});

function askStep(fr, title) {
  return `<form class="sheet-form" id="ask-form">
    <header class="sheet-head"><h2 id="ask-title">${title}</h2><button type="button" class="icon-btn" data-close aria-label="Close">${icon('close')}</button></header>
    <label class="sr" for="ask-note">Ask about next time</label>
    <textarea id="ask-note" name="note" rows="3" maxlength="500" placeholder="Their new job, the trip, the garden" autofocus>${esc(fr.note)}</textarea>
    <div class="sheet-actions">
      <button class="btn primary" type="submit">Save</button>
      ${fr.note ? '<button class="btn quiet" type="button" data-clear>Clear it</button>' : ''}
      <button class="btn quiet" type="button" data-close>${fr.note ? 'Keep it' : 'Not now'}</button>
    </div>
  </form>`;
}

// "We talked": how and when, then what to ask about next time.
function talk(fr) {
  return new Promise((resolve) => {
    const last = L.lastTouch(fr);
    const hows = L.HOWS.map((h) => `<label class="how"><input type="radio" name="how" value="${h.id}"${(last ? last.how : 'call') === h.id ? ' checked' : ''}><span>${icon(h.id)}${h.label}</span></label>`).join('');
    let logged = null;
    dlgDone = (r) => resolve(r || logged);
    openSheet(`<form class="sheet-form" id="talk-form">
      <header class="sheet-head"><h2 id="talk-title">You talked with ${esc(fr.name)}</h2><button type="button" class="icon-btn" data-close aria-label="Close">${icon('close')}</button></header>
      <fieldset><legend>How?</legend><div class="how-pick">${hows}</div></fieldset>
      <fieldset><legend>When?</legend>
        <div class="chips">
          <label class="chip"><input type="radio" name="when" value="0" checked><span>Today</span></label>
          <label class="chip"><input type="radio" name="when" value="1"><span>Yesterday</span></label>
          <label class="chip"><input type="radio" name="when" value="other"><span>Earlier</span></label>
        </div>
        <input type="date" name="date" max="${today}" value="${L.addDays(today, -2)}" aria-label="The day you talked" hidden>
      </fieldset>
      <label for="t-note">A note <span class="opt">(optional)</span></label>
      <textarea id="t-note" name="note" rows="2" maxlength="500" placeholder="What you talked about"></textarea>
      <div class="sheet-actions"><button class="btn primary" type="submit">${icon('can')}Water the plant</button><button class="btn quiet" type="button" data-close>Cancel</button></div>
    </form>`, 'talk-title');

    const form = $('#talk-form', dlg);
    form.addEventListener('change', (e) => {
      if (e.target.name === 'when') form.date.hidden = e.target.value !== 'other';
    });
    form.addEventListener('submit', (e) => {
      e.preventDefault();
      const d = new FormData(form);
      const when = d.get('when');
      let date = when === 'other' ? String(d.get('date') || '') : L.addDays(today, -Number(when));
      if (!L.isDay(date) || date > today) date = today;
      const before = L.stage(fr);
      fr.touches.push({ id: L.uid(), date, how: String(d.get('how') || 'call'), note: String(d.get('note') || '').trim().slice(0, 500), t: Date.now() });
      fr.grown = L.stage(fr);
      commit();
      logged = { grew: fr.grown > before };
      openSheet(askStep(fr, 'Anything to ask about next time?'), 'ask-title');
      bindAsk(fr, () => closeSheet(logged));
    });
  });
}

function bindAsk(fr, done) {
  const form = $('#ask-form', dlg);
  form.addEventListener('submit', (e) => {
    e.preventDefault();
    fr.note = form.note.value.trim().slice(0, 500);
    commit();
    done();
  });
  const clear = form.querySelector('[data-clear]');
  if (clear) clear.addEventListener('click', () => { form.note.value = ''; form.note.focus(); });
}

function editNote(fr) {
  return new Promise((resolve) => {
    dlgDone = resolve;
    openSheet(askStep(fr, `Ask ${esc(fr.name)} about`), 'ask-title');
    bindAsk(fr, () => closeSheet(true));
  });
}

const cdlg = $('#confirm');
function confirmBox(title, text, ok, danger = true) {
  return new Promise((resolve) => {
    cdlg.innerHTML = `<form method="dialog" class="sheet-form">
      <h2 id="confirm-title">${title}</h2>${text ? `<p>${text}</p>` : ''}
      <div class="sheet-actions"><button class="btn ${danger ? 'danger-fill' : 'primary'}" value="ok">${ok}</button><button class="btn quiet" value="no" autofocus>Cancel</button></div>
    </form>`;
    cdlg.setAttribute('aria-labelledby', 'confirm-title');
    cdlg.returnValue = '';
    cdlg.addEventListener('close', () => resolve(cdlg.returnValue === 'ok'), { once: true });
    cdlg.showModal();
  });
}
cdlg.addEventListener('click', (e) => { if (e.target === cdlg) cdlg.close('no'); });

// ---------------------------------------------------------------- watering

async function water(fr, grew) {
  const host = view.querySelector(`[data-plant="${CSS.escape(fr.id)}"]`);
  if (host && !reduced()) {
    host.classList.add('is-watering');
    const art = host.querySelector('.plant-art') || host;
    const r = art.getBoundingClientRect();
    art.style.setProperty('--fall', `${Math.max(24, Math.round(0.71 * r.width - 0.12 * r.height))}px`);
    art.insertAdjacentHTML('beforeend', wateringCan());
    await wait(2000);
  }
  render(false);
  const again = view.querySelector(`[data-plant="${CSS.escape(fr.id)}"]`);
  if (again && !reduced()) again.classList.add('perk');
  if (again && !reduced() && grew) again.classList.add('grew');
  toast(`Watered ${fr.name}'s ${kindName(fr.plant).toLowerCase()}.${grew ? ' It grew a little.' : ''}`);
}

// ---------------------------------------------------------------- little helpers

let toastTimer = 0;
function toast(msg) {
  const el = $('#toast');
  el.textContent = msg;
  el.classList.add('show');
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => el.classList.remove('show'), 4200);
}

function download(name, text, type) {
  const url = URL.createObjectURL(new Blob([text], { type }));
  const a = document.createElement('a');
  a.href = url;
  a.download = name;
  document.body.append(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 5000);
}

function refocus(sel) {
  const el = view.querySelector(sel);
  if (el) el.focus();
}

function applyTheme() {
  document.documentElement.dataset.theme = state.settings.theme;
  try { localStorage.setItem('friend-garden.theme', state.settings.theme); } catch { /* fine */ }
}

function addSample() {
  for (const g of DEFAULT_GROUPS) if (!state.groups.some((x) => x.id === g.id)) state.groups.push({ ...g });
  state.friends = state.friends.filter((f) => !f.sample).concat(sampleFriends(today));
  commit();
}

// ---------------------------------------------------------------- what the buttons do

const actions = {
  'sample-load': () => {
    addSample();
    toast('Here is a sample garden. Everyone in it is made up.');
    go('#/');
  },
  'sample-clear': async () => {
    const n = state.friends.filter((f) => f.sample).length;
    if (!(await confirmBox('Clear the sample garden?', `The ${n} made-up people go. Anyone you added yourself stays.`, 'Clear it'))) return;
    state.friends = state.friends.filter((f) => !f.sample);
    commit();
    render();
    toast('The sample garden is cleared.');
  },
  sort: (b) => { state.settings.sort = b.dataset.v; commit(); render(); refocus(`[data-act="sort"][data-v="${b.dataset.v}"]`); },
  view: (b) => { state.settings.view = b.dataset.v; commit(); render(); refocus(`[data-act="view"][data-v="${b.dataset.v}"]`); },
  'see-thirsty': () => { state.settings.sort = 'thirsty'; commit(); go('#/'); },
  talked: async (b) => {
    const fr = friendById(b.dataset.id);
    if (!fr) return;
    const res = await talk(fr);
    if (res) await water(fr, res.grew);
    else render();
  },
  'edit-note': async (b) => {
    const fr = friendById(b.dataset.id);
    if (fr && (await editNote(fr))) { render(); toast('Saved.'); }
  },
  'del-touch': async (b) => {
    const fr = friendById(b.dataset.id);
    const t = fr && fr.touches.find((x) => x.id === b.dataset.t);
    if (!t) return;
    if (!(await confirmBox('Remove this from the history?', `${L.howOf(t.how).label} on ${L.longDate(t.date)}.`, 'Remove'))) return;
    fr.touches = fr.touches.filter((x) => x !== t);
    commit();
    render();
    refocus('.history h2');
  },
  'remove-friend': async (b) => {
    const fr = friendById(b.dataset.id);
    if (!fr) return;
    if (!(await confirmBox(`Remove ${esc(fr.name)} from the garden?`, 'Their plant, notes and history go too.', 'Remove'))) return;
    state.friends = state.friends.filter((f) => f !== fr);
    commit();
    toast(`${fr.name} is no longer in the garden.`);
    go('#/');
  },
  'group-up': (b) => moveGroup(b.dataset.id, -1),
  'group-down': (b) => moveGroup(b.dataset.id, 1),
  'group-del': async (b) => {
    const g = state.groups.find((x) => x.id === b.dataset.id);
    if (!g) return;
    const n = state.friends.filter((f) => f.group === g.id).length;
    if (n && !(await confirmBox(`Remove the group ${esc(g.name)}?`, `${plural(n, 'The one plant in it moves', 'The # plants in it move')} to "Everyone else".`, 'Remove'))) return;
    state.groups = state.groups.filter((x) => x !== g);
    for (const f of state.friends) if (f.group === g.id) f.group = '';
    commit();
    render();
    refocus('#group-add input');
  },
  export: () => {
    download(`friend-garden-backup-${today}.json`, backupJSON(state), 'application/json');
    state.settings.lastBackup = today;
    commit();
    render();
    toast('Backup downloaded.');
  },
  import: () => $('#import-file').click(),
  ics: () => {
    const n = state.friends.filter((f) => L.parseBirthday(f.birthday)).length;
    if (!n) return toast('No birthdays yet.');
    download('birthdays.ics', L.birthdaysICS(state.friends), 'text/calendar');
    toast(`A calendar file with ${plural(n, 'one birthday', '# birthdays')} is downloaded.`);
  },
  theme: (b) => { state.settings.theme = b.dataset.v; commit(); applyTheme(); render(); refocus(`[data-act="theme"][data-v="${b.dataset.v}"]`); },
  wipe: async () => {
    if (!(await confirmBox('Remove everything?', 'Every friend, note and group in this browser goes. A backup file you downloaded stays where it is.', 'Remove everything'))) return;
    state = emptyState();
    commit();
    applyTheme();
    toast('Everything is removed. The garden is empty.');
    go('#/');
  },
};

function moveGroup(id, dir) {
  const i = state.groups.findIndex((g) => g.id === id);
  const j = i + dir;
  if (i < 0 || j < 0 || j >= state.groups.length) return;
  [state.groups[i], state.groups[j]] = [state.groups[j], state.groups[i]];
  commit();
  render();
  const btn = view.querySelector(`[data-act="group-${dir < 0 ? 'up' : 'down'}"][data-id="${CSS.escape(id)}"]`);
  (btn && !btn.disabled ? btn : view.querySelector(`[data-group="${CSS.escape(id)}"]`))?.focus();
}

view.addEventListener('click', (e) => {
  const b = e.target.closest('[data-act]');
  if (!b || b.disabled || !actions[b.dataset.act]) return;
  e.preventDefault();
  actions[b.dataset.act](b, e);
});

view.addEventListener('submit', (e) => {
  e.preventDefault();
  if (e.target.id === 'friend-form') saveFriend(e.target);
  else if (e.target.id === 'group-add') {
    const name = e.target.name.value.trim().slice(0, 40);
    if (!name) return e.target.name.focus();
    state.groups.push({ id: L.uid(), name });
    commit();
    render();
    refocus('#group-add input');
    toast(`Added the group ${name}.`);
  }
});

view.addEventListener('change', async (e) => {
  const t = e.target;
  if (t.id === 'f-group') {
    const ng = $('#f-newgroup', view);
    ng.hidden = t.value !== '__new';
    if (!ng.hidden) ng.focus();
  } else if (t.dataset.group) {
    const g = state.groups.find((x) => x.id === t.dataset.group);
    const name = t.value.trim().slice(0, 40);
    if (g && name) { g.name = name; commit(); toast('Saved.'); } else if (g) t.value = g.name;
  } else if (t.id === 'import-file' && t.files[0]) {
    let next;
    try {
      next = readBackup(await t.files[0].text());
    } catch (err) {
      toast(err.message || "That file couldn't be read.");
      t.value = '';
      return;
    }
    t.value = '';
    const n = next.friends.length;
    if (!(await confirmBox('Restore this backup?', `It has ${plural(n, 'one friend', '# friends')}. What's in your garden now is replaced by it.`, 'Restore', false))) return;
    state = next;
    commit();
    applyTheme();
    toast('Backup restored.');
    go('#/');
  }
});

// ---------------------------------------------------------------- start

function start() {
  $('#defs').innerHTML = WOBBLE_DEFS;
  $('.sky').innerHTML = skySVG();
  $('.fireflies').innerHTML = fireflies();
  applyTheme();
  window.addEventListener('hashchange', () => {
    if (dlg.open) closeSheet(null);
    render(true);
  });
  mqDark.addEventListener('change', () => render());
  let resizeTimer = 0;
  window.addEventListener('resize', () => {
    clearTimeout(resizeTimer);
    resizeTimer = setTimeout(() => {
      if (view.dataset.screen === 'garden' && state.settings.view === 'garden' && ui.layout && gardenLayout().key !== ui.layout && !dlg.open) render();
    }, 150);
  });
  // A new day: thirst moves on, so draw again when the page comes back.
  document.addEventListener('visibilitychange', () => {
    if (!document.hidden && L.todayISO() !== today && !dlg.open) render();
  });
  render(false);
  document.documentElement.classList.add('ready');
  // Works offline once it has loaded (https only; the tests switch it off with ?nosw).
  if ('serviceWorker' in navigator && location.protocol === 'https:' && !location.search.includes('nosw')) {
    navigator.serviceWorker.register('sw.js').catch(() => {});
  }
}

// For the tests in tools/: read the state and draw again.
window.__fg = {
  get state() { return state; },
  set state(s) { state = s; commit(); render(); },
  render, L, storage,
};

start();
