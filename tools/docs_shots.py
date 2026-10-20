#!/usr/bin/env python3
"""Make the pictures in docs/images from the sample garden.

    tools/docs_shots.py [OUT_DIR]      default docs/images

Serves this folder on a free port, opens the app in headless Chrome with the
sample garden (made-up people only) and saves every picture the docs use.
"""
import sys
from io import BytesIO
from pathlib import Path

from PIL import Image, ImageDraw

sys.path.insert(0, str(Path(__file__).resolve().parent))
from cdp import Page  # noqa: E402
from walk import serve  # noqa: E402

ROOT = Path(__file__).resolve().parent.parent
HIDE_TOAST = "document.querySelector('#toast').classList.remove('show')"


def app(base, w=1440, h=900, mobile=False, dark=False):
    p = Page(w, h, mobile=mobile, dark=dark)
    p.nav(f"{base}/app/", 1.2)
    p.click("[data-act=sample-load]")
    p.pump(0.6)
    return p


def go(p, hash_, wait=0.7):
    p.js(f"location.hash = '{hash_}'; window.scrollTo(0, 0)")
    p.pump(wait)
    p.js(HIDE_TOAST)
    p.pump(0.3)


def save(p, out, name, full=False):
    path = out / name
    p.shot(path, full=full)
    im = Image.open(path)
    if im.width > 1600:  # phone shots are 2x
        im = im.resize((im.width // 2, im.height // 2), Image.LANCZOS)
    im.convert("RGB").save(path, optimize=True)
    print(path.relative_to(ROOT) if path.is_relative_to(ROOT) else path)


def phones(base, out, dark):
    frames = []
    p = app(base, 390, 844, mobile=True, dark=dark)
    try:
        for hash_ in ("#/", "#/today", "#/friend/sample-7"):
            go(p, hash_)
            path = out / "_phone.png"
            p.shot(path)
            frames.append(Image.open(path).convert("RGB").resize((390, 844), Image.LANCZOS))
            path.unlink()
    finally:
        p.close()
    bg = (25, 36, 42) if dark else (232, 234, 210)
    pad, gap = 40, 36
    sheet = Image.new("RGB", (pad * 2 + 390 * 3 + gap * 2, pad * 2 + 844), bg)
    for i, f in enumerate(frames):
        mask = Image.new("L", f.size, 0)
        ImageDraw.Draw(mask).rounded_rectangle((0, 0, f.width - 1, f.height - 1), 34, fill=255)
        x, y = pad + i * (390 + gap), pad
        shadow = Image.new("RGBA", (f.width + 30, f.height + 30), (0, 0, 0, 0))
        ImageDraw.Draw(shadow).rounded_rectangle((15, 22, f.width + 15, f.height + 22), 34, fill=(0, 0, 0, 60 if dark else 34))
        sheet.paste(shadow, (x - 15, y - 15), shadow)
        sheet.paste(f, (x, y), mask)
    name = f"phones-{'dark' if dark else 'light'}.png"
    sheet.save(out / name, optimize=True)
    print(out / name)


def main():
    out = Path(sys.argv[1]) if len(sys.argv) > 1 else ROOT / "docs/images"
    out.mkdir(parents=True, exist_ok=True)
    base = serve()

    for dark in (False, True):
        tag = "dark" if dark else "light"
        p = app(base, dark=dark)
        try:
            go(p, "#/")
            save(p, out, f"hero-{tag}.png")
            go(p, "#/today")
            save(p, out, f"today-{tag}.png")
            go(p, "#/friend/sample-1")
            save(p, out, f"friend-{tag}.png")
        finally:
            p.close()
        phones(base, out, dark)

    p = app(base)
    try:
        go(p, "#/")
        p.click("[data-act=sort][data-v=thirsty]")
        p.js(HIDE_TOAST)
        p.pump(0.3)
        save(p, out, "thirsty.png")
        p.click("[data-act=view][data-v=list]")
        save(p, out, "list.png")
        p.click("[data-act=view][data-v=garden]")
        p.click("[data-act=sort][data-v=beds]")
        go(p, "#/friend/sample-3")
        p.click(".friend-info [data-act=talked]")
        p.pump(0.4)
        p.click("#dlg input[name=how][value=voice] + span")
        p.click("#t-note")
        p.type("Heard the foghorn in the background")
        save(p, out, "talk.png")
        p.click("#talk-form button[type=submit]")
        p.pump(0.5)
        p.js("document.querySelector('#ask-note').select()")
        p.type("How the lamp repairs went")
        save(p, out, "ask.png")
        p.click("#ask-form button[type=submit]")
        p.pump(1.05)
        save(p, out, "watering.png")
        p.pump(2.2)
        p.js(HIDE_TOAST)
        p.pump(0.4)
        save(p, out, "watered.png")
        go(p, "#/add?group=far")
        p.click("#f-name")
        p.type("Mabel Fernsby")
        p.click("#friend-form input[name=rhythm][value='3months'] + span")
        p.js("const f = document.querySelector('#friend-form'); f.bmonth.value = '3'; f.bday.value = '9';")
        p.click("#f-note")
        p.type("Her quilting show")
        p.js("window.scrollTo(0, 0)")
        save(p, out, "add.png", full=True)
        go(p, "#/settings")
        save(p, out, "settings.png", full=True)
    finally:
        p.close()

    p = Page(1440, 900)
    try:
        p.nav(f"{base}/app/", 1.2)
        save(p, out, "empty.png")
        for name, q, w in (("plants.png", "mode=stages", 1200), ("moods.png", "mode=moods&stage=3", 1200),
                           ("moods-dusk.png", "mode=moods&stage=4&dusk=1", 1200)):
            p.call("Emulation.setDeviceMetricsOverride", width=w, height=600, deviceScaleFactor=1, mobile=False)
            p.w = w
            p.nav(f"{base}/test/plants.html?{q}", 1.2)
            save(p, out, name, full=True)
    finally:
        p.close()


if __name__ == "__main__":
    main()
