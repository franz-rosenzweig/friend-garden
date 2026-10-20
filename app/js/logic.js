// The garden's rules, as plain functions with no page in sight, so the tests
// can run them with any "today" they like. Dates are local calendar days,
// written YYYY-MM-DD.

import { KIND_IDS, rng } from './plants.js';

export const RHYTHMS = [
  { id: 'week', days: 7, label: 'Every week' },
  { id: '2weeks', days: 14, label: 'Every 2 weeks' },
  { id: 'month', days: 30, label: 'Every month' },
  { id: '3months', days: 91, label: 'Every 3 months' },
  { id: 'whenever', days: null, label: 'Whenever' },
];
export const rhythmOf = (id) => RHYTHMS.find((r) => r.id === id) || RHYTHMS[2];

// A "whenever" friend only gets a little thirsty after half a year, and never droops.
export const WHENEVER_DAYS = 180;

export const HOWS = [
  { id: 'call', label: 'Call', past: 'a call' },
  { id: 'text', label: 'Text', past: 'texting' },
  { id: 'visit', label: 'Visit', past: 'a visit' },
  { id: 'letter', label: 'Letter', past: 'a letter' },
  { id: 'voice', label: 'Voice note', past: 'a voice note' },
];
export const howOf = (id) => HOWS.find((h) => h.id === id) || HOWS[0];

export const MOOD_WORDS = { fresh: 'Fresh', thirsty: 'A bit thirsty', droopy: 'Droopy' };
export const STAGE_WORDS = ['Seedling', 'Sprout', 'Young plant', 'Growing well', 'In full bloom'];
const STAGE_AT = [1, 3, 6, 10]; // distinct days in touch to reach stage 1, 2, 3, 4

export const MONTHS = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'];
const WEEKDAYS = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];

// ---------------------------------------------------------------- days

const pad = (n) => String(n).padStart(2, '0');
export const isDay = (s) => typeof s === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(s) && !Number.isNaN(dayNum(s)) && fromDayNum(dayNum(s)) === s;
export function dayNum(s) {
  const [y, m, d] = s.split('-').map(Number);
  return Math.round(Date.UTC(y, m - 1, d) / 864e5);
}
export function fromDayNum(n) {
  const d = new Date(n * 864e5);
  return `${String(d.getUTCFullYear()).padStart(4, '0')}-${pad(d.getUTCMonth() + 1)}-${pad(d.getUTCDate())}`;
}
export const todayISO = (now = new Date()) => `${now.getFullYear()}-${pad(now.getMonth() + 1)}-${pad(now.getDate())}`;
export const addDays = (s, n) => fromDayNum(dayNum(s) + n);
export const daysBetween = (a, b) => dayNum(b) - dayNum(a);
const weekday = (s) => new Date(dayNum(s) * 864e5).getUTCDay();

export function longDate(s, withYear = true) {
  const [y, m, d] = s.split('-').map(Number);
  return `${MONTHS[m - 1]} ${d}${withYear ? `, ${y}` : ''}`;
}
export const weekdayName = (s) => WEEKDAYS[weekday(s)];

export function ago(n) {
  if (n <= 0) return 'today';
  if (n === 1) return 'yesterday';
  if (n < 7) return `${n} days ago`;
  if (n < 14) return 'a week ago';
  if (n < 28) return `${Math.round(n / 7)} weeks ago`;
  if (n < 45) return 'about a month ago';
  if (n < 335) return `${Math.round(n / 30.4)} months ago`;
  if (n < 548) return 'about a year ago';
  return `${Math.round(n / 365)} years ago`;
}

// ---------------------------------------------------------------- one friend

export function touchesNewestFirst(fr) {
  return [...(fr.touches || [])].sort((a, b) => (a.date === b.date ? (b.t || 0) - (a.t || 0) : a.date < b.date ? 1 : -1));
}
export const lastTouch = (fr) => touchesNewestFirst(fr)[0] || null;

// Days since you were last in touch (or since you planted them).
export function daysSince(fr, today) {
  const last = lastTouch(fr);
  return Math.max(0, daysBetween(last ? last.date : fr.added || today, today));
}

// How thirsty: 1 means it's time for a hello, 2 or more is droopy.
export function thirst(fr, today) {
  const days = daysSince(fr, today);
  const r = rhythmOf(fr.rhythm);
  if (!r.days) return Math.min(1.5, days / WHENEVER_DAYS);
  return days / r.days;
}

export function mood(fr, today) {
  const t = thirst(fr, today);
  return t < 1 ? 'fresh' : t < 2 ? 'thirsty' : 'droopy';
}

// Growth counts the different days you were in touch, and never goes back.
export function stage(fr) {
  const days = new Set((fr.touches || []).map((t) => t.date)).size;
  let s = 0;
  while (s < STAGE_AT.length && days >= STAGE_AT[s]) s++;
  return s;
}
export const daysInTouch = (fr) => new Set((fr.touches || []).map((t) => t.date)).size;

// Watered in the last two days: the plant has drops on its leaves.
export function dewy(fr, today) {
  const last = lastTouch(fr);
  return !!last && daysBetween(last.date, today) <= 1;
}

// Days until the next hello is due (0 or less means it's due now).
export function dueIn(fr, today) {
  const r = rhythmOf(fr.rhythm);
  const days = daysSince(fr, today);
  return (r.days || WHENEVER_DAYS) - days;
}

// ---------------------------------------------------------------- birthdays

export function parseBirthday(b) {
  if (typeof b !== 'string') return null;
  const m = /^(?:(\d{4})-)?(\d{2})-(\d{2})$/.exec(b);
  if (!m) return null;
  const year = m[1] ? +m[1] : null, month = +m[2], day = +m[3];
  if (month < 1 || month > 12 || day < 1 || day > 31) return null;
  const maxDay = [31, 29, 31, 30, 31, 30, 31, 31, 30, 31, 30, 31][month - 1];
  if (day > maxDay) return null;
  if (year && !isDay(`${m[1]}-${m[2]}-${m[3]}`)) return null;
  return { year, month, day };
}
const leap = (y) => (y % 4 === 0 && y % 100 !== 0) || y % 400 === 0;

// The next birthday on or after today. Feb 29 falls on Feb 28 in other years.
export function nextBirthday(b, today) {
  const p = parseBirthday(b);
  if (!p) return null;
  let y = +today.slice(0, 4);
  for (let i = 0; i < 2; i++, y++) {
    const day = p.month === 2 && p.day === 29 && !leap(y) ? 28 : p.day;
    const date = `${y}-${pad(p.month)}-${pad(day)}`;
    if (date >= today) return { date, inDays: daysBetween(today, date), turns: p.year ? y - p.year : null };
  }
  return null;
}

export function upcomingBirthdays(friends, today, within = 7) {
  const out = [];
  for (const fr of friends) {
    const n = nextBirthday(fr.birthday, today);
    if (n && n.inDays <= within) out.push({ friend: fr, ...n });
  }
  return out.sort((a, b) => a.inDays - b.inDays || a.friend.name.localeCompare(b.friend.name));
}

export function birthdayText(b) {
  const p = parseBirthday(b);
  if (!p) return '';
  return `${MONTHS[p.month - 1]} ${p.day}${p.year ? `, ${p.year}` : ''}`;
}

export function whenText(inDays, date) {
  if (inDays === 0) return 'Today';
  if (inDays === 1) return 'Tomorrow';
  return weekdayName(date);
}

// ---------------------------------------------------------------- the garden

export const byThirst = (today) => (a, b) => thirst(b, today) - thirst(a, today) || a.name.localeCompare(b.name);

export function dueFriends(friends, today) {
  return friends.filter((f) => thirst(f, today) >= 1).sort(byThirst(today));
}

// Two people to say hello to today: the one waiting longest, and one more,
// from another group when there is one. The second pick stays the same all day.
export function suggestions(friends, today) {
  const due = dueFriends(friends, today);
  if (due.length <= 1) return due;
  const [first, ...rest] = due;
  const other = rest.filter((f) => (f.group || '') !== (first.group || ''));
  const pool = (other.length ? other : rest).slice(0, 4);
  const r = rng(`${today}|${first.id}`);
  return [first, pool[Math.floor(r() * pool.length)]];
}

// When nobody is due, the one who will be next.
export function nextUp(friends, today) {
  const fresh = friends.filter((f) => thirst(f, today) < 1);
  if (!fresh.length) return null;
  return [...fresh].sort((a, b) => dueIn(a, today) - dueIn(b, today) || a.name.localeCompare(b.name))[0];
}

export function inTouchRecently(friends, today, days = 7) {
  return friends.filter((f) => (f.touches || []).some((t) => {
    const n = daysBetween(t.date, today);
    return n >= 0 && n < days;
  }));
}

export function pickKind(friends, r = Math.random) {
  const count = Object.fromEntries(KIND_IDS.map((k) => [k, 0]));
  for (const f of friends) if (f.plant in count) count[f.plant]++;
  const min = Math.min(...Object.values(count));
  const options = KIND_IDS.filter((k) => count[k] === min);
  return options[Math.floor(r() * options.length)];
}

export function uid() {
  return Date.now().toString(36) + Math.random().toString(36).slice(2, 8);
}

// ---------------------------------------------------------------- calendar file

function icsEscape(s) {
  return String(s).replace(/\\/g, '\\\\').replace(/;/g, '\\;').replace(/,/g, '\\,').replace(/\r?\n/g, '\\n');
}
// Lines longer than 75 bytes are folded, as the format asks.
function fold(line) {
  const enc = new TextEncoder();
  if (enc.encode(line).length <= 75) return line;
  const parts = [];
  let cur = '', size = 0;
  for (const ch of line) {
    const n = enc.encode(ch).length;
    if (size + n > (parts.length ? 74 : 75)) {
      parts.push(cur);
      cur = '';
      size = 0;
    }
    cur += ch;
    size += n;
  }
  parts.push(cur);
  return parts.join('\r\n ');
}

export function birthdaysICS(friends, now = new Date()) {
  const stamp = now.toISOString().replace(/[-:]/g, '').replace(/\.\d+Z$/, 'Z');
  const lines = ['BEGIN:VCALENDAR', 'VERSION:2.0', 'PRODID:-//Friend Garden//Birthdays//EN', 'CALSCALE:GREGORIAN', 'METHOD:PUBLISH', 'X-WR-CALNAME:Birthdays'];
  for (const fr of friends) {
    const p = parseBirthday(fr.birthday);
    if (!p) continue;
    const feb29 = p.month === 2 && p.day === 29;
    const y = p.year || (feb29 ? 2000 : 2001);
    const start = `${String(y).padStart(4, '0')}${pad(p.month)}${pad(p.day)}`;
    const end = addDays(`${String(y).padStart(4, '0')}-${pad(p.month)}-${pad(p.day)}`, 1).replace(/-/g, '');
    lines.push('BEGIN:VEVENT', `UID:${icsEscape(fr.id)}-birthday@friend-garden`, `DTSTAMP:${stamp}`,
      `DTSTART;VALUE=DATE:${start}`, `DTEND;VALUE=DATE:${end}`,
      feb29 ? 'RRULE:FREQ=YEARLY;BYMONTH=2;BYMONTHDAY=-1' : 'RRULE:FREQ=YEARLY',
      `SUMMARY:${icsEscape(`${fr.name}'s birthday`)}`, 'TRANSP:TRANSPARENT', 'END:VEVENT');
  }
  lines.push('END:VCALENDAR');
  return lines.map(fold).join('\r\n') + '\r\n';
}
