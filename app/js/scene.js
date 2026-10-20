// Everything around the plants: the sky and hills, fireflies, the watering
// can, a seed packet, and the little line icons.

const ICONS = {
  garden: '<path d="M12 21v-8"/><path d="M12 13c0-4-3-6.5-7-6.5 0 4 3 6.5 7 6.5z"/><path d="M12 11c0-3.6 2.6-6 6.6-6 0 3.6-2.6 6-6.6 6z"/><path d="M5 21h14"/>',
  today: '<circle cx="12" cy="12" r="4"/><path d="M12 2.5v2M12 19.5v2M2.5 12h2M19.5 12h2M5.3 5.3l1.4 1.4M17.3 17.3l1.4 1.4M5.3 18.7l1.4-1.4M17.3 6.7l1.4-1.4"/>',
  add: '<path d="M12 5v14M5 12h14"/>',
  settings: '<path d="M4 7h9M17 7h3M4 17h3M11 17h9"/><circle cx="15" cy="7" r="2.2"/><circle cx="9" cy="17" r="2.2"/>',
  back: '<path d="M14.5 5.5L8 12l6.5 6.5"/>',
  call: '<path d="M7.2 3.8l2.4.5 1.1 3.4-1.7 1.3a10.5 10.5 0 0 0 5.9 5.9l1.3-1.7 3.4 1.1.5 2.4a2 2 0 0 1-2 2.3A15.6 15.6 0 0 1 4.9 5.8a2 2 0 0 1 2.3-2z"/>',
  text: '<path d="M4.5 5.5h15v10.5H10l-5.5 4z"/><path d="M8.5 9.5h7M8.5 12.5h4.5"/>',
  visit: '<path d="M4.5 11L12 4.5l7.5 6.5v8.5h-5v-5.5h-5v5.5h-5z"/>',
  letter: '<path d="M3.5 6.5h17v11h-17z"/><path d="M3.5 7l8.5 6.5L20.5 7"/>',
  voice: '<rect x="9" y="3.5" width="6" height="11" rx="3"/><path d="M5.5 11.5a6.5 6.5 0 0 0 13 0M12 18v2.5"/>',
  drop: '<path d="M12 3.5c3 4 6 7.4 6 10.8a6 6 0 0 1-12 0c0-3.4 3-6.8 6-10.8z"/>',
  download: '<path d="M12 4v11M7 10.5l5 5 5-5M5 20h14"/>',
  upload: '<path d="M12 16V5M7 9.5l5-5 5 5M5 20h14"/>',
  edit: '<path d="M4.5 19.5l1-4.3L16 4.7l3.3 3.3L8.8 18.5z"/><path d="M13.8 7l3.2 3.2"/>',
  trash: '<path d="M5 7h14M10 7V4.5h4V7M7 7l1 12.5h8L17 7"/>',
  list: '<path d="M9 6.5h11M9 12h11M9 17.5h11"/><circle cx="4.8" cy="6.5" r=".9"/><circle cx="4.8" cy="12" r=".9"/><circle cx="4.8" cy="17.5" r=".9"/>',
  sort: '<path d="M7 4.5v15M3.5 16l3.5 3.5 3.5-3.5"/><path d="M13 7h8M13 12h6M13 17h4"/>',
  beds: '<path d="M3.5 9.5h17v4h-17zM3.5 16.5h17v4h-17z"/><path d="M8 9.5V6M12 9.5V5M16 9.5V6.5"/>',
  cake: '<path d="M5 12.5h14v7.5H5z"/><path d="M5 16c2 1.4 3.5 1.4 5 0s3.5-1.4 5 0 3 1.4 4 0"/><path d="M12 12.5V9"/><path d="M12 7c.9-1 .9-1.9 0-3-.9 1.1-.9 2 0 3z"/>',
  calendar: '<path d="M4 6h16v14H4zM4 10h16M8 3.5V7M16 3.5V7"/>',
  close: '<path d="M6.5 6.5l11 11M17.5 6.5l-11 11"/>',
  sun: '<circle cx="12" cy="12" r="4.5"/><path d="M12 2.5v2M12 19.5v2M2.5 12h2M19.5 12h2"/>',
  moon: '<path d="M19 14.5A7.5 7.5 0 0 1 9.5 5a7.5 7.5 0 1 0 9.5 9.5z"/>',
  auto: '<circle cx="12" cy="12" r="7.5"/><path d="M12 4.5v15a7.5 7.5 0 0 0 0-15z" fill="currentColor"/>',
  up: '<path d="M6 14.5l6-6 6 6"/>',
  down: '<path d="M6 9.5l6 6 6-6"/>',
  can: '<path d="M4.5 10.5h9.5l-1 8.4a1.5 1.5 0 0 1-1.5 1.3H7a1.5 1.5 0 0 1-1.5-1.3z"/><path d="M7 10.5c0-3 1.6-4.6 3.2-4.6s3.3 1.6 3.3 4.6"/><path d="M13.8 13.6l5.4-4.8"/><path d="M18 7.1l3 2.9"/>',
};

export function icon(name, cls = '') {
  return `<svg class="ico ${cls}" viewBox="0 0 24 24" aria-hidden="true" focusable="false">${ICONS[name] || ''}</svg>`;
}

// The sky band at the top of every page: sun or moon, clouds, three hills.
export function skySVG() {
  return `
  <div class="sun" aria-hidden="true"></div>
  <svg class="moon" viewBox="0 0 60 60" aria-hidden="true"><path d="M40 6a24 24 0 1 0 14 36A20 20 0 0 1 40 6z"/></svg>
  <div class="stars" aria-hidden="true">${Array.from({ length: 26 }, (_, i) => {
    const x = (i * 37.3) % 100, y = (i * 23.7) % 62, s = i % 5 === 0 ? 3 : 2;
    return `<i style="left:${x.toFixed(1)}%;top:${y.toFixed(1)}%;width:${s}px;height:${s}px;animation-delay:${-(i * 0.7) % 5}s"></i>`;
  }).join('')}</div>
  <div class="clouds" aria-hidden="true">
    <svg class="cloud c1" viewBox="0 0 120 44"><path d="M14 38c-8 0-11-9-4-12 0-9 11-12 17-6 4-10 20-11 25-1 6-6 18-3 18 6 9-2 15 6 10 12z"/></svg>
    <svg class="cloud c2" viewBox="0 0 120 44"><path d="M10 38c-7 0-8-8-2-10 1-8 12-10 16-4 5-9 19-9 23 0 7-4 16 0 15 7 8 0 12 7 6 7z"/></svg>
    <svg class="cloud c3" viewBox="0 0 120 44"><path d="M14 38c-8 0-11-9-4-12 0-9 11-12 17-6 4-10 20-11 25-1 6-6 18-3 18 6 9-2 15 6 10 12z"/></svg>
  </div>
  <svg class="hills" viewBox="0 0 1440 160" preserveAspectRatio="none" aria-hidden="true">
    <path class="h1" d="M0 92C120 60 250 48 380 70s240 34 360 6 270-62 420-44 220 40 280 46V160H0z"/>
    <path class="h2" d="M0 118c160-30 300-40 460-18s260 26 420 0 330-40 560-10V160H0z"/>
    <path class="h3" d="M0 140c220-20 420-24 700-10s520 8 740-6V160H0z"/>
  </svg>`;
}

export function fireflies(n = 16) {
  let s = '';
  for (let i = 0; i < n; i++) {
    const x = (i * 61.7 + 7) % 100, y = 18 + ((i * 41.3) % 76);
    const dur = 9 + (i % 5) * 2.3, blink = 2.4 + (i % 4) * 0.9;
    s += `<i style="left:${x.toFixed(1)}%;top:${y.toFixed(1)}%;--fd:${dur}s;--fb:${blink}s;--fx:${((i % 3) - 1) * 26}px;--fy:${((i % 4) - 1.5) * 18}px;animation-delay:${-(i * 1.3).toFixed(1)}s,${-(i * 0.7).toFixed(1)}s"></i>`;
  }
  return s;
}

// The watering can that tips over a plant, and the drops it pours.
export function wateringCan() {
  let drops = '';
  for (let i = 0; i < 9; i++) drops += `<i style="--dx:${(i % 3) * 7 - 7}px;--dd:${(i * 0.13).toFixed(2)}s"></i>`;
  return `<div class="watering" aria-hidden="true">
    <svg class="can" viewBox="0 0 120 90">
      <path d="M22 34h50l-5 44a6 6 0 0 1-6 5H33a6 6 0 0 1-6-5z" fill="#6aa3b8"/>
      <path d="M22 34h50l-1 8H23z" fill="#5a8fa3"/>
      <path d="M30 40l3 38" stroke="#9cc6d4" stroke-width="4" stroke-linecap="round" opacity=".8"/>
      <path d="M70 46l34-26" stroke="#6aa3b8" stroke-width="7" stroke-linecap="round"/>
      <path d="M98 14l14 16-6 3-12-14z" fill="#5a8fa3"/>
      <path d="M30 34c0-20 34-20 34 0" fill="none" stroke="#5a8fa3" stroke-width="6" stroke-linecap="round"/>
    </svg>
    <div class="drops">${drops}</div>
  </div>`;
}

// A seed packet, for the empty garden.
export function seedPacket() {
  return `<svg class="packet" viewBox="0 0 140 170" aria-hidden="true">
    <path d="M18 14h104l-3 146H21z" fill="var(--tag)" stroke="var(--wood-2)" stroke-width="2"/>
    <path d="M18 14h104l-1 18H19z" fill="var(--wood)" opacity=".85"/>
    <path d="M24 30l4-8 4 8 4-8 4 8 4-8 4 8 4-8 4 8 4-8 4 8 4-8 4 8 4-8 4 8 4-8 4 8 4-8 4 8 4-8 4 8 4-8 4 8" fill="none" stroke="var(--wood-2)" stroke-width="1.5" opacity=".6"/>
    <circle cx="70" cy="84" r="34" fill="var(--accent-soft)"/>
    <path d="M70 112V78" stroke="var(--accent)" stroke-width="4" stroke-linecap="round"/>
    <path d="M70 86c0-12-9-19-22-19 0 12 9 19 22 19z" fill="var(--accent)"/>
    <path d="M70 80c0-11 8-17 20-17 0 11-8 17-20 17z" fill="var(--accent)" opacity=".8"/>
    <path d="M40 132h60M48 144h44" stroke="var(--wood-2)" stroke-width="3" stroke-linecap="round" opacity=".55"/>
  </svg>`;
}
