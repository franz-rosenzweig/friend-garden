#!/usr/bin/env python3
"""Test Friend Garden in headless Chrome, and screenshot every screen.

    tools/walk.py                      serve this folder, run the unit tests, then walk every screen
                                       on a computer and a phone, by day and at dusk, checking as it goes
    tools/walk.py --shots DIR          also save a screenshot of every screen in DIR
    tools/walk.py --url URL            walk a copy that's already served (the unit tests need this folder,
                                       so they're skipped), e.g. --url http://127.0.0.1:8450/friend-garden/
    tools/walk.py --quick              computer by day only

Prints one line per check and any page errors, and exits 1 if anything failed.
"""
import argparse, functools, http.server, json, sys, threading
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parent))
from cdp import Page  # noqa: E402

ROOT = Path(__file__).resolve().parent.parent
FAILS = []


def check(cond, what):
    print(("  ok   " if cond else "  FAIL ") + what)
    if not cond:
        FAILS.append(what)


def serve():
    handler = functools.partial(Quiet, directory=str(ROOT))
    srv = http.server.ThreadingHTTPServer(("127.0.0.1", 0), handler)
    threading.Thread(target=srv.serve_forever, daemon=True).start()
    return f"http://127.0.0.1:{srv.server_address[1]}"


class Quiet(http.server.SimpleHTTPRequestHandler):
    def log_message(self, *a):
        pass

    def end_headers(self):
        self.send_header("Cache-Control", "no-store")
        super().end_headers()


# Things to check on every screen: no sideways scrolling, and big enough touch targets.
LAYOUT = r"""(() => {
  const out = { overflow: document.documentElement.scrollWidth - innerWidth, small: [] };
  const sel = 'button, .btn, .icon-btn, .tabs a, .seg button, .chip span, .how span, .pp-card, .plant, input:not([type=radio]):not([type=file]):not([hidden]), select, textarea, .back';
  for (const el of document.querySelectorAll(sel)) {
    if (el.closest('dialog:not([open])')) continue;
    const r = el.getBoundingClientRect();
    const st = getComputedStyle(el);
    if (!r.width || !r.height || st.visibility === 'hidden' || el.hidden) continue;
    if (r.height < 40 || r.width < 40) out.small.push(`${el.tagName.toLowerCase()}.${[...el.classList].join('.')} "${(el.textContent || el.getAttribute('aria-label') || '').trim().slice(0, 24)}" ${Math.round(r.width)}x${Math.round(r.height)}`);
  }
  return out;
})()"""

DOWNLOADS = r"""(() => {
  window.__dl = [];
  const orig = HTMLAnchorElement.prototype.click;
  HTMLAnchorElement.prototype.click = function () {
    if (this.download) { const a = this; window.__dl.push(fetch(a.href).then((r) => r.text()).then((text) => ({ name: a.download, text }))); return; }
    return orig.call(this);
  };
})()"""


class Walk:
    def __init__(self, base, name, shots, w=1440, h=900, mobile=False, dark=False, reduced=False):
        self.base, self.name, self.shots = base, name, shots
        self.p = Page(w, h, mobile=mobile, dark=dark, reduced=reduced)
        self.p.init_script(DOWNLOADS)

    def go(self, hash_, wait=0.6):
        self.p.js(f"location.hash = {json.dumps(hash_)}")
        self.p.pump(wait)

    def screen(self, label, full=False):
        lay = self.p.js(LAYOUT)
        check(lay["overflow"] <= 0, f"{self.name} {label}: no sideways scrolling ({lay['overflow']}px)")
        check(not lay["small"], f"{self.name} {label}: touch targets 40px+ {lay['small'][:4]}")
        if self.shots:
            self.p.js("document.querySelector('#toast').classList.remove('show')")
            self.p.pump(0.35)
            self.p.shot(Path(self.shots) / f"{self.name}-{label}.png", full=full)

    def errors(self):
        check(not self.p.problems, f"{self.name}: no page errors {self.p.problems[:3]}")
        self.p.problems.clear()

    def state(self, expr):
        return self.p.js(f"(() => {{ const s = window.__fg.state; return {expr}; }})()")


def walk_screens(base, name, shots, **kw):
    print(f"\n{name}")
    w = Walk(base, name, shots, **kw)
    p = w.p
    try:
        p.nav(base, 1.5)
        p.wait("document.querySelector('#view h1')")
        check("ready" in p.js("document.querySelector('#view h1').textContent"), f"{name}: empty garden on first visit")
        w.screen("empty")
        p.click("[data-act=sample-load]")
        p.pump(0.8)
        check(p.js("document.querySelectorAll('.bed .plant[data-plant]').length") == 12, f"{name}: sample garden has 12 plants")
        check(p.js("!!document.querySelector('.sample-bar')"), f"{name}: says the sample people are made up")
        w.screen("garden")
        if shots:
            p.shot(Path(shots) / f"{name}-garden-full.png", full=True)

        p.click("[data-act=sort][data-v=thirsty]")
        first = p.js("document.querySelector('.bed .plant[data-plant] .tag').textContent.trim()")
        check(first == "Juniper Fizzwhistle", f"{name}: thirstiest first starts with the most overdue ({first})")
        w.screen("thirsty")
        p.click("[data-act=view][data-v=list]")
        check(p.js("document.querySelectorAll('.friend-list .row').length") == 12, f"{name}: list view has 12 rows")
        w.screen("list")
        p.click("[data-act=view][data-v=garden]")
        p.click("[data-act=sort][data-v=beds]")

        p.click(".tabs a[data-tab=today]")
        p.pump(0.5)
        names = p.js("[...document.querySelectorAll('.suggest h3')].map((h) => h.textContent.trim())")
        check(len(names) == 2 and names[0] == "Juniper Fizzwhistle", f"{name}: today suggests two, most overdue first {names}")
        check(p.js("document.querySelectorAll('.bday-list li').length") == 2, f"{name}: two birthdays this week")
        check("3 people" in p.js("document.querySelector('.week').textContent"), f"{name}: three in touch this week")
        w.screen("today")

        w.go("#/friend/sample-1")
        check(p.js("document.querySelector('#view h1').textContent") == "Captain Biscuit", f"{name}: friend card")
        hist = p.js("document.querySelectorAll('.timeline li').length")
        w.screen("friend")
        if shots:
            p.shot(Path(shots) / f"{name}-friend-full.png", full=True)

        w.go("#/friend/sample-3")
        check(p.js("document.querySelector('.mood-chip').textContent.trim()") == "Droopy", f"{name}: Juniper is droopy")
        hist = p.js("document.querySelectorAll('.timeline li').length")
        p.click(".friend-info [data-act=talked]")
        p.wait("document.querySelector('#dlg').open")
        check(p.js("document.activeElement.closest('#dlg') !== null"), f"{name}: focus moves into the dialog")
        p.click("#dlg input[name=how][value=visit] + span")
        p.click("#t-note")
        p.type("Tea on the lighthouse steps")
        w.screen("talk")
        p.click("#talk-form button[type=submit]")
        p.wait("document.querySelector('#ask-form')")
        w.screen("ask")
        p.js("document.querySelector('#ask-note').select()")
        p.type("How the lamp repairs went")
        p.click("#ask-form button[type=submit]")
        p.pump(0.9)
        if not kw.get("reduced"):
            check(p.js("!!document.querySelector('.watering')"), f"{name}: the watering can shows up")
            if shots and not kw.get("mobile"):
                p.shot(Path(shots) / f"{name}-watering.png")
        p.wait("!document.querySelector('.watering')", 6)
        p.pump(0.3)
        check(p.js("document.querySelector('.mood-chip').textContent.trim()") == "Fresh", f"{name}: watered plant is fresh again")
        check(p.js("document.querySelectorAll('.timeline li').length") == hist + 1, f"{name}: the visit is in the history")
        check("Tea on the lighthouse steps" in p.js("document.querySelector('.timeline').textContent"), f"{name}: with its note")
        check(p.js("document.querySelector('.ask-box .ask-note').textContent") == "How the lamp repairs went", f"{name}: ask-about note saved")
        check("Watered" in p.js("document.querySelector('#toast').textContent"), f"{name}: says it's watered")
        w.screen("watered")

        p.click(".tabs a[data-tab=add]")
        p.pump(0.4)
        w.screen("add")
        if shots:
            p.shot(Path(shots) / f"{name}-add-full.png", full=True)
        p.click("#friend-form button[type=submit]")
        check(p.js("!document.querySelector('#f-name-err').hidden"), f"{name}: asks for a name")
        p.click("#f-name")
        p.type("Mabel Fernsby")
        p.click("#friend-form input[name=rhythm][value='2weeks'] + span")
        p.click("#friend-form input[name=plant][value=olive] + .pp-card")
        p.js("const s = document.querySelector('#f-group'); s.value = '__new'; s.dispatchEvent(new Event('change', {bubbles: true}))")
        p.click("#f-newgroup")
        p.type("Book club")
        p.js("const f = document.querySelector('#friend-form'); f.bmonth.value = '2'; f.bday.value = '30';")
        p.click("#friend-form button[type=submit]")
        check(p.js("!document.querySelector('#f-bday-err').hidden"), f"{name}: catches February 30")
        p.js("document.querySelector('#friend-form').bday.value = '3'")
        p.click("#f-note")
        p.type("Her quilting show")
        p.click("#friend-form button[type=submit]")
        p.pump(1.2)
        fr = w.state("s.friends.find((f) => f.name === 'Mabel Fernsby')")
        check(fr is not None and fr["rhythm"] == "2weeks" and fr["plant"] == "olive" and fr["birthday"] == "02-03" and fr["note"] == "Her quilting show",
              f"{name}: new friend saved with everything")
        gid = fr and fr["group"]
        check(bool(gid) and w.state(f"s.groups.some((g) => g.id === {json.dumps(gid)} && g.name === 'Book club')"), f"{name}: new group made")
        check(p.js(f"!!document.querySelector('[data-plant={json.dumps(fr['id'])}].planted')"), f"{name}: planted in the garden")
        w.screen("planted")

        w.go(f"#/edit/{fr['id']}")
        w.screen("edit")
        p.js("document.querySelector('#f-name').select()")
        p.type("Mabel F.")
        p.click("#friend-form button[type=submit]")
        p.pump(0.6)
        check(p.js("document.querySelector('#view h1').textContent") == "Mabel F.", f"{name}: edit saved")

        p.click(".tabs a[data-tab=settings]")
        p.pump(0.4)
        w.screen("settings")
        if shots:
            p.shot(Path(shots) / f"{name}-settings-full.png", full=True)

        # Keyboard: Escape closes a dialog, and focus comes back to the page.
        w.go("#/friend/sample-2")
        p.click(".friend-info [data-act=talked]")
        p.wait("document.querySelector('#dlg').open")
        p.key("Escape", "Escape")
        p.pump(0.3)
        check(not p.js("document.querySelector('#dlg').open"), f"{name}: Escape closes the dialog")
        check(p.js("window.__fg.state.friends.find((f) => f.id === 'sample-2').touches.length") == 14, f"{name}: closing logs nothing")
        w.errors()
    finally:
        p.close()


def walk_functions(base):
    print("\nfeatures")
    w = Walk(base, "features", None)
    p = w.p
    try:
        p.nav(base, 1.2)
        p.click("[data-act=sample-load]")
        p.pump(0.5)
        # Remove a history entry.
        w.go("#/friend/sample-7")
        n = p.js("document.querySelectorAll('.timeline li').length")
        p.click(".timeline li [data-act=del-touch]")
        p.wait("document.querySelector('#confirm').open")
        p.click("#confirm button[value=ok]")
        p.pump(0.4)
        check(p.js("document.querySelectorAll('.timeline li').length") == n - 1, "remove a history entry")
        # Change the ask-about note from the card.
        p.click(".ask-box [data-act=edit-note]")
        p.wait("document.querySelector('#ask-form')")
        p.js("document.querySelector('#ask-note').select()")
        p.type("The second gig")
        p.click("#ask-form button[type=submit]")
        p.pump(0.4)
        check(p.js("document.querySelector('.ask-box .ask-note').textContent") == "The second gig", "change the note from the card")
        # Logging yesterday and an earlier day.
        p.click(".friend-info [data-act=talked]")
        p.wait("document.querySelector('#dlg').open")
        p.click("#dlg input[name=when][value=other] + span")
        check(p.js("!document.querySelector('#dlg input[name=date]').hidden"), "Earlier shows a date")
        p.js("document.querySelector('#dlg input[name=date]').value = window.__fg.L.addDays(window.__fg.L.todayISO(), -9)")
        p.click("#talk-form button[type=submit]")
        p.wait("document.querySelector('#ask-form')")
        p.click("#ask-form [data-close]")
        p.pump(2.6)
        dates = p.js("window.__fg.state.friends.find((f) => f.id === 'sample-7').touches.map((t) => t.date)")
        check(p.js("window.__fg.L.addDays(window.__fg.L.todayISO(), -9)") in dates, "log a day in the past")

        # Groups.
        w.go("#/settings")
        p.click("#group-add input")
        p.type("Neighbors")
        p.click("#group-add button")
        check(w.state("s.groups.map((g) => g.name).join()") == "Family,Close friends,Far away,Neighbors", "add a group")
        p.js("const i = [...document.querySelectorAll('[data-group]')].pop(); i.value = 'Next door'; i.dispatchEvent(new Event('change', {bubbles: true}))")
        check(w.state("s.groups[3].name") == "Next door", "rename a group")
        p.click(".group-list li:last-child [data-act=group-up]")
        check(w.state("s.groups.map((g) => g.name).join()") == "Family,Close friends,Next door,Far away", "move a group up")
        p.click(".group-list li:first-child [data-act=group-del]")
        p.wait("document.querySelector('#confirm').open")
        p.click("#confirm button[value=ok]")
        p.pump(0.3)
        check(w.state("!s.groups.some((g) => g.id === 'family') && s.friends.filter((f) => f.sample && !f.group).length === 5"), "remove a group, its plants move to Everyone else")

        # Backup out and back in.
        p.click("[data-act=export]")
        p.pump(0.5)
        dl = p.js("Promise.all(window.__dl)")
        check(len(dl) == 1 and dl[0]["name"].startswith("friend-garden-backup-") and json.loads(dl[0]["text"])["app"] == "Friend Garden", "download a backup")
        backup = dl[0]["text"]
        check(len(json.loads(backup)["friends"]) == 12, "backup has everyone")
        check("Last backup" in p.js("document.querySelector('#view').textContent"), "remembers the last backup")
        p.js("window.__dl = []")
        p.click("[data-act=ics]")
        p.pump(0.5)
        ics = p.js("Promise.all(window.__dl)")
        check(len(ics) == 1 and ics[0]["name"] == "birthdays.ics" and ics[0]["text"].count("BEGIN:VEVENT") == 2, "birthday calendar file")
        p.click("[data-act=wipe]")
        p.wait("document.querySelector('#confirm').open")
        p.click("#confirm button[value=ok]")
        p.pump(0.5)
        check(w.state("s.friends.length") == 0, "remove everything")
        w.go("#/settings")
        p.js(f"""(() => {{ const dt = new DataTransfer(); dt.items.add(new File([{json.dumps(backup)}], 'b.json', {{type: 'application/json'}}));
             const i = document.querySelector('#import-file'); i.files = dt.files; i.dispatchEvent(new Event('change', {{bubbles: true}})); }})()""")
        p.wait("document.querySelector('#confirm').open")
        p.click("#confirm button[value=ok]")
        p.pump(0.6)
        check(w.state("s.friends.length") == 12, "restore a backup")
        w.go("#/settings")
        p.js("""(() => { const dt = new DataTransfer(); dt.items.add(new File(['{"hello": 1}'], 'x.json'));
             const i = document.querySelector('#import-file'); i.files = dt.files; i.dispatchEvent(new Event('change', {bubbles: true})); })()""")
        p.pump(0.5)
        check("isn't a Friend Garden backup" in p.js("document.querySelector('#toast').textContent"), "refuses a file that isn't a backup")

        # It survives a reload.
        p.nav(base, 1.0)
        check(w.state("s.friends.length") == 12, "garden is still there after a reload")

        # Dusk by choice.
        w.go("#/settings")
        p.click("[data-act=theme][data-v=dusk]")
        check(p.js("document.documentElement.dataset.theme") == "dusk", "choose dusk")
        w.go("#/")
        check(p.js("getComputedStyle(document.querySelector('.fireflies')).display") == "block", "fireflies at dusk")
        w.go("#/settings")
        p.click("[data-act=theme][data-v=auto]")

        # Clear the sample, keep your own.
        w.go("#/add")
        p.click("#f-name")
        p.type("Real Person")
        p.click("#friend-form button[type=submit]")
        p.pump(0.6)
        p.click(".sample-bar [data-act=sample-clear]")
        p.wait("document.querySelector('#confirm').open")
        p.click("#confirm button[value=ok]")
        p.pump(0.4)
        check(w.state("s.friends.map((f) => f.name).join()") == "Real Person", "clearing the sample keeps your own friends")
        check(w.state("['fern','tulip','sunflower','pothos','lavender','cactus','olive','wildflower'].includes(s.friends[0].plant)"), "Pick for me picks a plant")
        w.go("#/today")
        check("Everyone is watered" in p.js("document.querySelector('.hello').textContent"), "today with nobody due")

        # Remove a friend.
        fid = w.state("s.friends[0].id")
        w.go(f"#/edit/{fid}")
        p.click("[data-act=remove-friend]")
        p.wait("document.querySelector('#confirm').open")
        p.click("#confirm button[value=ok]")
        p.pump(0.5)
        check(w.state("s.friends.length") == 0 and "ready" in p.js("document.querySelector('#view h1').textContent"), "remove a friend")

        # A link to a plant that isn't there.
        w.go("#/friend/nobody")
        check("isn't here" in p.js("document.querySelector('#view h1').textContent"), "missing plant page")

        # Keyboard only: skip link first, then into a plant.
        w.go("#/")
        p.click("[data-act=sample-load]")
        p.pump(0.5)
        p.nav(base, 1.0)
        p.key("Tab", "Tab")
        check(p.js("document.activeElement.classList.contains('skip')"), "first Tab lands on the skip link")
        p.js("document.querySelector('.bed .plant[data-plant]').focus()")
        p.key("Enter", "Enter", "\r")
        p.pump(0.5)
        check(p.js("location.hash.startsWith('#/friend/')"), "Enter on a plant opens its card")
        w.errors()
    finally:
        p.close()


def walk_no_storage(base):
    print("\nno storage")
    w = Walk(base, "no-storage", None)
    p = w.p
    try:
        p.init_script("Object.defineProperty(window, 'localStorage', { get() { throw new DOMException('blocked', 'SecurityError'); } });")
        p.nav(base, 1.2)
        check(p.js("!!document.querySelector('.note-bar')"), "says nothing is kept when storage is blocked")
        p.click("[data-act=sample-load]")
        p.pump(0.5)
        check(p.js("document.querySelectorAll('.plant[data-plant]').length") == 12, "still works without storage")
        w.go("#/friend/sample-1")
        p.click(".friend-info [data-act=talked]")
        p.wait("document.querySelector('#dlg').open")
        p.click("#talk-form button[type=submit]")
        p.wait("document.querySelector('#ask-form')")
        p.click("#ask-form button[type=submit]")
        p.pump(2.8)
        check(p.js("document.querySelector('.mood-chip').textContent.trim()") == "Fresh", "logging works without storage")
        w.errors()
    finally:
        p.close()


def walk_reduced(base):
    print("\nreduced motion")
    w = Walk(base, "reduced", None, reduced=True)
    p = w.p
    try:
        p.nav(base, 1.2)
        p.click("[data-act=sample-load]")
        p.pump(0.4)
        check(p.js("getComputedStyle(document.querySelector('.plant-art svg')).animationName") == "none", "plants hold still")
        w.go("#/friend/sample-3")
        p.click(".friend-info [data-act=talked]")
        p.wait("document.querySelector('#dlg').open")
        p.click("#talk-form button[type=submit]")
        p.wait("document.querySelector('#ask-form')")
        p.click("#ask-form button[type=submit]")
        p.pump(0.3)
        check(not p.js("!!document.querySelector('.watering')"), "no watering can")
        check(p.js("document.querySelector('.mood-chip').textContent.trim()") == "Fresh", "plant is fresh right away")
        w.errors()
    finally:
        p.close()


def unit(base):
    print("\nunit tests")
    p = Page(900, 700)
    try:
        p.nav(f"{base}/test/unit.html", 0.5)
        p.wait("window.__results", 30)
        for r in p.js("window.__results"):
            check(r["ok"], r["name"] + ("" if r["ok"] else f" ({r['msg']})"))
        check(not p.problems, f"unit page errors {p.problems[:3]}")
    finally:
        p.close()


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--url")
    ap.add_argument("--shots")
    ap.add_argument("--quick", action="store_true")
    a = ap.parse_args()
    if a.url:
        app = a.url
    else:
        root = serve()
        app = f"{root}/app/"
        unit(root)
    variants = [("desktop-day", dict(w=1440, h=900)), ("desktop-dusk", dict(w=1440, h=900, dark=True)),
                ("phone-day", dict(w=390, h=844, mobile=True)), ("phone-dusk", dict(w=390, h=844, mobile=True, dark=True))]
    for name, kw in variants[:1] if a.quick else variants:
        walk_screens(app, name, a.shots, **kw)
    walk_functions(app)
    walk_no_storage(app)
    walk_reduced(app)
    print(f"\n{'All good.' if not FAILS else f'{len(FAILS)} failed:'}")
    for f in FAILS:
        print("  -", f)
    sys.exit(1 if FAILS else 0)


if __name__ == "__main__":
    main()
