"""Local server for the portfolio.  Run:  python serve.py   (then open http://localhost:8080)"""
import http.server, socketserver, os, sys, re, webbrowser, threading

PORT = int(os.environ.get("PORT", next((a for a in sys.argv[1:] if a.isdigit()), 8080)))
ROOT = os.path.dirname(os.path.abspath(__file__))


class Handler(http.server.SimpleHTTPRequestHandler):
    extensions_map = {
        **http.server.SimpleHTTPRequestHandler.extensions_map,
        ".js": "text/javascript", ".mjs": "text/javascript", ".wasm": "application/wasm",
        ".glb": "model/gltf-binary", ".gltf": "model/gltf+json", ".json": "application/json",
        ".woff2": "font/woff2", ".mp4": "video/mp4", ".webp": "image/webp", ".svg": "image/svg+xml",
    }

    def __init__(self, *a, **kw):
        super().__init__(*a, directory=ROOT, **kw)

    def log_message(self, *a):
        pass

    def end_headers(self):
        self.send_header("Cache-Control", "no-cache")
        self.send_header("Accept-Ranges", "bytes")
        super().end_headers()

    # minimal HTTP Range support so videos can seek / loop smoothly
    def send_head(self):
        rng = self.headers.get("Range")
        path = self.translate_path(self.path)
        if not rng or not os.path.isfile(path):
            return super().send_head()
        m = re.match(r"bytes=(\d*)-(\d*)", rng)
        size = os.path.getsize(path)
        start = int(m.group(1)) if m and m.group(1) else 0
        end = int(m.group(2)) if m and m.group(2) else size - 1
        end = min(end, size - 1)
        if start > end:
            self.send_error(416); return None
        f = open(path, "rb"); f.seek(start)
        self.send_response(206)
        self.send_header("Content-Type", self.guess_type(path))
        self.send_header("Content-Range", f"bytes {start}-{end}/{size}")
        self.send_header("Content-Length", str(end - start + 1))
        self.end_headers()
        self._range_left = end - start + 1
        return f

    def copyfile(self, src, dst):
        left = getattr(self, "_range_left", None)
        if left is None:
            return super().copyfile(src, dst)
        try:
            while left > 0:
                buf = src.read(min(65536, left))
                if not buf: break
                dst.write(buf); left -= len(buf)
        except (ConnectionResetError, BrokenPipeError):
            pass


class Server(socketserver.ThreadingMixIn, http.server.HTTPServer):
    daemon_threads = True
    allow_reuse_address = True


if __name__ == "__main__":
    with Server(("0.0.0.0", PORT), Handler) as httpd:
        url = f"http://localhost:{PORT}"
        print(f"Fuzail Ahmed — 3D portfolio running at {url}  (Ctrl+C to stop)")
        if "--no-browser" not in sys.argv:
            threading.Timer(0.8, lambda: webbrowser.open(url)).start()
        try:
            httpd.serve_forever()
        except KeyboardInterrupt:
            pass
