// Saving the garden in this browser, and backups as a JSON file.
// Every storage call is wrapped, so the garden still works (for this visit)
// when the browser won't keep anything.

import { RHYTHMS, HOWS, isDay, parseBirthday, todayISO, uid } from './logic.js';
import { KIND_IDS } from './plants.js';

const KEY = 'friend-garden';
export const FORMAT = 1;
export const storage = { ok: true };

export const DEFAULT_GROUPS = [
  { id: 'family', name: 'Family' },
  { id: 'close', name: 'Close friends' },
  { id: 'far', name: 'Far away' },
];

export function emptyState() {
  return {
    format: FORMAT,
    friends: [],
    groups: DEFAULT_GROUPS.map((g) => ({ ...g })),
    settings: { sort: 'beds', view: 'garden', theme: 'auto', lastBackup: '' },
  };
}

const str = (v, max = 500) => (typeof v === 'string' ? v.trim().slice(0, max) : '');
const pick = (v, allowed, dflt) => (allowed.includes(v) ? v : dflt);

// Takes anything that looks like a garden and returns a clean one.
export function normalize(raw, today = todayISO()) {
  const out = emptyState();
  if (!raw || typeof raw !== 'object') return out;
  if (Array.isArray(raw.groups)) {
    const seen = new Set();
    out.groups = raw.groups
      .filter((g) => g && typeof g === 'object')
      .map((g) => ({ id: str(g.id, 60) || uid(), name: str(g.name, 40) || 'Group' }))
      .filter((g) => !seen.has(g.id) && seen.add(g.id));
  }
  const groupIds = new Set(out.groups.map((g) => g.id));
  const ids = new Set();
  if (Array.isArray(raw.friends)) {
    for (const f of raw.friends) {
      if (!f || typeof f !== 'object') continue;
      const name = str(f.name, 80);
      if (!name) continue;
      let id = str(f.id, 60) || uid();
      while (ids.has(id)) id = uid();
      ids.add(id);
      const touches = Array.isArray(f.touches) ? f.touches
        .filter((t) => t && isDay(t.date) && t.date <= today)
        .map((t) => ({ id: str(t.id, 60) || uid(), date: t.date, how: pick(t.how, HOWS.map((h) => h.id), 'call'), note: str(t.note), t: Number.isFinite(t.t) ? t.t : 0 })) : [];
      out.friends.push({
        id, name,
        rhythm: pick(f.rhythm, RHYTHMS.map((r) => r.id), 'month'),
        plant: pick(f.plant, KIND_IDS, 'fern'),
        birthday: parseBirthday(f.birthday) ? f.birthday : '',
        group: groupIds.has(f.group) ? f.group : '',
        note: str(f.note),
        added: isDay(f.added) && f.added <= today ? f.added : today,
        sample: f.sample === true,
        touches,
      });
    }
  }
  const s = raw.settings && typeof raw.settings === 'object' ? raw.settings : {};
  out.settings = {
    sort: pick(s.sort, ['beds', 'thirsty'], 'beds'),
    view: pick(s.view, ['garden', 'list'], 'garden'),
    theme: pick(s.theme, ['auto', 'day', 'dusk'], 'auto'),
    lastBackup: isDay(s.lastBackup) ? s.lastBackup : '',
  };
  return out;
}

export function load() {
  let raw = null;
  try {
    const probe = `${KEY}.probe`;
    localStorage.setItem(probe, '1');
    localStorage.removeItem(probe);
    raw = localStorage.getItem(KEY);
    storage.ok = true;
  } catch {
    storage.ok = false;
    return emptyState();
  }
  if (!raw) return emptyState();
  try {
    return normalize(JSON.parse(raw));
  } catch {
    // Keep the unreadable copy aside rather than writing over it.
    try { localStorage.setItem(`${KEY}.unreadable`, raw); } catch { /* nothing more to do */ }
    return emptyState();
  }
}

export function save(state) {
  try {
    localStorage.setItem(KEY, JSON.stringify(state));
    storage.ok = true;
    return true;
  } catch {
    storage.ok = false;
    return false;
  }
}

export function backupJSON(state, now = new Date()) {
  return JSON.stringify({ app: 'Friend Garden', format: FORMAT, exported: now.toISOString(), friends: state.friends, groups: state.groups, settings: { ...state.settings } }, null, 2);
}

export class BackupError extends Error {}

export function readBackup(text) {
  let raw;
  try {
    raw = JSON.parse(text);
  } catch {
    throw new BackupError("That file isn't a Friend Garden backup.");
  }
  if (!raw || raw.app !== 'Friend Garden' || !Array.isArray(raw.friends)) throw new BackupError("That file isn't a Friend Garden backup.");
  if (raw.format > FORMAT) throw new BackupError('That backup is from a newer Friend Garden. Reload the page and try again.');
  return normalize(raw);
}
