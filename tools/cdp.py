"""A small headless Chrome driver over the DevTools protocol, for walk.py.

Needs Chrome for Testing (or whatever CHROME points to) and the Python
websocket-client package.
"""
import json, os, shutil, subprocess, tempfile, time, urllib.request
from base64 import b64decode
from pathlib import Path

import websocket

CHROME = os.environ.get("CHROME", str(Path.home() / ".local/opt/google/chrome-linux64/chrome"))


class Page:
    def __init__(self, w=1440, h=900, mobile=False, dark=False, reduced=False):
        self.prof = tempfile.mkdtemp(prefix="fg-walk-")
        self.chrome = subprocess.Popen(
            [CHROME, "--headless=new", "--no-sandbox", "--hide-scrollbars", "--mute-audio", "--remote-allow-origins=*",
             "--remote-debugging-port=0", f"--user-data-dir={self.prof}", "about:blank"],
            stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL)
        pf = Path(self.prof) / "DevToolsActivePort"
        for _ in range(150):
            if pf.exists() and pf.read_text().strip():
                break
            time.sleep(0.1)
        port = pf.read_text().split()[0]
        pages = json.load(urllib.request.urlopen(f"http://127.0.0.1:{port}/json/list"))
        self.ws = websocket.create_connection(next(p for p in pages if p["type"] == "page")["webSocketDebuggerUrl"])
        self.n = 0
        self.problems = []
        for d in ("Page", "Runtime", "Log"):
            self.call(f"{d}.enable")
        self.w, self.h, self.mobile = w, h, mobile
        self.call("Emulation.setDeviceMetricsOverride", width=w, height=h, deviceScaleFactor=2 if mobile else 1, mobile=mobile)
        if mobile:
            self.call("Emulation.setTouchEmulationEnabled", enabled=True, maxTouchPoints=5)
        self.media(dark, reduced)

    def media(self, dark=False, reduced=False):
        self.call("Emulation.setEmulatedMedia", features=[
            {"name": "prefers-color-scheme", "value": "dark" if dark else "light"},
            {"name": "prefers-reduced-motion", "value": "reduce" if reduced else "no-preference"}])

    def call(self, method, **params):
        self.n += 1
        i = self.n
        self.ws.send(json.dumps({"id": i, "method": method, "params": params}))
        while True:
            m = json.loads(self.ws.recv())
            self.note(m)
            if m.get("id") == i:
                if "error" in m:
                    raise RuntimeError(f"{method}: {m['error']}")
                return m.get("result", {})

    def note(self, m):
        p = m.get("params", {})
        meth = m.get("method")
        if meth == "Runtime.exceptionThrown":
            d = p["exceptionDetails"]
            self.problems.append(d.get("exception", {}).get("description") or d.get("text"))
        elif meth == "Runtime.consoleAPICalled" and p.get("type") in ("error", "assert"):
            self.problems.append("console: " + " ".join(str(a.get("value", a.get("description", ""))) for a in p["args"]))
        elif meth == "Log.entryAdded" and p["entry"]["level"] == "error":
            if "favicon.ico" not in p["entry"].get("url", ""):
                self.problems.append(f'{p["entry"]["text"]} {p["entry"].get("url", "")}'.strip())

    def pump(self, s):
        self.ws.settimeout(0.1)
        end = time.time() + s
        while time.time() < end:
            try:
                self.note(json.loads(self.ws.recv()))
            except websocket.WebSocketTimeoutException:
                pass
        self.ws.settimeout(60)

    def js(self, code):
        r = self.call("Runtime.evaluate", expression=code, awaitPromise=True, returnByValue=True)
        if "exceptionDetails" in r:
            raise RuntimeError(r["exceptionDetails"].get("exception", {}).get("description", code))
        return r.get("result", {}).get("value")

    def wait(self, code, timeout=15):
        t = time.time()
        while time.time() - t < timeout:
            if self.js(f"!!({code})"):
                return
            self.pump(0.15)
        raise TimeoutError(code)

    def nav(self, url, wait=1.0):
        self.call("Page.navigate", url=url)
        self.pump(wait)

    def init_script(self, code):
        self.call("Page.addScriptToEvaluateOnNewDocument", source=code)

    def click(self, sel):
        """A real mouse click in the middle of the element."""
        box = self.js(f"""(() => {{ const el = document.querySelector({json.dumps(sel)}); if (!el) return null;
            el.scrollIntoView({{block: 'center'}}); const r = el.getBoundingClientRect();
            return [r.left + r.width / 2, r.top + r.height / 2]; }})()""")
        if not box:
            raise RuntimeError(f"nothing to click: {sel}")
        x, y = box
        for kind in ("mousePressed", "mouseReleased"):
            self.call("Input.dispatchMouseEvent", type=kind, x=x, y=y, button="left", clickCount=1)
        self.pump(0.3)

    def key(self, key, code=None, text=None):
        vk = {"Tab": 9, "Enter": 13, "Escape": 27, " ": 32}.get(key, 0)
        for kind in ("keyDown", "keyUp"):
            extra = {"text": text} if text and kind == "keyDown" else {}
            self.call("Input.dispatchKeyEvent", type=kind, key=key, code=code or key, windowsVirtualKeyCode=vk, **extra)
        self.pump(0.1)

    def type(self, text):
        self.call("Input.insertText", text=text)

    def shot(self, path, full=False):
        o = {"format": "png"}
        if full:
            hh = self.call("Page.getLayoutMetrics")["cssContentSize"]["height"]
            o.update(captureBeyondViewport=True, clip={"x": 0, "y": 0, "width": self.w, "height": hh, "scale": 1})
        Path(path).parent.mkdir(parents=True, exist_ok=True)
        Path(path).write_bytes(b64decode(self.call("Page.captureScreenshot", **o)["data"]))

    def close(self):
        try:
            self.ws.close()
        finally:
            self.chrome.kill()
            self.chrome.wait()
            shutil.rmtree(self.prof, ignore_errors=True)
