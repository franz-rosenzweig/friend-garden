<sub>[Friend Garden docs](README.md) › Under the hood</sub>

# Developing

These are the working notes for changing Friend Garden itself: what each file does, how the plants are drawn, the
tests and deploying. Everything a user needs is in the other pages.

## How it runs

Plain HTML, CSS and ES modules in `app/`, with no framework, no build step and no server of its own. Any static
file server can host the folder, and every path is relative, so it works under a sub-path like `/friend-garden/`.

| File | What |
|---|---|
| `app/index.html`, `app/style.css` | The page. Colors are custom properties, with the dusk set under `prefers-color-scheme: dark` and `[data-theme="dusk"]`. Phone layout below 760 px, the watering list from 1200 px. |
| `app/js/main.js` | Routes (`#/`, `#/today`, `#/friend/ID`, `#/add`, `#/edit/ID`, `#/settings`), the screens, the dialogs, the watering can and the planter layout. `window.__fg` is there for the tests. |
| `app/js/plants.js` | The plants. `plantSVG({kind, stage, mood, seed, dusk, dew, crop, inset})` returns an SVG string. |
| `app/js/logic.js` | Pure functions with `today` passed in: rhythms, thirst and mood, growth, Today's suggestions, birthdays and the .ics file. |
| `app/js/store.js` | localStorage (every call in try/catch), `normalize()` for anything read from storage or a backup, and the backup format. |
| `app/js/sample.js` | The sample garden, with dates counted back from today. |
| `app/js/scene.js` | The sky and hills, fireflies, the watering can, the seed packet and the line icons. |
| `app/sw.js` | A network-first service worker, registered on https only, so the app opens offline without ever serving a stale copy when online. Bump `CACHE` if the file list changes. |
| `app/fonts/` | Fraunces, Nunito and Caveat (latin and latin-ext), self-hosted, with their OFL texts. |
| `app/icon.svg` | The icon. `tools/make_icons.py` renders it to `icon-512.png` and `icon-192.png`. |

## The data

One localStorage key, `friend-garden`, holds `{format, friends, groups, settings}`. A friend is
`{id, name, rhythm, plant, birthday, group, note, added, sample, grown, touches}`, and a touch is
`{id, date, how, note, t}`. Dates are local calendar days as `YYYY-MM-DD`, and a birthday is `MM-DD` or
`YYYY-MM-DD`. `grown` is the biggest stage the plant has reached, so removing a touch never shrinks it. The theme is
also copied to `friend-garden.theme`, which a tiny script in the page head reads before the first paint.

A backup is the same object with `app: "Friend Garden"` and an export time. `readBackup()` refuses anything else and
anything from a newer format, and everything goes through `normalize()`, which drops what it doesn't understand.

## The plants

Each kind is a function in `plants.js` that draws with a few shapes (a leaf, a heart leaf, a petal, a stem) placed
along quadratic curves. A seeded random generator, keyed on the friend's id, decides the small differences, which
is why a plant keeps its shape. The stage sets how many fronds, leaves or flowers there are and how tall it is. The
mood sets `d`, how far stems bend and leaves hang (0, 0.3 or 1), and a painter shifts the greens toward straw when
it's thirsty and every color toward blue when it's dusk.

The hand-drawn look is one SVG filter, `fg-wobble`, defined once in the page: a little displacement for the edges
and a soft noise for the painted texture. `TOPS` records how tall each kind gets at each stage, so `crop` can leave
out the empty sky above short plants. A unit test draws every kind, stage and mood and checks the table still holds,
so if you change a plant, run the tests and update `TOPS` if they say so.

`test/plants.html` shows every plant at once: `?mode=stages`, `?mode=moods&stage=4`, and `&dusk=1`.

## Tests

```
python3 tools/walk.py                  # unit tests, then every screen on a computer and a phone, day and dusk
python3 tools/walk.py --quick          # computer by day only
python3 tools/walk.py --shots /tmp/fg  # and save a screenshot of every screen
python3 tools/walk.py --url http://127.0.0.1:8450/friend-garden/   # a copy that's already served
```

`walk.py` serves this folder on a free port and starts its own headless Chrome (Chrome for Testing by default, or
whatever `CHROME` points to). It needs Python 3 and the `websocket-client` package. First it opens
`test/unit.html` and reads the unit tests. Then, in four sizes and themes, it plants the sample garden and goes
through everything: sorting, the list, Today, a friend's card, logging a talk with real clicks and typing, the
watering, adding a friend (with a new group and a February 30 that it has to refuse), editing and Settings. It
checks for sideways scrolling and touch targets under 40 px on every screen. Then it tests backups out and back in,
the calendar file, groups, removing things, dusk, reloading, a browser that blocks storage and reduced motion. It
prints one line per check and exits 1 if anything failed or the page logged an error.

`tools/docs_shots.py` makes the pictures in `docs/images` from the sample garden, and `tools/make_icons.py` makes
the PNG icons.

## Deploying

```
tools/deploy.sh
```

It copies `app/` with rsync to the folder my web server serves Friend Garden from. For your own server, change
the destination in the script, or copy `app/` anywhere that serves static files.
