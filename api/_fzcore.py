"""Shared by the PC admin (admin/server.py) and the web admin on Vercel (api/admincontrol.py):
password + TOTP crypto, the content schema/validation and small media helpers. Pure standard library."""
import base64, colorsys, hashlib, hmac, io, re, secrets, struct, time


# ───────────────────────── crypto ─────────────────────────
def hash_pw(pw, salt=None):
    salt = salt or secrets.token_bytes(16)
    h = hashlib.scrypt(pw.encode("utf8"), salt=salt, n=2 ** 15, r=8, p=1, maxmem=128 << 20, dklen=32)
    return {"salt": base64.b64encode(salt).decode(), "hash": base64.b64encode(h).decode(), "n": 32768, "r": 8, "p": 1}


def check_pw(pw, rec):
    salt = base64.b64decode(rec["salt"])
    h = hashlib.scrypt(pw.encode("utf8"), salt=salt, n=rec["n"], r=rec["r"], p=rec["p"], maxmem=128 << 20, dklen=32)
    return hmac.compare_digest(h, base64.b64decode(rec["hash"]))


def totp_at(secret_b32, step):
    key = base64.b32decode(secret_b32 + "=" * (-len(secret_b32) % 8))
    mac = hmac.new(key, struct.pack(">Q", step), hashlib.sha1).digest()
    o = mac[-1] & 0x0F
    return "%06d" % ((struct.unpack(">I", mac[o:o + 4])[0] & 0x7FFFFFFF) % 1000000)


def totp_verify(secret_b32, code, last_step=-1):
    code = re.sub(r"\D", "", code or "")
    if len(code) != 6:
        return None
    now = int(time.time() // 30)
    for s in (now - 1, now, now + 1):
        if s > last_step and hmac.compare_digest(totp_at(secret_b32, s), code):
            return s
    return None


def rc_hash(code):
    return hashlib.sha256(("fz-rc:" + re.sub(r"[^A-Z0-9]", "", code.upper())).encode()).hexdigest()


def new_recovery():
    codes = ["-".join(secrets.token_hex(2).upper() for _ in range(3)) for _ in range(10)]
    return codes, [rc_hash(c) for c in codes]


def qr_svg(text):
    try:
        import segno
        buf = io.BytesIO()
        segno.make(text, error="m").save(buf, kind="svg", scale=6, border=2, dark="#111111", light="#ffffff", omitsize=True)
        return buf.getvalue().decode()
    except Exception:
        return ""


# ───────────────────────── content schema ─────────────────────────
ID = re.compile(r"^[a-z0-9][a-z0-9_-]{0,47}$")
KEY = re.compile(r"^[a-z0-9][a-z0-9_]{0,31}$")
COLOR = re.compile(r"^#[0-9a-fA-F]{6}$")
MODEL_PATH = re.compile(r"^assets/models/[a-z0-9][a-z0-9_-]{0,47}\.glb$")
TEX_PATH = re.compile(r"^assets/tex/[a-z0-9][a-z0-9_.-]{0,60}\.(jpg|png)$")


class Invalid(Exception):
    pass


def S(n=200, empty=True):
    def v(x, p):
        if not isinstance(x, str): raise Invalid(f"{p}: must be text")
        if len(x) > n: raise Invalid(f"{p}: max {n} characters")
        if not empty and not x.strip(): raise Invalid(f"{p}: required")
        if re.search(r"[\x00-\x08\x0b\x0c\x0e-\x1f]", x): raise Invalid(f"{p}: invalid characters")
        return x
    return v


def RX(rx, msg, empty=False):
    def v(x, p):
        if empty and x == "": return x
        if not isinstance(x, str) or not rx.match(x): raise Invalid(f"{p}: {msg}")
        return x
    return v


def NUM(lo, hi):
    def v(x, p):
        if isinstance(x, bool) or not isinstance(x, (int, float)) or not (lo <= x <= hi): raise Invalid(f"{p}: number {lo}…{hi}")
        return round(float(x), 4)
    return v


def BOOL(x, p):
    if not isinstance(x, bool): raise Invalid(f"{p}: true/false")
    return x


def L(item, mx=200, fixed=None):
    def v(x, p):
        if not isinstance(x, list): raise Invalid(f"{p}: must be a list")
        if len(x) > mx: raise Invalid(f"{p}: max {mx} items")
        if fixed and len(x) != fixed: raise Invalid(f"{p}: needs {fixed} values")
        return [item(e, f"{p}[{i}]") for i, e in enumerate(x)]
    return v


def O(fields, required=()):
    def v(x, p):
        if not isinstance(x, dict): raise Invalid(f"{p}: must be an object")
        extra = set(x) - set(fields)
        if extra: raise Invalid(f"{p}: unknown field(s) {', '.join(sorted(extra))}")
        out = {}
        for k, fn in fields.items():
            if k in x: out[k] = fn(x[k], f"{p}.{k}")
            elif k in required: raise Invalid(f"{p}.{k}: required")
        return out
    return v


def D(keyrx, val, mx=200):
    def v(x, p):
        if not isinstance(x, dict) or len(x) > mx: raise Invalid(f"{p}: must be an object")
        return {RX(keyrx, "invalid key")(k, f"{p} key"): val(e, f"{p}.{k}") for k, e in x.items()}
    return v


IMG = RX(ID, "pick an image", empty=True)
IDV = RX(ID, "invalid id")
PAIR = O({"label": S(60), "value": S(80)})
SWATCH = O({"name": S(40), "color": RX(COLOR, "colour like #aabbcc")}, ("color",))
MODEL = O({
    "file": RX(MODEL_PATH, "must be a .glb in assets/models"), "title": S(80, False), "word": S(14), "kind": S(60),
    "blurb": S(400), "bg": RX(COLOR, "colour"), "bg2": RX(COLOR, "colour"), "ink": RX(COLOR, "colour"), "glow": RX(COLOR, "colour"),
    "dark": BOOL, "rot": L(NUM(-7, 7), fixed=3), "fit": NUM(0.2, 10), "y": NUM(-3, 3), "explode": BOOL,
    "hide": L(S(80), 100), "glass": L(S(80), 50), "fabric": L(S(80), 50), "swatches": L(SWATCH, 12),
    "tex": O({"map": RX(TEX_PATH, "texture path"), "orm": RX(TEX_PATH, "texture path"), "normal": RX(TEX_PATH, "texture path")}),
    "recolor": D(re.compile(r"^.{1,80}$"), RX(COLOR, "colour"), 50), "clay": BOOL, "inspector": BOOL, "hidden": BOOL,
}, ("file", "title"))
LINK = RX(re.compile(r"^(https://|mailto:)[^\s<>\"'`]{1,300}$"), "link must start with https://")
SOCIAL = O({"label": S(30, False), "url": LINK, "hidden": BOOL}, ("label", "url"))
BUILTIN_SECTIONS = ("work", "furniture", "environments", "archviz", "reel", "more", "about")
SECTION = O({
    "id": IDV, "custom": BOOL, "hidden": BOOL, "nav": BOOL, "label": S(30), "eyebrow": S(60), "title": S(40), "title2": S(40), "copy": S(600),
    "bg": RX(COLOR, "colour"), "ink": RX(COLOR, "colour"), "theme": RX(re.compile(r"^(dark|light)$"), "dark or light"),
    "style": RX(re.compile(r"^(grid|scroll)$"), "grid or scroll"),
    "items": L(O({"id": IDV, "title": S(80), "note": S(200), "model": RX(KEY, "model key", empty=True), "hidden": BOOL}, ("id",)), 120),
}, ("id",))
SCHEMA = O({
    "rev": NUM(0, 1e12),
    "artist": O({"name": S(80), "first": S(30), "role": S(60), "email": RX(re.compile(r"^[^@\s<>\"']{1,64}@[^@\s<>\"']{1,190}$"), "valid email"),
                 "intro": S(1200), "intro2": S(1200), "claim1": S(80), "claim2": S(80), "socials": L(SOCIAL, 12)}),
    "sections": L(SECTION, 30),
    "marquee": L(S(40), 40),
    "highlights": L(S(40), 40),
    "models": D(KEY, MODEL, 120),
    "showroom": L(RX(KEY, "model key"), 30),
    "featured": L(O({"id": IDV, "cat": S(60), "title": S(80, False), "model": RX(KEY, "model key", empty=True), "bg": RX(COLOR, "colour"),
                     "ink": RX(COLOR, "colour"), "accent": RX(COLOR, "colour"), "text": S(2000), "tools": L(S(40), 20),
                     "specs": L(PAIR, 6), "images": L(IDV, 24), "video": IMG, "hidden": BOOL}, ("id", "title")), 60),
    "furniture": L(O({"id": IDV, "title": S(80, False), "model": RX(KEY, "model key"), "poly": L(PAIR, 6),
                      "stages": L(O({"label": S(40), "image": IDV}), 12), "hidden": BOOL}, ("id", "model")), 20),
    "environments": L(O({"id": IDV, "title": S(80), "sub": S(60), "note": S(160), "hidden": BOOL}, ("id",)), 120),
    "compare": O({"title": S(120), "note": S(300), "before": IMG, "after": IMG, "beforeLabel": S(30), "afterLabel": S(30)}),
    "archviz": O({"model": RX(KEY, "model key", empty=True), "title": S(80), "tag": S(80),
                  "items": L(O({"id": IDV, "title": S(80), "note": S(200), "hidden": BOOL}, ("id",)), 120)}),
    "reel": L(O({"id": IDV, "title": S(80), "hidden": BOOL}, ("id",)), 60),
    "more": L(O({"id": IDV, "title": S(80), "cat": S(40), "hidden": BOOL}, ("id",)), 200),
    "toolkit": L(O({"title": S(60), "items": L(S(40), 20)}), 6),
})


def validate(c, index):
    """index = (image ids, video ids, model ids) that exist."""
    c = SCHEMA(c, "content")
    img, vid, mdl = index
    models = c.get("models", {})
    errs = []
    for k, m in models.items():
        if m["file"][len("assets/models/"):-4] not in mdl: errs.append(f"model '{k}': file {m['file']} not found")
    for k in c.get("showroom", []):
        if k not in models: errs.append(f"showroom: unknown model '{k}'")
    for i, p in enumerate(c.get("featured", [])):
        if p.get("model") and p["model"] not in models: errs.append(f"featured '{p['title']}': unknown model")
        for im in p.get("images", []):
            if im not in img: errs.append(f"featured '{p['title']}': image '{im}' missing")
        if p.get("video") and p["video"] not in vid: errs.append(f"featured '{p['title']}': video missing")
    for f in c.get("furniture", []):
        if f["model"] not in models: errs.append(f"furniture '{f.get('title')}': unknown model")
        for s in f.get("stages", []):
            if s["image"] not in img: errs.append(f"furniture '{f.get('title')}': image '{s['image']}' missing")
    for sec in ("environments", "more"):
        for e in c.get(sec, []):
            if e["id"] not in img: errs.append(f"{sec}: image '{e['id']}' missing")
    for e in c.get("archviz", {}).get("items", []):
        if e["id"] not in img: errs.append(f"archviz: image '{e['id']}' missing")
    am = c.get("archviz", {}).get("model")
    if am and am not in models: errs.append("archviz: unknown model")
    for e in c.get("reel", []):
        if e["id"] not in vid: errs.append(f"reel: video '{e['id']}' missing")
    for k in ("before", "after"):
        v = c.get("compare", {}).get(k)
        if v and v not in img: errs.append(f"compare: image '{v}' missing")
    seen = set()
    for sec in c.get("sections", []):
        if sec["id"] in seen: errs.append(f"sections: two sections share the id '{sec['id']}'")
        seen.add(sec["id"])
        if not sec.get("custom") and sec["id"] not in BUILTIN_SECTIONS: errs.append(f"sections: unknown built-in section '{sec['id']}'")
        if sec.get("custom") and sec["id"] in BUILTIN_SECTIONS + ("hero", "statement", "contact", "top"): errs.append(f"sections: '{sec['id']}' is a reserved name")
        for e in sec.get("items", []):
            if e["id"] not in img: errs.append(f"{sec.get('label') or sec['id']}: image '{e['id']}' missing")
            if e.get("model") and e["model"] not in models: errs.append(f"{sec.get('label') or sec['id']}: unknown model '{e['model']}'")
    ids = [p["id"] for p in c.get("featured", [])]
    if len(ids) != len(set(ids)): errs.append("featured: two projects share the same id")
    if errs: raise Invalid("; ".join(errs[:8]))
    return c


def usage(c):
    used = {}
    def add(kind, i, where):
        if i: used.setdefault(f"{kind}:{i}", []).append(where)
    for p in c.get("featured", []):
        for im in p.get("images", []): add("image", im, "Project · " + p["title"])
        add("video", p.get("video"), "Project · " + p["title"])
    for f in c.get("furniture", []):
        for s in f.get("stages", []): add("image", s["image"], "Furniture · " + f["title"])
    for e in c.get("environments", []): add("image", e["id"], "Environments")
    for e in c.get("archviz", {}).get("items", []): add("image", e["id"], "ArchViz")
    for e in c.get("more", []): add("image", e["id"], "Archive")
    for e in c.get("reel", []): add("video", e["id"], "Motion reel")
    for sec in c.get("sections", []):
        for e in sec.get("items", []): add("image", e["id"], sec.get("label") or sec["id"])
    for k in ("before", "after"): add("image", c.get("compare", {}).get(k), "Before/after slider")
    for k, m in c.get("models", {}).items(): add("model", m["file"][len("assets/models/"):-4], "3D model · " + m["title"])
    return used



def slug(name):
    name = re.sub(r"\.[A-Za-z0-9]{2,5}$", "", name or "file")
    s = re.sub(r"[^a-z0-9]+", "-", name.lower()).strip("-")[:32] or "file"
    return f"{s}-{secrets.token_hex(3)}"


def palette(im):
    sm = im.copy(); sm.thumbnail((96, 96))
    from PIL import Image
    q = sm.convert("P", palette=Image.ADAPTIVE, colors=8).convert("RGB")
    cols = sorted(q.getcolors(96 * 96), reverse=True)
    tot = sum(c[0] for c in cols)
    avg = [int(sum(c[1][i] * c[0] for c in cols) / tot) for i in range(3)]
    best, bs = cols[0][1], -1
    for n, c in cols:
        h, l, s = colorsys.rgb_to_hls(*[x / 255 for x in c])
        score = s * (0.5 - abs(l - 0.5)) * (n ** 0.3)
        if score > bs: bs, best = score, c
    hx = lambda c: "#%02x%02x%02x" % tuple(c)
    return {"avg": hx(avg), "dom": hx(cols[0][1]), "accent": hx(best)}
