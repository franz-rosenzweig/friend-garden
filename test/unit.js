// Unit tests for the garden's rules. tools/walk.py opens this page and reads window.__results.
import * as L from '../app/js/logic.js';
import { normalize, backupJSON, readBackup, emptyState } from '../app/js/store.js';
import { plantSVG, KINDS, MOODS, TOPS } from '../app/js/plants.js';
import { sampleFriends } from '../app/js/sample.js';

const results = [];
function test(name, fn) {
  try { fn(); results.push({ name, ok: true }); } catch (e) { results.push({ name, ok: false, msg: String(e && e.message || e) }); }
}
function eq(a, b, what = '') {
  const ja = JSON.stringify(a), jb = JSON.stringify(b);
  if (ja !== jb) throw new Error(`${what} expected ${jb}, got ${ja}`);
}
function ok(v, what = '') { if (!v) throw new Error(`${what} expected truthy`); }

const T = '2026-10-20';
const friend = (o = {}) => ({ id: o.id || 'f' + Math.random(), name: o.name || 'Test', rhythm: o.rhythm || 'week', plant: 'fern', birthday: o.birthday || '', group: o.group || '', note: '', added: o.added || '2026-01-01', sample: false, touches: (o.days || []).map((d, i) => ({ id: 't' + i, date: L.addDays(T, -d), how: 'call', note: '', t: i })) });

test('days: round trip and month/year edges', () => {
  eq(L.fromDayNum(L.dayNum('2026-10-20')), '2026-10-20');
  eq(L.addDays('2026-12-31', 1), '2027-01-01');
  eq(L.addDays('2024-03-01', -1), '2024-02-29');
  eq(L.addDays('2026-03-08', 1), '2026-03-09', 'across a DST change');
  eq(L.daysBetween('2026-01-01', '2026-12-31'), 364);
});
test('days: isDay', () => {
  ok(L.isDay('2026-02-28'));
  ok(!L.isDay('2026-02-29'), 'not a leap year');
  ok(L.isDay('2024-02-29'));
  ok(!L.isDay('2026-13-01'));
  ok(!L.isDay('20261020'));
  ok(!L.isDay(null));
});
test('ago', () => {
  eq([0, 1, 3, 7, 13, 14, 20, 30, 60, 200, 400, 800].map(L.ago),
    ['today', 'yesterday', '3 days ago', 'a week ago', 'a week ago', '2 weeks ago', '3 weeks ago', 'about a month ago', '2 months ago', '7 months ago', 'about a year ago', '2 years ago']);
});
test('mood: weekly boundaries', () => {
  eq([0, 6, 7, 13, 14, 40].map((d) => L.mood(friend({ days: [d] }), T)), ['fresh', 'fresh', 'thirsty', 'thirsty', 'droopy', 'droopy']);
});
test('mood: every 3 months', () => {
  eq([90, 91, 181, 182].map((d) => L.mood(friend({ rhythm: '3months', days: [d] }), T)), ['fresh', 'thirsty', 'thirsty', 'droopy']);
});
test('mood: whenever never droops', () => {
  eq([179, 180, 2000].map((d) => L.mood(friend({ rhythm: 'whenever', days: [d] }), T)), ['fresh', 'thirsty', 'thirsty']);
});
test('mood: counts from planting when never in touch', () => {
  eq(L.mood(friend({ added: T }), T), 'fresh');
  eq(L.mood(friend({ added: L.addDays(T, -10) }), T), 'thirsty');
  eq(L.daysSince(friend({ added: L.addDays(T, -3) }), T), 3);
});
test('mood: the newest touch counts, whatever order they were logged in', () => {
  eq(L.mood(friend({ days: [30, 2, 50] }), T), 'fresh');
  eq(L.lastTouch(friend({ days: [30, 2, 50] })).date, L.addDays(T, -2));
});
test('stage: distinct days in touch', () => {
  eq([[], [1], [1, 2], [1, 2, 3], [1, 2, 3, 4, 5, 6], [1, 2, 3, 4, 5, 6, 7, 8, 9, 10]].map((d) => L.stage(friend({ days: d }))), [0, 1, 1, 2, 3, 4]);
  eq(L.stage(friend({ days: [1, 1, 1, 1, 1] })), 1, 'same day counts once');
});
test('dew after a recent watering', () => {
  eq([0, 1, 2].map((d) => L.dewy(friend({ days: [d] }), T)), [true, true, false]);
  eq(L.dewy(friend({}), T), false);
});
test('suggestions: none, one, two', () => {
  eq(L.suggestions([friend({ days: [1] })], T), []);
  const a = friend({ id: 'a', days: [8] });
  eq(L.suggestions([a, friend({ days: [1] })], T).map((f) => f.id), ['a']);
  const fam = friend({ id: 'b', days: [30], group: 'family' });
  const fam2 = friend({ id: 'c', days: [20], group: 'family' });
  const far = friend({ id: 'd', days: [9], group: 'far' });
  const s = L.suggestions([far, fam2, fam], T);
  eq(s[0].id, 'b', 'most overdue first');
  eq(s[1].id, 'd', 'second from another group');
  eq(L.suggestions([far, fam2, fam], T).map((f) => f.id), s.map((f) => f.id), 'stable through the day');
});
test('nextUp when nobody is due', () => {
  const a = friend({ id: 'a', days: [5] }), b = friend({ id: 'b', rhythm: 'month', days: [5] });
  eq(L.nextUp([b, a], T).id, 'a');
  eq(L.dueIn(a, T), 2);
});
test('birthdays: parse', () => {
  eq(L.parseBirthday('03-14'), { year: null, month: 3, day: 14 });
  eq(L.parseBirthday('1990-03-14'), { year: 1990, month: 3, day: 14 });
  eq(L.parseBirthday('02-30'), null);
  eq(L.parseBirthday('1990-02-29'), null);
  ok(L.parseBirthday('2000-02-29'));
  eq(L.parseBirthday('13-01'), null);
  eq(L.parseBirthday(''), null);
});
test('birthdays: next one', () => {
  eq(L.nextBirthday('10-20', T), { date: '2026-10-20', inDays: 0, turns: null });
  eq(L.nextBirthday('1990-10-21', T), { date: '2026-10-21', inDays: 1, turns: 36 });
  eq(L.nextBirthday('10-19', T).date, '2027-10-19');
  eq(L.nextBirthday('02-29', '2026-02-01').date, '2026-02-28');
  eq(L.nextBirthday('02-29', '2027-12-01').date, '2028-02-29');
});
test('birthdays: the coming week, soonest first', () => {
  const list = L.upcomingBirthdays([friend({ name: 'B', birthday: '10-27' }), friend({ name: 'A', birthday: '10-22' }), friend({ name: 'C', birthday: '10-28' }), friend({ name: 'D' })], T, 7);
  eq(list.map((b) => b.friend.name), ['A', 'B']);
  eq(L.whenText(0, T), 'Today');
  eq(L.whenText(1, '2026-10-21'), 'Tomorrow');
  eq(L.whenText(3, '2026-10-23'), 'Friday');
});
test('calendar file', () => {
  const now = new Date(Date.UTC(2026, 9, 20, 12, 0, 0));
  const ics = L.birthdaysICS([friend({ id: 'x1', name: 'Pat, the "Great"; Jr.', birthday: '1990-03-14' }), friend({ id: 'x2', name: 'Leap', birthday: '02-29' }), friend({ name: 'None' }), friend({ id: 'x3', name: 'A'.repeat(90), birthday: '07-04' })], now);
  ok(ics.endsWith('\r\n'), 'CRLF at the end');
  ok(!/[^\r]\n/.test(ics), 'only CRLF line breaks');
  eq((ics.match(/BEGIN:VEVENT/g) || []).length, 3);
  ok(ics.includes('SUMMARY:Pat\\, the "Great"\\; Jr.\'s birthday'), 'escaped');
  ok(ics.includes('DTSTART;VALUE=DATE:19900314'));
  ok(ics.includes('DTEND;VALUE=DATE:19900315'));
  ok(ics.includes('DTSTART;VALUE=DATE:20000229') && ics.includes('BYMONTHDAY=-1'), 'Feb 29');
  ok(ics.includes('DTSTAMP:20261020T120000Z'));
  for (const line of ics.split('\r\n')) ok(new TextEncoder().encode(line).length <= 75, 'folded to 75 bytes');
  ok(ics.includes('\r\n A'), 'long summary folded');
});
test('in touch this week', () => {
  const list = L.inTouchRecently([friend({ id: 'a', days: [0] }), friend({ id: 'b', days: [6] }), friend({ id: 'c', days: [7] }), friend({ id: 'd' })], T);
  eq(list.map((f) => f.id), ['a', 'b']);
});
test('pickKind picks the least used', () => {
  const fs = KINDS.slice(1).map((k) => ({ plant: k.id }));
  eq(L.pickKind(fs), 'fern');
});
test('normalize cleans up', () => {
  const s = normalize({
    groups: [{ id: 'g1', name: 'Pals' }, { id: 'g1', name: 'Dup' }, 'junk'],
    friends: [
      { id: 'a', name: '  Ann  ', rhythm: 'daily', plant: 'oak', group: 'gone', birthday: '02-30', touches: [{ date: '2026-10-01', how: 'fax' }, { date: '2099-01-01' }, { date: 'soon' }] },
      { id: 'a', name: 'Bo', group: 'g1', birthday: '1990-01-02', touches: [] },
      { name: '' }, null, 5,
    ],
    settings: { sort: 'thirsty', view: 'nope', theme: 'dusk' },
  }, T);
  eq(s.groups, [{ id: 'g1', name: 'Pals' }]);
  eq(s.friends.length, 2);
  const [a, b] = s.friends;
  eq([a.name, a.rhythm, a.plant, a.group, a.birthday], ['Ann', 'month', 'fern', '', '']);
  eq(a.touches.length, 1, 'bad and future dates dropped');
  eq(a.touches[0].how, 'call');
  ok(b.id !== 'a', 'duplicate id replaced');
  eq([b.group, b.birthday], ['g1', '1990-01-02']);
  eq(s.settings, { sort: 'thirsty', view: 'garden', theme: 'dusk', lastBackup: '' });
  eq(normalize(null).friends, []);
});
test('backup round trip', () => {
  const st = emptyState();
  st.friends = sampleFriends(L.todayISO());
  const back = readBackup(backupJSON(st));
  eq(back.friends, st.friends);
  eq(back.groups, st.groups);
});
test('backup: rejects other files', () => {
  for (const bad of ['not json', '{}', '{"app":"Other","friends":[]}', '[]']) {
    let threw = false;
    try { readBackup(bad); } catch (e) { threw = true; }
    ok(threw, bad);
  }
  let msg = '';
  try { readBackup('{"app":"Friend Garden","format":99,"friends":[]}'); } catch (e) { msg = e.message; }
  ok(/newer/.test(msg), 'newer format');
});
test('plants: every kind, stage and mood draws clean SVG', () => {
  const parser = new DOMParser();
  for (const k of KINDS) for (let st = 0; st < 5; st++) for (const m of MOODS) for (const dusk of [false, true]) {
    const svg = plantSVG({ kind: k.id, stage: st, mood: m, seed: 'unit', dusk, dew: true });
    ok(!/NaN|undefined|Infinity/.test(svg), `${k.id} ${st} ${m} numbers`);
    const doc = parser.parseFromString(svg.replace('<svg ', '<svg xmlns="http://www.w3.org/2000/svg" '), 'image/svg+xml');
    ok(!doc.querySelector('parsererror'), `${k.id} ${st} ${m} parses`);
  }
});
test('plants: same seed, same plant; moods differ', () => {
  const a = plantSVG({ kind: 'olive', stage: 3, mood: 'fresh', seed: 's1' });
  eq(plantSVG({ kind: 'olive', stage: 3, mood: 'fresh', seed: 's1' }), a);
  ok(plantSVG({ kind: 'olive', stage: 3, mood: 'droopy', seed: 's1' }) !== a);
  ok(plantSVG({ kind: 'olive', stage: 3, mood: 'fresh', seed: 's2' }) !== a, 'another seed, another shape');
});
test('plants: the crop table covers every drawing', () => {
  const host = document.createElement('div');
  host.style.cssText = 'position:absolute;left:-9999px;width:160px';
  document.body.append(host);
  for (const k of KINDS) for (let st = 0; st < 5; st++) for (const m of MOODS) for (let i = 0; i < 6; i++) {
    host.innerHTML = plantSVG({ kind: k.id, stage: st, mood: m, seed: `crop${i}` });
    const b = host.querySelector('.pl').getBBox();
    ok(b.y >= TOPS[k.id][st] - 2, `${k.id} ${st} ${m} reaches ${Math.floor(b.y)}, above ${TOPS[k.id][st]}`);
  }
  host.remove();
  ok(plantSVG({ kind: 'fern', stage: 0, seed: 'c', crop: true }).includes('viewBox="0 128 160 72"'), 'cropped view box');
});
test('sample garden', () => {
  const fs = sampleFriends(T);
  eq(fs.length, 12);
  ok(fs.every((f) => f.sample), 'all marked as sample');
  eq(new Set(fs.map((f) => f.name)).size, 12);
  eq(new Set(fs.map((f) => f.plant)).size, 8, 'all eight kinds');
  eq(new Set(fs.map((f) => L.mood(f, T))).size, 3, 'all three moods');
  eq(new Set(fs.map((f) => L.stage(f))).size, 5, 'all five stages');
  eq(L.upcomingBirthdays(fs, T, 7).length, 2);
  ok(fs.every((f) => f.touches.every((t) => t.date <= T)), 'no future touches');
});

const fails = results.filter((r) => !r.ok);
document.getElementById('out').innerHTML = results.map((r) => `<span class="${r.ok ? 'pass' : 'fail'}">${r.ok ? 'ok  ' : 'FAIL'} ${r.name}${r.ok ? '' : ` — ${r.msg}`}</span>`).join('\n') + `\n\n${results.length - fails.length}/${results.length} passed`;
window.__results = results;
