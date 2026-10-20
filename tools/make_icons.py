#!/usr/bin/env python3
"""Render app/icon.svg to app/icon-512.png and app/icon-192.png with headless Chrome.

    tools/make_icons.py
"""
import base64, json, os, shutil, subprocess, tempfile, time, urllib.request
from io import BytesIO
from pathlib import Path

import websocket
from PIL import Image

ROOT = Path(__file__).resolve().parent.parent
CHROME = os.environ.get("CHROME", str(Path.home() / ".local/opt/google/chrome-linux64/chrome"))


def main():
    svg = (ROOT / "app/icon.svg").read_text()
    html = f"<!doctype html><style>html,body{{margin:0;background:#fff}}svg{{display:block;width:512px;height:512px}}</style>{svg}"
    prof = tempfile.mkdtemp(prefix="fg-icon-")
    page = Path(prof) / "icon.html"
    page.write_text(html)
    chrome = subprocess.Popen([CHROME, "--headless=new", "--no-sandbox", "--hide-scrollbars", "--remote-allow-origins=*",
                               "--remote-debugging-port=0", f"--user-data-dir={prof}", "about:blank"],
                              stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL)
    try:
        pf = Path(prof) / "DevToolsActivePort"
        for _ in range(100):
            if pf.exists() and pf.read_text().strip():
                break
            time.sleep(0.1)
        port = pf.read_text().split()[0]
        pages = json.load(urllib.request.urlopen(f"http://127.0.0.1:{port}/json/list"))
        ws = websocket.create_connection(next(p for p in pages if p["type"] == "page")["webSocketDebuggerUrl"])
        n = iter(range(1, 999))

        def call(m, **p):
            i = next(n)
            ws.send(json.dumps({"id": i, "method": m, "params": p}))
            while True:
                r = json.loads(ws.recv())
                if r.get("id") == i:
                    return r.get("result", {})

        call("Emulation.setDeviceMetricsOverride", width=512, height=512, deviceScaleFactor=1, mobile=False)
        call("Page.navigate", url=page.as_uri())
        time.sleep(1.5)
        png = base64.b64decode(call("Page.captureScreenshot", format="png")["data"])
    finally:
        chrome.kill()
        chrome.wait()
        shutil.rmtree(prof, ignore_errors=True)
    im = Image.open(BytesIO(png)).convert("RGB")
    im.save(ROOT / "app/icon-512.png", optimize=True)
    im.resize((192, 192), Image.LANCZOS).save(ROOT / "app/icon-192.png", optimize=True)
    print("app/icon-512.png, app/icon-192.png")


if __name__ == "__main__":
    main()
