// Hand-drawn plants, as SVG strings.
//
// Every friend is one plant. A plant has a kind (fern, tulip ...), a growth
// stage (0 seedling .. 4 in full bloom) and a mood (fresh, thirsty, droopy).
// The same seed always draws the same plant, so a friend's fern keeps its
// shape from one visit to the next and only changes when it grows or wilts.
//
// Coordinates: viewBox 0 0 160 200, the plant stands in a little mound of
// soil at (80, 182). Angles are in degrees: 0 points up, 90 right, -90 left,
// 180 down (the same way SVG's rotate() turns a shape that points up).

const R = Math.PI / 180;
const f = (n) => Math.round(n * 10) / 10;

export const KINDS = [
  { id: 'fern', name: 'Fern' },
  { id: 'tulip', name: 'Tulip' },
  { id: 'sunflower', name: 'Sunflower' },
  { id: 'pothos', name: 'Pothos' },
  { id: 'lavender', name: 'Lavender' },
  { id: 'cactus', name: 'Cactus' },
  { id: 'olive', name: 'Olive tree' },
  { id: 'wildflower', name: 'Wildflowers' },
];
export const KIND_IDS = KINDS.map((k) => k.id);
export const kindName = (id) => (KINDS.find((k) => k.id === id) || KINDS[0]).name;

// ---------------------------------------------------------------- helpers

export function rng(seed) {
  let h = 1779033703 ^ String(seed).length;
  for (const ch of String(seed)) {
    h = Math.imul(h ^ ch.charCodeAt(0), 3432918353);
    h = (h << 13) | (h >>> 19);
  }
  let a = h >>> 0;
  return () => {
    a |= 0;
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

const hex2rgb = (h) => [1, 3, 5].map((i) => parseInt(h.slice(i, i + 2), 16));
const rgb2hex = (c) => '#' + c.map((v) => Math.max(0, Math.min(255, Math.round(v))).toString(16).padStart(2, '0')).join('');
export function mix(a, b, t) {
  const A = hex2rgb(a), B = hex2rgb(b);
  return rgb2hex(A.map((v, i) => v + (B[i] - v) * t));
}
function desat(h, t) {
  const [r, g, b] = hex2rgb(h);
  const l = 0.3 * r + 0.59 * g + 0.11 * b;
  return rgb2hex([r + (l - r) * t, g + (l - g) * t, b + (l - b) * t]);
}
const dark = (h, t = 0.3) => mix(h, '#14200f', t);
const light = (h, t = 0.2) => mix(h, '#fffbe6', t);

const dir = (a) => ({ x: Math.sin(a * R), y: -Math.cos(a * R) });
const mv = (p, a, l) => { const d = dir(a); return { x: p.x + d.x * l, y: p.y + d.y * l }; };
const qp = (p0, p1, p2, t) => {
  const u = 1 - t;
  return { x: u * u * p0.x + 2 * u * t * p1.x + t * t * p2.x, y: u * u * p0.y + 2 * u * t * p1.y + t * t * p2.y };
};
const qa = (p0, p1, p2, t) => {
  const u = 1 - t;
  const dx = 2 * u * (p1.x - p0.x) + 2 * t * (p2.x - p1.x);
  const dy = 2 * u * (p1.y - p0.y) + 2 * t * (p2.y - p1.y);
  return Math.atan2(dx, -dy) / R;
};
const P = (p) => `${f(p.x)},${f(p.y)}`;
const sideOf = (a, r) => (a > 0.5 ? 1 : a < -0.5 ? -1 : r() < 0.5 ? -1 : 1);
// Turn an angle toward the ground on its own side by `t` (0..1).
const sag = (a, t, side = a >= 0 ? 1 : -1) => a + (side * 180 - a) * t;
const lerp = (a, b, t) => a + (b - a) * t;

// Colors shift with the mood (greens fade toward straw) and with dusk.
function painter(mood, dusk) {
  const L = { fresh: [0, 0], thirsty: [0.24, 0.1], droopy: [0.48, 0.26] }[mood];
  const F = { fresh: 0, thirsty: 0.12, droopy: 0.34 }[mood];
  const night = (h, t = 0.3) => (dusk ? mix(mix(h, '#26305c', t), '#0b1022', 0.12) : h);
  return {
    leaf: (h) => night(desat(mix(h, '#b8a453', L[0]), L[1])),
    bloom: (h) => night(mix(h, '#c8b494', F), 0.22),
    wood: (h) => night(h),
    raw: (h) => night(h),
  };
}

// ---------------------------------------------------------------- shapes

// A leaf pointing up from (0,0), as path data. `curl` bends the tip sideways.
function leafSides(len, wid, curl = 0) {
  const tx = curl * len, ty = -len;
  return {
    left: `C${f(-wid)},${f(-len * 0.2)} ${f(-wid * 0.9 + tx * 0.55)},${f(-len * 0.72)} ${f(tx)},${f(ty)}`,
    right: `C${f(wid)},${f(-len * 0.2)} ${f(wid * 0.9 + tx * 0.55)},${f(-len * 0.72)} ${f(tx)},${f(ty)}`,
    back: `C${f(wid * 0.9 + tx * 0.55)},${f(-len * 0.72)} ${f(wid)},${f(-len * 0.2)} 0,0`,
    mid: `Q${f(tx * 0.4)},${f(-len * 0.5)} 0,0`,
    vein: `M0,0Q${f(tx * 0.4)},${f(-len * 0.5)} ${f(tx * 0.88)},${f(-len * 0.88)}`,
  };
}

// The side of a leaf that faces the light (top left) gets the lighter tone.
const litLeft = (a) => 0.6 * Math.cos(a * R) + 0.8 * Math.sin(a * R) > 0;

function leaf(c, x, y, a, len, wid, col, o = {}) {
  const s = leafSides(len, wid, o.curl || 0);
  const lo = dark(col, 0.34), hi = light(col, o.hi ?? 0.22);
  const half = litLeft(a) ? `M0,0${s.left}${s.mid}` : `M0,0${s.right}${s.mid}`;
  if (o.anchor !== false) c.anchors.push(mv({ x, y }, a, len * 0.55));
  return `<g transform="translate(${f(x)} ${f(y)}) rotate(${f(a)})"><path d="M0,0${s.left}${s.back}Z" fill="${col}" stroke="${lo}" stroke-width="${o.sw ?? 0.8}" stroke-opacity=".5"/><path d="${half}" fill="${hi}" opacity=".8"/>${o.vein === false ? '' : `<path d="${s.vein}" fill="none" stroke="${lo}" stroke-width=".6" stroke-opacity=".42"/>`}</g>`;
}

// A plain leaf in one tone, for the many little ones (fern pinnae, olive).
function leafLite(x, y, a, len, wid, col, curl = 0) {
  const s = leafSides(len, wid, curl);
  return `<path transform="translate(${f(x)} ${f(y)}) rotate(${f(a)})" d="M0,0${s.left}${s.back}Z" fill="${col}"/>`;
}

function heartD(L, w) {
  return `M0,0C${f(-w * 0.3)},${f(L * 0.16)} ${f(-w * 1.05)},${f(L * 0.12)} ${f(-w)},${f(-L * 0.28)}C${f(-w * 0.95)},${f(-L * 0.62)} ${f(-w * 0.4)},${f(-L * 0.86)} 0,${f(-L)}C${f(w * 0.4)},${f(-L * 0.86)} ${f(w * 0.95)},${f(-L * 0.62)} ${f(w)},${f(-L * 0.28)}C${f(w * 1.05)},${f(L * 0.12)} ${f(w * 0.3)},${f(L * 0.16)} 0,0Z`;
}
function heartHalf(L, w, left) {
  const k = left ? -1 : 1;
  return `M0,0C${f(k * w * 0.3)},${f(L * 0.16)} ${f(k * w * 1.05)},${f(L * 0.12)} ${f(k * w)},${f(-L * 0.28)}C${f(k * w * 0.95)},${f(-L * 0.62)} ${f(k * w * 0.4)},${f(-L * 0.86)} 0,${f(-L)}Z`;
}

function heartLeaf(c, x, y, a, L, w, col, o = {}) {
  const lo = dark(col, 0.36), hi = light(col, 0.2);
  c.anchors.push(mv({ x, y }, a, L * 0.5));
  let streaks = '';
  if (o.variegate) {
    const v = o.variegate;
    const st = (x0, y0, x1, y1, k) => `<path d="M${f(x0 * w)},${f(-y0 * L)}L${f(x1 * w)},${f(-y1 * L)}" stroke="${v}" stroke-width="${f(w * k)}" stroke-linecap="round" opacity=".7"/>`;
    streaks = st(-0.05, 0.3, -0.55, 0.5, 0.13) + st(0.05, 0.52, 0.5, 0.68, 0.1) + st(0.04, 0.16, 0.42, 0.26, 0.08) + st(-0.04, 0.66, -0.3, 0.78, 0.07);
  }
  return `<g transform="translate(${f(x)} ${f(y)}) rotate(${f(a)})"><path d="${heartD(L, w)}" fill="${col}" stroke="${lo}" stroke-width=".8" stroke-opacity=".55"/><path d="${heartHalf(L, w, litLeft(a))}" fill="${hi}" opacity=".55"/>${streaks}<path d="M0,0L0,${f(-L * 0.9)}" stroke="${lo}" stroke-width=".7" stroke-opacity=".45"/></g>`;
}

function petalD(h, w) {
  return `M0,0C${f(-w)},${f(-h * 0.15)} ${f(-w * 0.85)},${f(-h * 0.88)} 0,${f(-h)}C${f(w * 0.85)},${f(-h * 0.88)} ${f(w)},${f(-h * 0.15)} 0,0Z`;
}

// A stem as a quadratic curve, with a thin lighter line along it.
function stem(p0, p1, p2, col, w) {
  const d = `M${P(p0)}Q${P(p1)} ${P(p2)}`;
  return `<path d="${d}" fill="none" stroke="${dark(col, 0.25)}" stroke-width="${f(w)}" stroke-linecap="round"/><path d="${d}" fill="none" stroke="${light(col, 0.25)}" stroke-width="${f(Math.max(0.5, w * 0.35))}" stroke-linecap="round" opacity=".7" transform="translate(-${f(w * 0.18)} 0)"/>`;
}

// ---------------------------------------------------------------- soil

const B = { x: 80, y: 183 };

function soilBack(c) {
  const m = c.mood;
  const top = c.p.raw({ fresh: '#6a4a33', thirsty: '#86684b', droopy: '#a1835f' }[m]);
  let s = `<ellipse cx="80" cy="186" rx="54" ry="8" fill="#1a1208" opacity="${c.dusk ? 0.3 : 0.13}"/>`;
  s += `<path d="M30,182C34,171 126,171 130,182C126,190 34,190 30,182Z" fill="${top}"/>`;
  s += `<path d="M38,179C52,173 108,173 122,179" fill="none" stroke="${light(top, 0.18)}" stroke-width="2" stroke-linecap="round" opacity=".55"/>`;
  const r = rng(c.seed + 'soil');
  for (let i = 0; i < 7; i++) {
    const x = 40 + r() * 80, y = 176 + r() * 7;
    s += `<ellipse cx="${f(x)}" cy="${f(y)}" rx="${f(1 + r() * 1.6)}" ry="${f(0.8 + r() * 0.8)}" fill="${c.p.raw(m === 'fresh' ? '#3e2a1c' : '#c8b391')}" opacity="${m === 'fresh' ? 0.45 : 0.6}"/>`;
  }
  if (m === 'droopy') {
    s += `<path d="M52,180l5,1.5l3,-2l4,2M98,178l4,2l5,-1.5l3,2.5" fill="none" stroke="${c.p.raw('#6e5637')}" stroke-width=".9" stroke-linecap="round" opacity=".7"/>`;
  }
  return s;
}

function soilFront(c) {
  const m = c.mood;
  const side = c.p.raw({ fresh: '#4b3322', thirsty: '#6a4f36', droopy: '#836648' }[m]);
  return `<path d="M30,182C46,188.5 114,188.5 130,182C126,190.5 34,190.5 30,182Z" fill="${side}"/>`;
}

// ---------------------------------------------------------------- the plants

function fern(c) {
  const { r, d, s, p } = c;
  const out = [];
  const n = [1, 3, 5, 7, 9][s];
  const H = [34, 64, 86, 104, 120][s] * (1 - d * 0.12);
  const base = p.leaf('#4c8a39'), alt = p.leaf('#6aa64a'), rach = p.leaf('#3a6a2a');
  const fronds = [];
  for (let i = 0; i < n; i++) {
    const u = n === 1 ? (r() - 0.5) * 0.4 : (i / (n - 1)) * 2 - 1;
    const a0 = u * 60 + (r() - 0.5) * 10;
    const side = sideOf(a0, r);
    const L = H * (1 - Math.abs(u) * 0.32) * (0.88 + r() * 0.18);
    fronds.push({ u, a0, side, L });
  }
  fronds.sort((a, b) => Math.abs(b.u) - Math.abs(a.u));
  for (const fr of fronds) {
    const p0 = { x: B.x + fr.a0 * 0.08, y: B.y };
    const a1 = fr.a0 + fr.side * (24 + d * 70) * (0.7 + Math.abs(fr.u) * 0.5);
    const p1 = mv(p0, fr.a0 * (1 - d * 0.2), fr.L * 0.56);
    const p2 = mv(p1, Math.max(-170, Math.min(170, a1)), fr.L * 0.48);
    const k = Math.round(7 + fr.L / 8);
    const maxW = 6 + fr.L * 0.13;
    let pin = '';
    for (let j = 1; j <= k; j++) {
      const t = 0.06 + (j / (k + 1)) * 0.94;
      const pt = qp(p0, p1, p2, t), ta = qa(p0, p1, p2, t);
      const w = maxW * Math.pow(1 - t, 0.7) * Math.min(1, (t + 0.05) * 3.2);
      if (w < 1.2) continue;
      const spread = 58 - t * 10;
      const la = ta - spread, ra = ta + spread;
      const hang = d * 0.32;
      pin += leafLite(pt.x, pt.y, sag(la, hang), w, w * 0.3, j % 2 ? base : alt, -0.06);
      pin += leafLite(pt.x, pt.y, sag(ra, hang), w, w * 0.3, j % 2 ? alt : base, 0.06);
      if (j % 4 === 2) c.anchors.push(mv(pt, ra, w * 0.6));
    }
    out.push(`<g>${pin}<path d="M${P(p0)}Q${P(p1)} ${P(p2)}" fill="none" stroke="${rach}" stroke-width="${f(1.1 + fr.L / 90)}" stroke-linecap="round"/></g>`);
  }
  // Fiddleheads: the curled new fronds.
  const curls = s === 0 ? 1 : s >= 2 ? (s === 4 ? 2 : 1) : 0;
  for (let i = 0; i < curls; i++) {
    const side = i ? -1 : 1;
    const h = s === 0 ? 36 : 26 + s * 4;
    const p0 = { x: B.x + side * 4, y: B.y };
    const lean = side * (8 + d * 40);
    const p1 = mv(p0, lean * 0.3, h * 0.6);
    const top = mv(p1, lean, h * 0.45);
    const rad = s === 0 ? 7.5 : 5.5;
    const cx = top.x + side * rad * 0.9, cy = top.y;
    let pts = [];
    for (let th = 0; th <= Math.PI * 3.4; th += 0.25) {
      const rr = rad * (1 - th / (Math.PI * 3.9));
      pts.push({ x: cx - side * Math.cos(th) * rr, y: cy + Math.sin(th) * rr * (side > 0 ? -1 : -1) });
    }
    const col = p.leaf('#6fae4a');
    out.push(`<path d="M${P(p0)}Q${P(p1)} ${P(top)}" fill="none" stroke="${col}" stroke-width="2.6" stroke-linecap="round"/><path d="M${pts.map(P).join('L')}" fill="none" stroke="${col}" stroke-width="3" stroke-linecap="round" stroke-linejoin="round"/><path d="M${pts.slice(0, 9).map(P).join('L')}" fill="none" stroke="${light(col, 0.35)}" stroke-width="1" stroke-linecap="round" opacity=".8"/>`);
  }
  return out.join('');
}

function tulipHead(c, x, y, a, size, col, open, flat = 1) {
  const back = dark(col, 0.22), front = light(col, 0.1), lo = dark(col, 0.4);
  const h = size * 1.55, w = size * 0.62;
  let g = '';
  if (open === 'bud') {
    const bud = mix(col, '#7fae55', 0.35);
    g = `<path d="${petalD(h * 0.9, w * 0.75)}" fill="${bud}" stroke="${dark(bud, 0.35)}" stroke-width=".8" stroke-opacity=".5"/><path d="${petalD(h * 0.8, w * 0.42)}" transform="translate(${f(w * 0.12)} 0)" fill="${light(bud, 0.2)}" opacity=".85"/>`;
  } else {
    const spread = 14 + c.d * 24;
    g += `<path d="${petalD(h * 1.02, w * 0.85)}" fill="${back}" stroke="${lo}" stroke-width=".8" stroke-opacity=".45"/>`;
    g += `<path d="${petalD(h * 0.95, w * 0.8)}" transform="translate(${f(-size * 0.28)} 1) rotate(${f(-spread)})" fill="${col}" stroke="${lo}" stroke-width=".8" stroke-opacity=".45"/>`;
    g += `<path d="${petalD(h * 0.95, w * 0.8)}" transform="translate(${f(size * 0.28)} 1) rotate(${f(spread)})" fill="${dark(col, 0.08)}" stroke="${lo}" stroke-width=".8" stroke-opacity=".45"/>`;
    g += `<path d="${petalD(h * 0.92, w * 0.82)}" transform="translate(0 2)" fill="${front}" stroke="${lo}" stroke-width=".8" stroke-opacity=".45"/>`;
    g += `<path d="M${f(-w * 0.25)},${f(-h * 0.25)}Q${f(-w * 0.4)},${f(-h * 0.6)} ${f(-w * 0.08)},${f(-h * 0.82)}" fill="none" stroke="${light(col, 0.45)}" stroke-width="1.6" stroke-linecap="round" opacity=".6"/>`;
  }
  return `<g transform="translate(${f(x)} ${f(y)}) rotate(${f(a)}) scale(1 ${f(flat)})">${g}</g>`;
}

const TULIP_COLORS = ['#e0533f', '#ef7f9a', '#f1bd3f', '#b65fb0', '#f08a3c', '#f6efe2', '#d8466e'];

function tulip(c) {
  const { r, d, s, p } = c;
  const col = p.bloom(TULIP_COLORS[Math.floor(r() * TULIP_COLORS.length)]);
  const lc = p.leaf('#5f9a52');
  const leaves = s < 3 ? 2 : 3;
  const LL = [20, 44, 56, 64, 70][s];
  const out = [];
  const leafAt = (i) => {
    const sideA = i === 0 ? -1 : i === 1 ? 1 : (r() < 0.5 ? -1 : 1);
    const a = sideA * (i === 2 ? 8 : 18 + r() * 10);
    const a2 = a + sideA * d * 42;
    return leaf(c, B.x + sideA * 3, B.y, a2, LL * (i === 2 ? 0.85 : 1) * (0.9 + r() * 0.2), 9 + s * 0.8, lc, { curl: sideA * (0.12 + d * 0.3), sw: 0.9 });
  };
  out.push(leafAt(0));
  const heads = s < 2 ? 0 : s < 4 ? 1 : 3;
  const flowers = [];
  for (let i = 0; i < heads; i++) {
    const off = heads === 1 ? 0 : [0, -1, 1][i];
    const h = [0, 0, 92, 116, 124][s] * (off ? 0.78 + r() * 0.1 : 1);
    const side = off || (r() < 0.5 ? -1 : 1);
    const lean = off * 9 + (r() - 0.5) * 6;
    const p0 = { x: B.x + off * 4, y: B.y };
    const bend = d * (55 + r() * 25);
    const p1 = mv(p0, lean, h * 0.62);
    const end = mv(p1, lean + side * bend * 1.5, h * 0.4 * (1 - d * 0.15));
    const ang = qa(p0, p1, end, 1);
    flowers.push({ p0, p1, end, ang, size: 15 + s * 1.4 - (off ? 2 : 0) });
  }
  for (const fl of flowers) out.push(stem(fl.p0, fl.p1, fl.end, p.leaf('#5f9a4a'), 3));
  for (let i = 1; i < leaves; i++) out.push(leafAt(i));
  for (const fl of flowers) out.push(tulipHead(c, fl.end.x, fl.end.y + 1, fl.ang, fl.size, col, s === 2 ? 'bud' : 'open', 1 - d * 0.1));
  if (s === 1) out.push(leaf(c, B.x, B.y, 2, 26, 4.5, lc, { curl: 0.05 }));
  if (d === 1 && heads) {
    out.push(`<path d="${petalD(9, 4)}" transform="translate(104 183) rotate(-70)" fill="${col}" stroke="${dark(col, 0.4)}" stroke-width=".6" stroke-opacity=".5"/>`);
  }
  return out.join('');
}

function sunHead(c, x, y, a, Rr, flat) {
  const { p, r } = c;
  const ray = p.bloom('#f5bb2a'), ray2 = p.bloom('#e39a1c'), disc = p.bloom('#5d3518'), ring = p.bloom('#8a5a28');
  const n = Math.round(15 + Rr * 0.3);
  let g = '';
  for (let i = 0; i < n; i++) {
    const ang = (i + 0.5) * (360 / n);
    g += `<path d="${petalD(Rr * 0.95, Rr * 0.17)}" transform="rotate(${f(ang)}) translate(0 ${f(-Rr * 0.38)})" fill="${ray2}"/>`;
  }
  for (let i = 0; i < n; i++) {
    const ang = i * (360 / n) + (r() - 0.5) * 6;
    const len = Rr * (0.82 + r() * 0.16) * (1 - c.d * 0.12);
    g += `<path d="${petalD(len, Rr * 0.17)}" transform="rotate(${f(ang)}) translate(0 ${f(-Rr * 0.42)})" fill="${ray}" stroke="${dark(ray, 0.3)}" stroke-width=".5" stroke-opacity=".5"/>`;
  }
  g += `<circle r="${f(Rr * 0.5)}" fill="${disc}" stroke="${ring}" stroke-width="${f(Rr * 0.07)}"/>`;
  const N = Math.round(Rr * 2.2);
  for (let k = 1; k < N; k++) {
    const rr = Rr * 0.42 * Math.sqrt(k / N), th = k * 137.5 * R;
    g += `<circle cx="${f(Math.cos(th) * rr)}" cy="${f(Math.sin(th) * rr)}" r="${f(0.5 + Rr * 0.025)}" fill="${k % 3 ? '#2f1a0b' : ring}" opacity=".7"/>`;
  }
  g += `<path d="M${f(-Rr * 0.28)},${f(-Rr * 0.18)}A${f(Rr * 0.32)},${f(Rr * 0.32)} 0 0 1 ${f(Rr * 0.06)},${f(-Rr * 0.34)}" fill="none" stroke="#fff3c4" stroke-width="1.2" stroke-linecap="round" opacity=".35"/>`;
  return `<g transform="translate(${f(x)} ${f(y)}) rotate(${f(a)}) scale(1 ${f(flat)})">${g}</g>`;
}

function sunflower(c) {
  const { r, d, s, p } = c;
  const out = [];
  const sc = p.leaf('#5c8f36'), lc = p.leaf('#58913a');
  const H = [24, 52, 96, 120, 128][s] * (1 - d * 0.1);
  const side = r() < 0.5 ? -1 : 1;
  const p0 = { ...B };
  const lean = side * (3 + r() * 4);
  const p1 = mv(p0, lean, H * 0.7);
  const topA = lean + side * d * (s >= 2 ? 120 : 50);
  const end = mv(p1, topA, H * 0.34);
  const w = [2, 2.6, 3.6, 4.4, 5][s];
  // Leaves on short stalks, alternating, big at the bottom.
  const nl = [0, 2, 4, 6, 7][s];
  const leaves = [];
  for (let i = 0; i < nl; i++) {
    const t = 0.18 + (i / Math.max(1, nl)) * 0.62;
    const pt = qp(p0, p1, end, t);
    const ls = i % 2 ? side : -side;
    const size = (s === 1 ? 13 : 17 + (1 - t) * 10) * (0.9 + r() * 0.2);
    const la = ls * (62 + r() * 14);
    const stalkEnd = mv(pt, sag(la, d * 0.25, ls), 5 + size * 0.15);
    leaves.push(`<path d="M${P(pt)}L${P(stalkEnd)}" stroke="${sc}" stroke-width="1.6" stroke-linecap="round"/>` +
      heartLeaf(c, stalkEnd.x, stalkEnd.y, sag(la + ls * 10, d * 0.45, ls), size * 1.25, size * 0.62, lc));
  }
  if (s <= 1) {
    // Seed leaves: two round cotyledons.
    const cy = s === 0 ? end : qp(p0, p1, end, 0.45);
    const ca = qa(p0, p1, end, s === 0 ? 1 : 0.45);
    for (const k of [-1, 1]) {
      const a = sag(ca + k * 62, d * 0.4, k);
      out.push(`<g transform="translate(${P(cy)}) rotate(${f(a)})"><ellipse cx="0" cy="-6.5" rx="4" ry="7" fill="${p.leaf('#79ad4c')}" stroke="${dark(p.leaf('#79ad4c'), 0.35)}" stroke-width=".7" stroke-opacity=".5"/><ellipse cx="-1.2" cy="-7" rx="1.6" ry="4.5" fill="${light(p.leaf('#79ad4c'), 0.3)}" opacity=".7"/></g>`);
      c.anchors.push(mv(cy, a, 7));
    }
  }
  out.push(stem(p0, p1, end, sc, w));
  out.push(leaves.join(''));
  if (s === 1) out.push(leaf(c, end.x, end.y, topA - 25, 9, 4, lc) + leaf(c, end.x, end.y, topA + 25, 9, 4, lc));
  const ea = qa(p0, p1, end, 1);
  if (s === 2) {
    const bud = p.leaf('#6c9a3e');
    let g = '';
    for (let i = 0; i < 9; i++) g += `<path d="${petalD(11, 3.2)}" transform="rotate(${f(-80 + i * 20)})" fill="${i % 2 ? bud : light(bud, 0.15)}" stroke="${dark(bud, 0.35)}" stroke-width=".5" stroke-opacity=".5"/>`;
    g += `<circle r="5.5" fill="${dark(bud, 0.1)}"/><path d="M-4,-3l1.5,-1.5M0,-5.5v2M4,-3l-1.5,-1.5" stroke="${p.bloom('#f5bb2a')}" stroke-width="1.4" stroke-linecap="round"/>`;
    const hp = mv(end, ea, 4);
    out.push(`<g transform="translate(${P(hp)}) rotate(${f(ea)})">${g}</g>`);
  }
  if (s >= 3) {
    if (s === 4) {
      const bt = 0.5, bp = qp(p0, p1, end, bt);
      const ba = qa(p0, p1, end, bt) - side * 52;
      const bmid = mv(bp, ba, 20);
      const bend = mv(bmid, sag(ba + side * 30, d * 0.45, -side), 14);
      out.push(stem(bp, bmid, bend, sc, 2.4));
      out.push(sunHead(c, bend.x, bend.y - 2, sag(ba + side * 30, d * 0.5, -side) * 0.5, 11, 1 - d * 0.3));
    }
    const Rr = s === 3 ? 21 : 25;
    const hp = mv(end, ea, Rr * 0.35);
    const tilt = d > 0 ? ea * 0.75 : ea * 0.4;
    out.push(sunHead(c, hp.x, hp.y, tilt, Rr, 1 - d * 0.42));
  }
  return out.join('');
}

function pothos(c) {
  const { r, d, s, p } = c;
  const out = [];
  const lc = p.leaf('#3f8c3c'), vc = p.leaf('#5d9440'), cream = p.bloom('#f1ebb4');
  const yellow = p.bloom('#d9c255');
  const H = [0, 0, 92, 116, 136][s];
  if (s >= 2) {
    const sx = 80, top = B.y - H - 6;
    const stake = p.wood('#c2a06a');
    out.push(`<path d="M${sx},${B.y + 2}L${sx},${top}" stroke="${dark(stake, 0.25)}" stroke-width="4.2" stroke-linecap="round"/><path d="M${sx - 0.8},${B.y}L${sx - 0.8},${top + 1}" stroke="${light(stake, 0.3)}" stroke-width="1.2" stroke-linecap="round" opacity=".8"/>`);
    for (let y = B.y - 24; y > top + 8; y -= 26) out.push(`<path d="M${sx - 2.5},${y}h5" stroke="${dark(stake, 0.4)}" stroke-width="1" opacity=".5"/>`);
  }
  const leaves = [];
  const addLeaf = (pt, a, size, i) => {
    const ls = a >= 0 ? 1 : -1;
    const hang = sag(a, d * 0.55, ls);
    const stalk = mv(pt, hang * 0.6, 3 + size * 0.15);
    const isYellow = d === 1 && i % 4 === 1;
    leaves.push(`<path d="M${P(pt)}L${P(stalk)}" stroke="${vc}" stroke-width="1.2" stroke-linecap="round"/>` +
      heartLeaf(c, stalk.x, stalk.y, hang, size * 1.15, size * 0.62, isYellow ? yellow : lc, { variegate: isYellow ? null : cream }));
  };
  if (s <= 1) {
    const h = s === 0 ? 22 : 40;
    const side = r() < 0.5 ? -1 : 1;
    const p0 = { ...B }, p1 = mv(p0, side * 10, h * 0.6), end = mv(p1, side * (30 + d * 60), h * 0.5);
    out.push(`<path d="M${P(p0)}Q${P(p1)} ${P(end)}" fill="none" stroke="${vc}" stroke-width="1.8" stroke-linecap="round"/>`);
    const nl = s === 0 ? 2 : 4;
    for (let i = 0; i < nl; i++) {
      const t = 0.45 + (i / nl) * 0.55;
      const pt = qp(p0, p1, end, t);
      addLeaf(pt, (i % 2 ? 1 : -1) * (45 + r() * 20), s === 0 ? 9 + i * 2 : 10 + i * 1.6, i);
    }
    out.push(leaves.join(''));
    return out.join('');
  }
  // The vine climbing the stake.
  const top = B.y - H + d * 10;
  const pts = [];
  for (let y = B.y; y >= top; y -= 3) {
    const t = (B.y - y) / H;
    const sway = Math.sin(t * Math.PI * 4 + 1) * 6;
    const droopOff = d * Math.max(0, t - 0.6) * 60;
    pts.push({ x: 80 + sway + droopOff * (r() < 2 ? 1 : 1), y: y + d * Math.max(0, t - 0.7) * 30 });
  }
  out.push(`<path d="M${pts.map(P).join('L')}" fill="none" stroke="${vc}" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/>`);
  const nl = [0, 0, 7, 10, 13][s];
  for (let i = 0; i < nl; i++) {
    const t = 0.12 + (i / nl) * 0.86;
    const pt = pts[Math.min(pts.length - 1, Math.round(t * (pts.length - 1)))];
    const ls = i % 2 ? 1 : -1;
    addLeaf(pt, ls * (40 + r() * 30), 11 + (1 - t) * 5 + r() * 3, i);
  }
  // Trailing vines down the sides of the mound.
  const trails = s === 3 ? [1] : s === 4 ? [1, -1] : [];
  for (const k of trails) {
    const p0 = { x: 80 + k * 4, y: B.y - 30 - (k < 0 ? 12 : 0) };
    const p1 = { x: 80 + k * (40 + d * 6), y: B.y - 40 + d * 14 };
    const end = { x: 80 + k * 58, y: B.y + 4 };
    out.push(`<path d="M${P(p0)}Q${P(p1)} ${P(end)}" fill="none" stroke="${vc}" stroke-width="1.6" stroke-linecap="round"/>`);
    const m = s === 4 ? 5 : 4;
    for (let i = 0; i < m; i++) {
      const t = 0.2 + (i / m) * 0.8;
      const pt = qp(p0, p1, end, t);
      const ta = qa(p0, p1, end, t);
      addLeaf(pt, (i % 2 ? ta - 70 : ta + 70) * 0.6 + k * 40, 10 + r() * 3, i + 1);
    }
  }
  out.push(leaves.join(''));
  return out.join('');
}

function lavender(c) {
  const { r, d, s, p } = c;
  const out = [];
  const lc = p.leaf('#86a284'), sc = p.leaf('#7d9a72');
  const purple = s === 1 ? mix(p.bloom('#8a68bd'), p.leaf('#7d9a72'), 0.45) : p.bloom('#8565bb');
  const nSp = [0, 4, 7, 11, 15][s];
  const H = [0, 56, 84, 108, 124][s] * (1 - d * 0.1);
  const spikes = [];
  for (let i = 0; i < nSp; i++) {
    const u = nSp === 1 ? 0 : (i / (nSp - 1)) * 2 - 1;
    const a = u * (26 + d * 22) + (r() - 0.5) * 8;
    const L = H * (0.78 + r() * 0.26) * (1 - Math.abs(u) * 0.15);
    const side = sideOf(a, r);
    const p0 = { x: B.x + u * 6, y: B.y };
    const p1 = mv(p0, a, L * 0.6);
    const end = mv(p1, a + side * d * 85, L * 0.42);
    spikes.push({ p0, p1, end, L, u });
  }
  spikes.sort((x, y) => Math.abs(y.u) - Math.abs(x.u));
  for (const sp of spikes) {
    let g = `<path d="M${P(sp.p0)}Q${P(sp.p1)} ${P(sp.end)}" fill="none" stroke="${sc}" stroke-width="1.3" stroke-linecap="round"/>`;
    const m = 9;
    const flen = 20 + sp.L * 0.12;
    for (let j = 0; j < m; j++) {
      const t = 1 - (j / m) * (flen / sp.L) * 1.6;
      const pt = qp(sp.p0, sp.p1, sp.end, Math.max(0.3, t));
      const ta = qa(sp.p0, sp.p1, sp.end, Math.max(0.3, t));
      const sz = 1 - j / (m * 1.6);
      const off = (j % 2 ? 1.7 : -1.7) * sz;
      const o = mv(pt, ta + 90, off);
      const col = j % 3 === 0 ? dark(purple, 0.18) : j % 3 === 1 ? purple : light(purple, 0.2);
      g += `<ellipse cx="${f(o.x)}" cy="${f(o.y)}" rx="${f(2.4 * (1 - j / (m * 2.2)))}" ry="${f(3.2 * (1 - j / (m * 2.5)))}" transform="rotate(${f(ta)} ${f(o.x)} ${f(o.y)})" fill="${col}"/>`;
    }
    c.anchors.push(qp(sp.p0, sp.p1, sp.end, 0.55));
    out.push(g);
  }
  // A tuft of narrow gray-green leaves at the base, in front.
  const nT = [6, 9, 12, 14, 16][s];
  const TL = [16, 20, 24, 27, 30][s];
  for (let i = 0; i < nT; i++) {
    const u = (i / (nT - 1)) * 2 - 1;
    const a = u * 70 + (r() - 0.5) * 12;
    out.push(leaf(c, B.x + u * 8, B.y, sag(a, d * 0.3), TL * (0.7 + r() * 0.4) * (1 - Math.abs(u) * 0.25), 1.9, lc, { curl: (a > 0 ? 1 : -1) * 0.15, vein: false, sw: 0.5, anchor: false }));
  }
  return out.join('');
}

function cactus(c) {
  const { r, d, s, p } = c;
  const out = [];
  const body = p.leaf('#5e9547'), hi = light(body, 0.3), lo = dark(body, 0.3);
  const spine = p.raw('#f6efd6');
  const lean = (r() < 0.5 ? -1 : 1) * d * 9;
  const areoles = (x0, y0, x1, y1, step) => {
    let g = '';
    const len = Math.hypot(x1 - x0, y1 - y0);
    for (let t = step / 2; t < len; t += step) {
      const x = x0 + ((x1 - x0) * t) / len, y = y0 + ((y1 - y0) * t) / len;
      g += `<circle cx="${f(x)}" cy="${f(y)}" r=".85" fill="${spine}" opacity=".9"/><path d="M${f(x - 2.6)},${f(y - 1)}L${f(x + 2.6)},${f(y + 1)}M${f(x + 2.6)},${f(y - 1)}L${f(x - 2.6)},${f(y + 1)}M${f(x)},${f(y - 2.6)}V${f(y + 2)}" stroke="${spine}" stroke-width=".45" opacity=".7"/>`;
    }
    return g;
  };
  if (s <= 1) {
    const rx = s === 0 ? 11 : 17, ry = s === 0 ? 10 : 17;
    const cy = -ry + 2, rxx = rx * (1 - d * 0.08);
    let g = `<ellipse cx="0" cy="${cy}" rx="${f(rxx)}" ry="${ry}" fill="${body}" stroke="${dark(body, 0.4)}" stroke-width=".8" stroke-opacity=".5"/><ellipse cx="${f(rxx * 0.35)}" cy="${f(cy + 1)}" rx="${f(rxx * 0.55)}" ry="${f(ry * 0.92)}" fill="${lo}" opacity=".45"/><ellipse cx="${f(-rxx * 0.4)}" cy="${f(cy - 1)}" rx="${f(rxx * 0.4)}" ry="${f(ry * 0.8)}" fill="${hi}" opacity=".55"/>`;
    for (const k of [-0.55, 0, 0.55]) g += `<path d="M${f(k * rx * 0.7)},${f(cy + ry * 0.9)}Q${f(k * rx * 1.1)},${f(cy)} ${f(k * rx * 0.5)},${f(cy - ry * 0.92)}" fill="none" stroke="${lo}" stroke-width=".8" opacity=".55"/>`;
    for (const k of [-0.55, 0, 0.55]) g += areoles(k * rx * 0.85, cy + ry * 0.6, k * rx * 0.55, cy - ry * 0.8, 7);
    if (d === 1) g += `<path d="M${-rx * 0.6},${cy}q3,-2 6,0M${rx * 0.1},${cy + 4}q3,-2 6,0" fill="none" stroke="${lo}" stroke-width=".7" opacity=".6"/>`;
    out.push(`<g transform="translate(${B.x} ${B.y + 1}) rotate(${f(lean)})">${g}</g>`);
    c.anchors.push({ x: B.x - rx * 0.4, y: B.y + cy - ry * 0.3 });
    return out.join('');
  }
  const w = [0, 0, 26, 30, 34][s] * (1 - d * 0.08);
  const h = [0, 0, 62, 92, 112][s] * (1 - d * 0.05);
  let g = '';
  const rl = 'stroke-linecap="round" stroke-linejoin="round" fill="none"';
  const tube = (dpath, tw) => `<path d="${dpath}" ${rl} stroke="${dark(body, 0.45)}" stroke-opacity=".55" stroke-width="${f(tw + 1.4)}"/><path d="${dpath}" ${rl} stroke="${body}" stroke-width="${f(tw)}"/><path d="${dpath}" ${rl} stroke="${lo}" stroke-width="${f(tw * 0.42)}" opacity=".5" transform="translate(${f(tw * 0.27)} 0)"/><path d="${dpath}" ${rl} stroke="${hi}" stroke-width="${f(tw * 0.3)}" opacity=".6" transform="translate(${f(-tw * 0.24)} 0)"/>`;
  // Arms first (behind the body).
  const arms = s === 3 ? [1] : s === 4 ? [1, -1] : [];
  const armTips = [];
  for (const k of arms) {
    const ay = -h * (k > 0 ? 0.42 : 0.55);
    const aw = w * 0.55;
    const out1 = k * (w * 0.5 + 9);
    const up = k > 0 ? 30 : 22;
    const tipY = ay - up + d * (up + 18);
    const dp = `M0,${f(ay + 4)}Q${f(out1)},${f(ay + 4)} ${f(out1)},${f(ay - 6 + d * 8)}L${f(out1 + k * d * 4)},${f(tipY)}`;
    g += tube(dp, aw);
    g += `<path d="M${f(out1 - aw * 0.18)},${f(ay - 6 + d * 8)}L${f(out1 - aw * 0.18 + k * d * 4)},${f(tipY)}" stroke="${hi}" stroke-width="1" opacity=".5"/>`;
    g += areoles(out1 - aw * 0.22, ay - 8 + d * 8, out1 - aw * 0.22, tipY, 8) + areoles(out1 + aw * 0.22, ay - 8 + d * 8, out1 + aw * 0.22, tipY, 8);
    armTips.push({ x: out1 + k * d * 4, y: tipY - (d ? -aw * 0.5 : aw * 0.5) });
  }
  {
    const r0 = w / 2, cy = -h + r0;
    const yAt = (x) => f(cy - Math.sqrt(Math.max(0, r0 * r0 - x * x)));
    const band = (x0, x1) => `M${f(x0)},5L${f(x0)},${yAt(x0)}A${f(r0)},${f(r0)} 0 0 1 ${f(x1)},${yAt(x1)}L${f(x1)},5Z`;
    g += `<path d="M${f(-r0)},5L${f(-r0)},${f(cy)}A${f(r0)},${f(r0)} 0 0 1 ${f(r0)},${f(cy)}L${f(r0)},5Z" fill="${body}" stroke="${dark(body, 0.45)}" stroke-opacity=".55" stroke-width="1.2"/>`;
    g += `<path d="${band(w * 0.14, r0 - 0.6)}" fill="${lo}" opacity=".42"/><path d="${band(-w * 0.4, -w * 0.16)}" fill="${hi}" opacity=".5"/>`;
  }
  for (const k of [-0.32, -0.08, 0.16, 0.36]) {
    g += `<path d="M${f(k * w)},2L${f(k * w)},${f(-h + w * 0.6 - Math.abs(k) * w * 0.4)}" stroke="${k < 0 ? light(body, 0.15) : lo}" stroke-width=".8" opacity=".55"/>`;
  }
  for (const k of [-0.2, 0.04, 0.28]) g += areoles(k * w, -4, k * w, -h + w * 0.55, 8.5);
  if (d === 1) for (let y = -h * 0.2; y > -h * 0.8; y -= 14) g += `<path d="M${f(-w * 0.3)},${f(y)}q${f(w * 0.3)},-2.5 ${f(w * 0.6)},0" fill="none" stroke="${lo}" stroke-width=".7" opacity=".55"/>`;
  // A flower on top once it's grown.
  if (s === 4) {
    const pink = p.bloom('#ef7aa0');
    const fy = -h - 1;
    let fl = '';
    const n = 9;
    for (let i = 0; i < n; i++) {
      const ang = -80 + (i / (n - 1)) * 160;
      fl += `<path d="${petalD(d ? 7 : 10, 3.2)}" transform="rotate(${f(ang * (d ? 0.5 : 1))})" fill="${i % 2 ? pink : light(pink, 0.18)}" stroke="${dark(pink, 0.35)}" stroke-width=".5" stroke-opacity=".5"/>`;
    }
    fl += `<circle r="2.6" fill="${p.bloom('#f6cf4a')}"/>`;
    g += `<g transform="translate(0 ${f(fy)})">${fl}</g>`;
    if (armTips[0] && !d) g += `<g transform="translate(${f(armTips[0].x)} ${f(armTips[0].y - 2)}) scale(.6)">${fl}</g>`;
  }
  c.anchors.push({ x: B.x - w * 0.15 + lean, y: B.y - h * 0.5 }, { x: B.x + w * 0.1, y: B.y - h * 0.75 });
  out.push(`<g transform="translate(${B.x} ${B.y}) rotate(${f(lean)})">${g}</g>`);
  return out.join('');
}

function olive(c) {
  const { r, d, s, p } = c;
  const out = [];
  const bark = p.wood('#7c6650'), barkHi = light(bark, 0.3);
  const top = p.leaf('#56744a'), under = p.leaf('#a9bba0'), yellow = p.bloom('#c9b25a');
  const H = [26, 56, 74, 94, 108][s] * (1 - d * 0.06);
  const leafPair = (pt, ta, size, i) => {
    let g = '';
    for (const k of [-1, 1]) {
      const a = sag(ta + k * (48 + r() * 12), d * 0.5, k);
      const col = d === 1 && (i + k) % 5 === 0 ? yellow : r() < 0.3 ? under : top;
      g += leafLite(pt.x, pt.y, a, size * (0.85 + r() * 0.3), size * 0.22, col, k * (0.08 + d * 0.15));
      if (i % 3 === 0 && k > 0) c.anchors.push(mv(pt, a, size * 0.6));
    }
    return g;
  };
  // A stake for the young tree.
  if (s >= 1 && s <= 3) {
    const st = p.wood('#c4a574');
    out.push(`<path d="M90,${B.y + 2}L90,${f(B.y - H * 0.78)}" stroke="${dark(st, 0.2)}" stroke-width="2.6" stroke-linecap="round"/>`);
  }
  // The trunk: a tapered, slightly twisting shape.
  const side = r() < 0.5 ? -1 : 1;
  const p0 = { ...B }, p1 = mv(p0, side * 6, H * 0.55), end = mv(p1, -side * 4 + side * d * 12, H * 0.5);
  const tw = [1.6, 2.6, 4, 5.4, 7][s];
  const L = [], Rt = [];
  for (let i = 0; i <= 10; i++) {
    const t = i / 10, pt = qp(p0, p1, end, t), ta = qa(p0, p1, end, t);
    const w = tw * (1 - t * 0.65) / 2;
    L.push(mv(pt, ta - 90, w));
    Rt.push(mv(pt, ta + 90, w));
  }
  out.push(`<path d="M${L.map(P).join('L')}L${Rt.reverse().map(P).join('L')}Z" fill="${bark}" stroke="${dark(bark, 0.35)}" stroke-width=".6"/>`);
  if (s >= 2) out.push(`<path d="M${P(qp(p0, p1, end, 0.05))}Q${P(mv(p1, -90, tw * 0.2))} ${P(qp(p0, p1, end, 0.8))}" fill="none" stroke="${barkHi}" stroke-width="${f(tw * 0.22)}" opacity=".6" stroke-linecap="round"/>`);
  if (s >= 1 && s <= 3) out.push(`<path d="M${f(qp(p0, p1, end, 0.55).x - tw / 2 - 1)},${f(qp(p0, p1, end, 0.55).y)}L91.5,${f(qp(p0, p1, end, 0.55).y + 1)}" stroke="${p.raw('#e6d6aa')}" stroke-width="1.6" stroke-linecap="round"/>`);
  // Branches.
  const nb = [0, 0, 2, 4, 5][s];
  const branches = [];
  for (let i = 0; i < nb; i++) {
    const t = 0.48 + (i / Math.max(1, nb)) * 0.44;
    const bp = qp(p0, p1, end, t);
    const k = i % 2 ? 1 : -1;
    const ba = k * (38 + r() * 18);
    const bl = (H * 0.42) * (1 - t * 0.35) * (0.85 + r() * 0.3);
    const b1 = mv(bp, ba, bl * 0.55);
    const b2 = mv(b1, sag(ba + k * 12, d * 0.35, k), bl * 0.5);
    branches.push({ bp, b1, b2, bl });
    out.push(`<path d="M${P(bp)}Q${P(b1)} ${P(b2)}" fill="none" stroke="${bark}" stroke-width="${f(tw * 0.45)}" stroke-linecap="round"/>`);
  }
  // Leaves on the branches and the top.
  let lv = '';
  const size = [11, 13, 15, 16, 17][s];
  for (const b of branches) {
    const m = 4;
    for (let j = 1; j <= m; j++) {
      const t = 0.25 + (j / m) * 0.75;
      lv += leafPair(qp(b.bp, b.b1, b.b2, t), qa(b.bp, b.b1, b.b2, t), size, j);
    }
    lv += leafLite(b.b2.x, b.b2.y, sag(qa(b.bp, b.b1, b.b2, 1), d * 0.4), size, size * 0.22, top);
  }
  const tl = [3, 4, 4, 4, 5][s];
  for (let j = 0; j < tl; j++) {
    const t = 1 - j * (s === 0 ? 0.18 : 0.1);
    lv += leafPair(qp(p0, p1, end, t), qa(p0, p1, end, t), size, j);
  }
  const ta = qa(p0, p1, end, 1);
  lv += leafLite(end.x, end.y, sag(ta, d * 0.4), size * 0.9, size * 0.22, top);
  out.push(lv);
  // Olives once it's grown.
  if (s === 4 && d < 1) {
    for (const b of branches.slice(0, 4)) {
      const pt = qp(b.bp, b.b1, b.b2, 0.7);
      for (let k = 0; k < 3; k++) {
        const ox = pt.x + (k - 1) * 3.6, oy = pt.y + 5 + (k % 2) * 2.5;
        const col = p.bloom(k === 1 ? '#7e8c3c' : '#3f3352');
        out.push(`<path d="M${P(pt)}L${f(ox)},${f(oy - 2)}" stroke="${bark}" stroke-width=".6"/><ellipse cx="${f(ox)}" cy="${f(oy)}" rx="2.4" ry="3.1" fill="${col}"/><circle cx="${f(ox - 0.8)}" cy="${f(oy - 1)}" r=".7" fill="#fff" opacity=".45"/>`);
      }
    }
  }
  if (d === 1) out.push(leafLite(58, 184, -78, 12, 2.8, yellow, 0.1));
  return out.join('');
}

function wildHead(c, type, x, y, a, sz, flat) {
  const { p } = c;
  let g = '';
  if (type === 'bud') {
    const bud = p.leaf('#7aa451');
    g = `<ellipse cx="0" cy="-3" rx="2.8" ry="4" fill="${bud}"/><path d="M-1,-6.5q1,-1.5 2,0" stroke="${p.bloom('#f2f0e6')}" stroke-width="1.2" fill="none"/>`;
  } else if (type === 'daisy') {
    const w = p.bloom('#fbf7ec');
    for (let i = 0; i < 13; i++) g += `<path d="${petalD(sz, sz * 0.22)}" transform="rotate(${f(i * 27.7)})" fill="${w}" stroke="${dark(w, 0.25)}" stroke-width=".4" stroke-opacity=".6"/>`;
    g += `<circle r="${f(sz * 0.36)}" fill="${p.bloom('#f2bd34')}"/><circle cx="${f(-sz * 0.1)}" cy="${f(-sz * 0.1)}" r="${f(sz * 0.14)}" fill="#fff4c0" opacity=".6"/>`;
  } else if (type === 'poppy') {
    const red = p.bloom('#e4523a');
    for (const [ang, k] of [[-40, 0.12], [40, 0.12], [-8, 0], [12, -0.1]]) g += `<path d="M0,0C${f(-sz * 1.1)},${f(-sz * 0.2)} ${f(-sz * 0.9)},${f(-sz * 1.4)} 0,${f(-sz * 1.2)}C${f(sz * 0.9)},${f(-sz * 1.4)} ${f(sz * 1.1)},${f(-sz * 0.2)} 0,0Z" transform="rotate(${ang})" fill="${k > 0 ? dark(red, k) : light(red, -k)}" stroke="${dark(red, 0.35)}" stroke-width=".5" stroke-opacity=".5"/>`;
    g += `<circle cy="${f(-sz * 0.35)}" r="${f(sz * 0.26)}" fill="#2c2427"/>`;
  } else if (type === 'cornflower') {
    const blue = p.bloom('#4f78d6');
    for (let i = 0; i < 9; i++) g += `<path d="M0,0L${f(-sz * 0.28)},${f(-sz * 0.95)}L${f(-sz * 0.08)},${f(-sz * 0.8)}L0,${f(-sz * 1.08)}L${f(sz * 0.08)},${f(-sz * 0.8)}L${f(sz * 0.28)},${f(-sz * 0.95)}Z" transform="rotate(${f(i * 40)})" fill="${i % 2 ? blue : light(blue, 0.15)}"/>`;
    g += `<circle r="${f(sz * 0.3)}" fill="${dark(blue, 0.35)}"/>`;
  } else {
    const yel = p.bloom('#f3c53a');
    for (let i = 0; i < 5; i++) g += `<ellipse cy="${f(-sz * 0.55)}" rx="${f(sz * 0.42)}" ry="${f(sz * 0.55)}" transform="rotate(${i * 72})" fill="${yel}" stroke="${dark(yel, 0.3)}" stroke-width=".5" stroke-opacity=".5"/>`;
    g += `<circle r="${f(sz * 0.28)}" fill="${dark(yel, 0.25)}"/><ellipse cx="${f(-sz * 0.3)}" cy="${f(-sz * 0.65)}" rx="${f(sz * 0.12)}" ry="${f(sz * 0.2)}" fill="#fff" opacity=".55"/>`;
  }
  return `<g transform="translate(${f(x)} ${f(y)}) rotate(${f(a)}) scale(1 ${f(flat)})">${g}</g>`;
}

const WILD = ['daisy', 'poppy', 'cornflower', 'buttercup'];

function wildflower(c) {
  const { r, d, s, p } = c;
  const out = [];
  const g1 = p.leaf('#6d9c4a'), g2 = p.leaf('#89b45c'), g3 = p.leaf('#557f3a');
  const nG = [7, 10, 12, 15, 18][s];
  const GL = [20, 28, 34, 40, 44][s];
  const blades = [];
  for (let i = 0; i < nG; i++) {
    const u = (i / (nG - 1)) * 2 - 1;
    const a = u * 62 + (r() - 0.5) * 14;
    blades.push(leaf(c, B.x + u * 10, B.y, sag(a, d * 0.3), GL * (0.7 + r() * 0.5) * (1 - Math.abs(u) * 0.2), 2.2, [g1, g2, g3][i % 3], { curl: (a >= 0 ? 1 : -1) * (0.2 + d * 0.3), vein: false, sw: 0.4, hi: 0.12, anchor: i % 4 === 0 }));
  }
  const nF = [1, 1, 3, 5, 8][s];
  const H = [22, 40, 60, 76, 88][s] * (1 - d * 0.1);
  const types = [];
  const first = Math.floor(r() * WILD.length);
  for (let i = 0; i < nF; i++) types.push(s === 0 ? 'bud' : WILD[(first + i * (1 + (i % 2))) % WILD.length]);
  const flowers = [];
  for (let i = 0; i < nF; i++) {
    const u = nF === 1 ? (r() - 0.5) * 0.3 : (i / (nF - 1)) * 2 - 1;
    const a = u * 30 + (r() - 0.5) * 12;
    const side = sideOf(a, r);
    const L = H * (0.72 + r() * 0.36);
    const p0 = { x: B.x + u * 9, y: B.y };
    const p1 = mv(p0, a, L * 0.6);
    const end = mv(p1, a * 0.6 + side * d * (70 + r() * 25), L * 0.42 * (1 - d * 0.2));
    flowers.push({ p0, p1, end, type: types[i], ta: qa(p0, p1, end, 1), u });
  }
  out.push(blades.slice(0, Math.ceil(nG / 2)).join(''));
  for (const fl of flowers) {
    out.push(`<path d="M${P(fl.p0)}Q${P(fl.p1)} ${P(fl.end)}" fill="none" stroke="${p.leaf('#5f8d40')}" stroke-width="1.3" stroke-linecap="round"/>`);
    if (fl.type === 'daisy' || fl.type === 'cornflower') {
      const lp = qp(fl.p0, fl.p1, fl.end, 0.4);
      out.push(leafLite(lp.x, lp.y, sag(qa(fl.p0, fl.p1, fl.end, 0.4) + (fl.u >= 0 ? 40 : -40), d * 0.4), 9, 2, g2, 0.1));
    }
  }
  for (const fl of flowers) {
    const sz = fl.type === 'bud' ? 1.2 : fl.type === 'poppy' ? 10 : fl.type === 'daisy' ? 11 : 9;
    const facing = fl.type === 'poppy' || fl.type === 'bud' ? fl.ta : fl.ta * 0.35;
    const flat = fl.type === 'poppy' || fl.type === 'bud' ? 1 : 0.7 - d * 0.15;
    out.push(wildHead(c, fl.type, fl.end.x, fl.end.y, d > 0.5 ? fl.ta : facing + (fl.ta - facing) * d, sz * (0.8 + s * 0.06), flat));
  }
  out.push(blades.slice(Math.ceil(nG / 2)).join(''));
  if (d === 1 && s >= 2) out.push(`<path d="M0,0C-5,-1 -5,-8 0,-7C5,-8 5,-1 0,0Z" transform="translate(110 184) rotate(100)" fill="${p.bloom('#e4523a')}" opacity=".9"/>`);
  return out.join('');
}

const DRAW = { fern, tulip, sunflower, pothos, lavender, cactus, olive, wildflower };

// ---------------------------------------------------------------- public

let uidN = 0;
const cache = new Map();

export const MOODS = ['fresh', 'thirsty', 'droopy'];

// How high each kind reaches at each stage (the top of its tallest drawing,
// over every mood and many seeds). With crop, the empty sky above the plant
// is left out, so short plants take less room. A unit test checks it holds.
export const TOPS = {
  fern: [138, 114, 90, 71, 55], tulip: [160, 135, 65, 34, 24], sunflower: [147, 119, 67, 20, 6],
  pothos: [148, 123, 81, 59, 38], lavender: [166, 123, 91, 66, 48], cactus: [164, 149, 121, 91, 59],
  olive: [145, 112, 91, 62, 45], wildflower: [151, 127, 103, 85, 71],
};

// plantSVG({kind, stage, mood, seed, dusk, dew, label, crop, inset}) -> '<svg ...>'
export function plantSVG(o = {}) {
  const kind = DRAW[o.kind] ? o.kind : 'fern';
  const stage = Math.max(0, Math.min(4, o.stage | 0));
  const mood = MOODS.includes(o.mood) ? o.mood : 'fresh';
  const key = [kind, stage, mood, o.seed, !!o.dusk, !!o.dew].join('|');
  let inner = cache.get(key);
  if (!inner) {
    const c = {
      r: rng(`${o.seed}|${kind}`), s: stage, mood, dusk: !!o.dusk,
      d: { fresh: 0, thirsty: 0.3, droopy: 1 }[mood],
      p: painter(mood, !!o.dusk), seed: String(o.seed), anchors: [], uid: `fg${++uidN}`,
    };
    const plant = DRAW[kind](c);
    let dew = '';
    if (o.dew && mood === 'fresh' && c.anchors.length) {
      const rr = rng(c.seed + 'dew');
      for (let i = 0; i < 3; i++) {
        const a = c.anchors[Math.floor(rr() * c.anchors.length)];
        dew += `<g transform="translate(${f(a.x)} ${f(a.y)})"><path d="M0,-3.2C1.6,-1 2.2,0 2.2,.8A2.2,2.2 0 0 1 -2.2,.8C-2.2,0 -1.6,-1 0,-3.2Z" fill="#dff1ff" stroke="#7fb3d9" stroke-width=".5" opacity=".9"/><circle cx="-.7" cy=".3" r=".6" fill="#fff"/></g>`;
      }
    }
    inner = `${soilBack(c)}<g class="pl" filter="url(#fg-wobble)">${plant}</g>${soilFront(c)}${dew}`;
    if (cache.size > 600) cache.clear();
    cache.set(key, inner);
  }
  const label = o.label ? `<title>${o.label}</title>` : '';
  const aria = o.label ? 'role="img"' : 'aria-hidden="true" focusable="false"';
  const top = o.crop ? Math.max(0, TOPS[kind][stage] - 10) : 0;
  const inset = o.inset || 0;
  return `<svg class="plant-svg mood-${mood}" viewBox="${inset} ${top} ${160 - inset * 2} ${200 - top}" overflow="visible" ${aria}>${label}${inner}</svg>`;
}

// The filter that gives every plant a slightly hand-drawn edge. Put it in the
// page once; each plant refers to it by id.
export const WOBBLE_DEFS = `<filter id="fg-wobble" x="-5%" y="-5%" width="110%" height="110%" color-interpolation-filters="sRGB"><feTurbulence type="fractalNoise" baseFrequency="0.035" numOctaves="2" seed="3" result="n"/><feDisplacementMap in="SourceGraphic" in2="n" scale="2.4" xChannelSelector="R" yChannelSelector="G" result="d"/><feTurbulence type="fractalNoise" baseFrequency="0.16" numOctaves="3" seed="8" result="g"/><feColorMatrix in="g" type="matrix" values="0 0 0 0 0.1  0 0 0 0 0.12  0 0 0 0 0.04  0 0 0 -1 0.56" result="ga"/><feComposite in="ga" in2="d" operator="in" result="gm"/><feMerge><feMergeNode in="d"/><feMergeNode in="gm"/></feMerge></filter>`;
