"""
Fuzail Portfolio — web admin (Vercel serverless function behind /admincontrol)

Same login as the PC admin (password + authenticator code) and the same content rules (_fzcore.py).
Edits are committed straight to the GitHub repo; Vercel redeploys the site automatically.

Security
  • /admincontrol answers "404" unless the browser holds a paired-device key (paired from the PC admin).
  • Device keys are 256-bit random; only their SHA-256 hashes are published (admincontrol/devices.json).
    Revoking a phone on the PC removes it here within a minute.
  • Password (scrypt) + TOTP code on sign-in; signed, HttpOnly, Secure, SameSite=Strict session cookie
    (30 days from last use) bound to the device; CSRF token on every change; strict CSP.

Environment variables (Vercel → Project → Settings → Environment Variables)
  FZ_ADMIN        JSON {"pw": {...scrypt record...}, "totp": "<base32>", "sk": "<session key>"}
                  — copy it from the PC admin: Security → Web admin → Show Vercel settings
  FZ_GITHUB_TOKEN GitHub token with Contents read/write on the repo
  FZ_REPO / FZ_BRANCH  optional, default thehamzaihsan/fuzail-site / master
"""
import base64, calendar, hashlib, hmac, io, json, os, re, sys, time, urllib.parse, urllib.request
from http.server import BaseHTTPRequestHandler

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
import _fzcore as core  # noqa: E402

REPO = os.environ.get("FZ_REPO", "thehamzaihsan/fuzail-site")
BRANCH = os.environ.get("FZ_BRANCH", "master")
TOKEN = os.environ.get("FZ_GITHUB_TOKEN", "")
try:
    AUTH = json.loads(os.environ.get("FZ_ADMIN") or "{}")
except ValueError:
    AUTH = {}
SKEY = (AUTH.get("sk") or "").encode()
UI_DIR = os.path.join(os.path.dirname(os.path.abspath(__file__)), "_ui")
UI_TYPES = {".js": "text/javascript; charset=utf-8", ".css": "text/css; charset=utf-8", ".woff2": "font/woff2"}
SESSION_AGE = 30 * 86400
DEVICE_AGE = 400 * 86400
MAX_UPLOAD = 4_300_000          # Vercel limits request bodies to 4.5 MB
FAILS = {}                      # best-effort per-instance throttle: ip -> [count, until]
_CACHE = {}


# ───────────────────────── GitHub ─────────────────────────
def gh(method, path, body=None, raw=False):
    req = urllib.request.Request("https://api.github.com" + path, method=method,
                                 data=json.dumps(body).encode() if body is not None else None,
                                 headers={"Authorization": "Bearer " + TOKEN, "Accept": "application/vnd.github+json",
                                          "X-GitHub-Api-Version": "2022-11-28", "User-Agent": "fuzail-admincontrol"})
    try:
        with urllib.request.urlopen(req, timeout=25) as r:
            data = r.read()
            return data if raw else json.loads(data or b"null")
    except urllib.error.HTTPError as e:
        msg = e.read().decode(errors="ignore")[:300]
        if e.code == 409 or (e.code == 422 and "sha" in msg):
            raise core.Invalid("The site changed somewhere else — reload the dashboard before publishing")
        raise core.Invalid(f"GitHub said {e.code}: {msg}")


def get_file(path, ref=None):
    q = f"?ref={urllib.parse.quote(ref or BRANCH)}"
    j = gh("GET", f"/repos/{REPO}/contents/{urllib.parse.quote(path)}{q}")
    return base64.b64decode(j["content"]), j["sha"]


def dumps_like(obj, orig, indent=1):
    """JSON text in the same line-ending style as the file it replaces (the repo has Windows CRLF files)."""
    t = json.dumps(obj, indent=indent, ensure_ascii=False)
    if orig and b"\r\n" in orig: t = t.replace("\n", "\r\n")
    if orig and orig.endswith((b"\n",)): t += "\r\n" if b"\r\n" in orig else "\n"
    return t.encode()


def cached(key, ttl, fn):
    v = _CACHE.get(key)
    if v and time.time() - v[0] < ttl: return v[1]
    val = fn(); _CACHE[key] = (time.time(), val); return val


def devices():
    def load():
        try: return json.loads(get_file("api/_devices.json")[0])
        except Exception: return []
    return cached("devices", 45, load)


def find_device(key):
    if not key or len(key) > 200: return None
    h = hashlib.sha256(key.encode()).hexdigest()
    for d in devices():
        if hmac.compare_digest(h, d.get("hash", "")): return d
    return None


def tree():
    def load():
        t = gh("GET", f"/repos/{REPO}/git/trees/{BRANCH}?recursive=1")
        return [x["path"] for x in t.get("tree", []) if x["type"] == "blob"]
    return cached("tree", 20, load)


def media_index():
    paths = tree()
    pick = lambda pre, ext: {p[len(pre):-len(ext)] for p in paths if p.startswith(pre) and p.endswith(ext) and "/" not in p[len(pre):]}
    return pick("assets/img/", ".webp") | pick("assets/img/", ".jpg"), pick("assets/video/", ".mp4"), pick("assets/models/", ".glb")


def commit(files, message):
    """files: {path: bytes} → one commit on BRANCH."""
    ref = gh("GET", f"/repos/{REPO}/git/ref/heads/{BRANCH}")
    head = ref["object"]["sha"]
    base_tree = gh("GET", f"/repos/{REPO}/git/commits/{head}")["tree"]["sha"]
    entries = []
    for p, data in files.items():
        blob = gh("POST", f"/repos/{REPO}/git/blobs", {"content": base64.b64encode(data).decode(), "encoding": "base64"})
        entries.append({"path": p, "mode": "100644", "type": "blob", "sha": blob["sha"]})
    t = gh("POST", f"/repos/{REPO}/git/trees", {"base_tree": base_tree, "tree": entries})
    c = gh("POST", f"/repos/{REPO}/git/commits", {"message": message, "tree": t["sha"], "parents": [head],
                                                  "author": {"name": "Fuzail Ahmed (web admin)", "email": "admincontrol@fuzailahmed.com"}})
    gh("PATCH", f"/repos/{REPO}/git/refs/heads/{BRANCH}", {"sha": c["sha"]})
    _CACHE.pop("tree", None)
    return c["sha"]


# ───────────────────────── sessions ─────────────────────────
def sign(payload):
    body = base64.urlsafe_b64encode(json.dumps(payload, separators=(",", ":")).encode()).decode().rstrip("=")
    mac = hmac.new(SKEY, body.encode(), hashlib.sha256).hexdigest()
    return body + "." + mac


def unsign(tok):
    try:
        body, mac = tok.rsplit(".", 1)
        if not hmac.compare_digest(mac, hmac.new(SKEY, body.encode(), hashlib.sha256).hexdigest()): return None
        return json.loads(base64.urlsafe_b64decode(body + "=" * (-len(body) % 4)))
    except Exception:
        return None


CSP_BASE = ("default-src 'self'; script-src 'self' 'wasm-unsafe-eval' {hash}; style-src 'self' 'unsafe-inline'; img-src 'self' data: blob:; "
            "media-src 'self' blob:; connect-src 'self' blob: data:; worker-src 'self' blob:; font-src 'self'; object-src 'none'; "
            "base-uri 'none'; form-action 'none'; frame-ancestors 'none'")
NOT_FOUND = b"<!doctype html><title>404: NOT_FOUND</title><body style='font-family:system-ui;background:#000;color:#fff;display:grid;place-items:center;height:100vh;margin:0'><p>404: NOT_FOUND</p>"


class handler(BaseHTTPRequestHandler):
    def log_message(self, *a): pass

    # ── plumbing ──
    def send(self, code, body=b"", ctype="application/json", headers=None, csp=None):
        if isinstance(body, (dict, list)): body = json.dumps(body).encode()
        elif isinstance(body, str): body = body.encode()
        self.send_response(code)
        self.send_header("Content-Type", ctype)
        self.send_header("Content-Length", str(len(body)))
        self.send_header("Cache-Control", "no-store")
        self.send_header("X-Robots-Tag", "noindex, nofollow")
        self.send_header("X-Content-Type-Options", "nosniff")
        self.send_header("X-Frame-Options", "DENY")
        self.send_header("Referrer-Policy", "no-referrer")
        self.send_header("Strict-Transport-Security", "max-age=31536000")
        if csp: self.send_header("Content-Security-Policy", csp)
        for k, v in (headers or {}).items():
            if isinstance(v, list):
                for x in v: self.send_header(k, x)
            else: self.send_header(k, v)
        self.end_headers()
        self.wfile.write(body)

    def err(self, code, msg): self.send(code, {"error": msg})

    def cookie(self, name):
        for part in (self.headers.get("Cookie") or "").split(";"):
            k, _, v = part.strip().partition("=")
            if k == name: return v
        return None

    def body(self, limit=4 << 20):
        n = int(self.headers.get("Content-Length") or 0)
        if n < 0 or n > limit: raise core.Invalid(f"Upload too large for the web admin (max {limit // 1_000_000} MB) — use the PC admin")
        return self.rfile.read(n) if n else b""

    def jbody(self):
        if (self.headers.get("Content-Type") or "").split(";")[0].strip() != "application/json": raise core.Invalid("JSON expected")
        try: return json.loads(self.body() or b"{}")
        except ValueError: raise core.Invalid("Bad JSON")

    def ip(self):
        return (self.headers.get("X-Forwarded-For") or self.client_address[0] or "?").split(",")[0].strip()

    def device(self):
        return find_device(self.cookie("fz_dev") or "")

    def session(self):
        dev = self.device()
        s = unsign(self.cookie("fz_w") or "")
        if not dev or not s or s.get("d") != dev["id"] or time.time() - s.get("seen", 0) > SESSION_AGE: return None
        ua = hashlib.sha256((self.headers.get("User-Agent") or "").encode()).hexdigest()[:16]
        if s.get("ua") != ua or s.get("pv") != AUTH.get("pw", {}).get("hash", "")[:12]: return None   # password changed → signed out
        return s

    def csrf_for(self, s):
        # tied to the sign-in (not the cookie text, which is re-signed as the 30-day window slides)
        return hmac.new(SKEY, ("csrf:" + str(s.get("d")) + ":" + str(s.get("n"))).encode(), hashlib.sha256).hexdigest()

    def same_origin(self):
        o = self.headers.get("Origin")
        host = self.headers.get("X-Forwarded-Host") or self.headers.get("Host") or ""
        return (o is None and self.headers.get("Sec-Fetch-Site") == "same-origin") or o == f"https://{host}"

    def throttle(self, fail=False):
        now = time.time(); rec = FAILS.setdefault(self.ip(), [0, 0])
        if rec[1] > now: raise core.Invalid("Too many attempts — try again in 15 minutes")
        if fail:
            rec[0] += 1
            if rec[0] >= 5: rec[0], rec[1] = 0, now + 900
            time.sleep(1.2)

    # ── routing ──
    def route(self):
        u = urllib.parse.urlparse(self.path); q = urllib.parse.parse_qs(u.query)
        r, p = (q.get("r") or [""])[0], (q.get("p") or q.get("f") or [""])[0].strip("/")
        if not r:   # rewrites may hand us the original URL instead of the destination
            path = u.path.rstrip("/")
            if path.startswith("/admincontrol/api/"): r, p = "api", path[len("/admincontrol/api/"):]
            elif path.startswith("/admincontrol/ui/"): r, p = "ui", path[len("/admincontrol/ui/"):]
            elif path == "/admincontrol/pair": r = "pairpage"
            elif path == "/admincontrol": r = "page"
        return r, p

    def pair_page(self):
        # looks exactly like a 404; only a pairing link (#k=… made by the PC admin) does anything
        js = ("addEventListener('hashchange',()=>location.reload());(async()=>{const m=location.hash.match(/k=([A-Za-z0-9_-]{20,})/);if(!m)return;history.replaceState(null,'',location.pathname);"
              "const p=document.querySelector('p');p.textContent='Pairing…';"
              "const n=/iPhone/.test(navigator.userAgent)?'iPhone':/iPad/.test(navigator.userAgent)?'iPad':/Android/.test(navigator.userAgent)?'Android phone':'Browser';"
              "const r=await fetch('/admincontrol/api/pair/claim',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({key:m[1],name:n}),credentials:'same-origin'});"
              "if(r.ok)location.replace('/admincontrol');else{let e={};try{e=await r.json()}catch{}p.textContent=e.error||'Pairing failed';}})();")
        h = "'sha256-" + base64.b64encode(hashlib.sha256(js.encode()).digest()).decode() + "'"
        body = NOT_FOUND + b"<script>" + js.encode() + b"</script>"
        csp = f"default-src 'none'; script-src {h}; style-src 'unsafe-inline'; connect-src 'self'; base-uri 'none'; form-action 'none'; frame-ancestors 'none'"
        return self.send(404, body, "text/html; charset=utf-8", csp=csp)

    def ui_file(self, name):
        name = name.replace("\\", "/")
        if not re.match(r"^(app\.js|admin\.css|fonts/[a-z0-9-]+\.woff2)$", name) or not self.device():
            return self.send(404, NOT_FOUND, "text/html; charset=utf-8")
        with open(os.path.join(UI_DIR, name), "rb") as f: data = f.read()
        return self.send(200, data, UI_TYPES[os.path.splitext(name)[1]])

    def do_GET(self):
        r, p = self.route()
        if not (SKEY and TOKEN and AUTH.get("pw")):
            return self.send(404, NOT_FOUND, "text/html; charset=utf-8")
        if r == "pairpage": return self.pair_page()
        if r == "ui": return self.ui_file(p)
        if not self.device(): return self.send(404, NOT_FOUND, "text/html; charset=utf-8")   # unpaired browsers see nothing
        if r == "page":
            html = open(os.path.join(UI_DIR, "index.html"), encoding="utf8").read()
            m = re.search(r'<script type="importmap">(.*?)</script>', html, re.S)
            h = "'sha256-" + base64.b64encode(hashlib.sha256(m.group(1).encode()).digest()).decode() + "'" if m else ""
            return self.send(200, html, "text/html; charset=utf-8", csp=CSP_BASE.format(hash=h))
        try:
            if p == "state":
                s = self.session(); dev = self.device()   # dev is always set here
                hdr = {}
                if s:   # slide the 30-day window
                    s["seen"] = int(time.time()); tok = sign(s)
                    hdr["Set-Cookie"] = f"fz_w={tok}; Path=/admincontrol; Max-Age={SESSION_AGE}; HttpOnly; Secure; SameSite=Strict"
                return self.send(200, {"setup": False, "authed": bool(s), "csrf": self.csrf_for(s) if s else None,
                                       "remote": True, "paired": bool(dev), "mode": "web", "locked": 0, "idle": SESSION_AGE}, headers=hdr)
            s = self.session()
            if not s: return self.err(401, "Login required")
            if p == "content":
                return self.send(200, json.loads(get_file("content/content.json")[0]))
            if p == "media":
                c = json.loads(get_file("content/content.json")[0]); used = core.usage(c)
                try: mj = json.loads(get_file("assets/media.json")[0])
                except Exception: mj = {}
                img, vid, mdl = media_index()
                return self.send(200, {"images": [{"id": i, **mj.get(i, {}), "used": used.get("image:" + i, []), "t": 0} for i in sorted(img)],
                                       "videos": [{"id": v, "used": used.get("video:" + v, []), "t": 0} for v in sorted(vid)],
                                       "models": [{"id": m, "size": 0, "used": used.get("model:" + m, []), "t": 0} for m in sorted(mdl)]})
            if p == "history":
                cs = gh("GET", f"/repos/{REPO}/commits?path=content/content.json&sha={BRANCH}&per_page=40")
                out = []
                for c in cs[1:]:   # skip the current version
                    t = c["commit"]["committer"]["date"]
                    m = re.search(r"v(\d+)", c["commit"]["message"])
                    out.append({"id": c["sha"], "time": calendar.timegm(time.strptime(t, "%Y-%m-%dT%H:%M:%SZ")),
                                "rev": int(m.group(1)) if m else 0, "size": 0, "note": c["commit"]["message"][:120]})
                return self.send(200, out)
            if p == "audit":
                cs = gh("GET", f"/repos/{REPO}/commits?sha={BRANCH}&per_page=20")
                return self.send(200, [{"t": c["commit"]["committer"]["date"], "event": "commit", "note": c["commit"]["message"][:120]} for c in cs])
            if p == "devices":
                return self.send(200, {"devices": [{k: v for k, v in d.items() if k != "hash"} for d in devices()], "remote": {}, "here": "web"})
            if p == "deploy":
                return self.send(200, {"enabled": True, "state": "ok", "repo": REPO, "branch": BRANCH, "commit": "", "time": 0,
                                       "message": "Web edits are committed straight to GitHub — the live site redeploys in about a minute."})
        except core.Invalid as e:
            return self.err(400, str(e))
        return self.err(404, "Not found")

    def do_POST(self): self.mutate()
    def do_PUT(self): self.mutate()
    def do_DELETE(self): self.mutate()

    def mutate(self):
        r, p = self.route()
        if not (SKEY and TOKEN and AUTH.get("pw")) or r != "api": return self.send(404, NOT_FOUND, "text/html; charset=utf-8")
        if not self.same_origin(): return self.err(403, "Forbidden")
        try:
            if p == "pair/claim": return self.pair_claim()
            if not self.device(): return self.send(404, NOT_FOUND, "text/html; charset=utf-8")
            if p == "login": return self.login()
            s = self.session()
            if not s: return self.err(401, "Login required")
            if not hmac.compare_digest(self.headers.get("X-CSRF", ""), self.csrf_for(s)):
                return self.err(403, "Security token missing — reload the page")
            if p == "logout":
                return self.send(200, {"ok": True}, headers={"Set-Cookie": "fz_w=; Path=/admincontrol; Max-Age=0; HttpOnly; Secure; SameSite=Strict"})
            if p == "content" and self.command == "PUT": return self.save_content()
            if p == "upload": return self.upload()
            if p == "history/restore": return self.restore()
            if p in ("password", "recovery", "logout-all", "pair/new", "devices/revoke", "media"):
                raise core.Invalid("Do this from the admin on your PC (it manages passwords, phones and file removal)")
            if p == "deploy": return self.send(200, {"ok": True})
        except core.Invalid as e:
            return self.err(400, str(e))
        except Exception as e:  # noqa: BLE001
            print("admincontrol error:", type(e).__name__, e)
            return self.err(500, "Something went wrong")
        return self.err(404, "Not found")

    def pair_claim(self):
        self.throttle()
        d = self.jbody(); key = str(d.get("key") or "")
        _CACHE.pop("devices", None)
        if not find_device(key):
            self.throttle(fail=True)
            raise core.Invalid("This pairing link isn't valid yet. Wait until the PC admin shows the GitHub push as done, then try again.")
        print("admincontrol: device paired")
        return self.send(200, {"ok": True}, headers={"Set-Cookie": f"fz_dev={key}; Path=/admincontrol; Max-Age={DEVICE_AGE}; HttpOnly; Secure; SameSite=Strict"})

    def login(self):
        self.throttle()
        dev = self.device()
        if not dev:
            self.throttle(fail=True)
            raise core.Invalid("This phone isn't paired. On your PC open Security → Pair a phone.")
        d = self.jbody(); pw = d.get("password") or ""; code = (d.get("code") or "").strip()
        ok = 0 < len(pw) <= 512 and core.check_pw(pw, AUTH["pw"]) and core.totp_verify(AUTH.get("totp", ""), code) is not None
        if not ok:
            self.throttle(fail=True)
            raise core.Invalid("Wrong password or code")
        FAILS.pop(self.ip(), None)
        ua = hashlib.sha256((self.headers.get("User-Agent") or "").encode()).hexdigest()[:16]
        sess = {"d": dev["id"], "iat": int(time.time()), "seen": int(time.time()), "ua": ua, "pv": AUTH["pw"]["hash"][:12],
                "n": base64.urlsafe_b64encode(os.urandom(9)).decode()}
        tok = sign(sess)
        print("admincontrol: login", dev.get("name"))
        return self.send(200, {"ok": True, "csrf": self.csrf_for(sess), "recoveryLeft": 10},
                         headers={"Set-Cookie": f"fz_w={tok}; Path=/admincontrol; Max-Age={SESSION_AGE}; HttpOnly; Secure; SameSite=Strict"})

    def save_content(self):
        d = self.jbody(); c = d.get("content")
        raw, sha = get_file("content/content.json"); cur = json.loads(raw)
        if d.get("rev") != cur.get("rev"):
            raise core.Invalid("Content changed somewhere else — reload the dashboard before publishing")
        c = core.validate(c, media_index())
        c["rev"] = int(cur.get("rev", 0)) + 1
        note = (d.get("note") or "")[:120]
        commit({"content/content.json": dumps_like(c, raw)},
               f"Publish v{c['rev']}" + (f": {note}" if note else "") + " (from web admin)")
        return self.send(200, {"ok": True, "rev": c["rev"], "deploy": False})

    def restore(self):
        d = self.jbody(); ref = str(d.get("id") or "")
        if not re.match(r"^[0-9a-f]{40}$", ref): raise core.Invalid("bad id")
        snap = json.loads(get_file("content/content.json", ref)[0])
        raw = get_file("content/content.json")[0]; cur = json.loads(raw)
        snap = core.validate(snap, media_index()); snap["rev"] = int(cur.get("rev", 0)) + 1
        commit({"content/content.json": dumps_like(snap, raw)}, f"Publish v{snap['rev']}: restore {ref[:7]} (from web admin)")
        return self.send(200, {"ok": True, "rev": snap["rev"]})

    def upload(self):
        q = urllib.parse.parse_qs(urllib.parse.urlparse(self.path).query)
        kind = (q.get("kind") or [""])[0]
        if kind != "image": raise core.Invalid("Videos and 3D models are too big for the web — upload them from the PC admin")
        if (self.headers.get("Content-Type") or "") != "application/octet-stream": raise core.Invalid("Bad upload")
        raw = self.body(MAX_UPLOAD)
        from PIL import Image, ImageOps
        Image.MAX_IMAGE_PIXELS = 140_000_000
        sig = raw[:12]
        if not (sig.startswith(b"\xff\xd8\xff") or sig.startswith(b"\x89PNG\r\n\x1a\n") or (sig[:4] == b"RIFF" and sig[8:12] == b"WEBP")):
            raise core.Invalid("Only JPG, PNG or WebP images are accepted")
        im = Image.open(io.BytesIO(raw)); im.verify()
        im = ImageOps.exif_transpose(Image.open(io.BytesIO(raw))).convert("RGB")
        iid = core.slug((q.get("name") or ["image"])[0][:80])
        big = im.copy(); big.thumbnail((2400, 2400), Image.LANCZOS)
        t = big.copy(); t.thumbnail((900, 900), Image.LANCZOS)
        b1, b2 = io.BytesIO(), io.BytesIO()
        big.save(b1, "WEBP", quality=82, method=6); t.save(b2, "WEBP", quality=78, method=6)
        meta = {"w": big.width, "h": big.height, **core.palette(big)}
        try: mraw = get_file("assets/media.json")[0]; mj = json.loads(mraw)
        except Exception: mraw, mj = b"", {}
        mj[iid] = meta
        commit({f"assets/img/{iid}.webp": b1.getvalue(), f"assets/thumb/{iid}.webp": b2.getvalue(),
                "assets/media.json": dumps_like(mj, mraw)}, f"Upload {iid} (from web admin)")
        return self.send(200, {"id": iid, **meta})
