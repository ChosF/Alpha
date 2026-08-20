import base64, glob, os, sys

A = "assets"
def b64(p, mime):
    with open(os.path.join(A, p), "rb") as f:
        return "data:%s;base64,%s" % (mime, base64.b64encode(f.read()).decode())

TOK = {
    "__FONT_KOLLEKTIF__": b64("kollektif-subset.ttf", "font/ttf"),
    "__A_NAVY__":  b64("alpha-mark-navy.png",  "image/png"),
    "__A_WHITE__": b64("alpha-mark-white.png", "image/png"),
    "__A_BLUE__":  b64("alpha-mark-blue.png",  "image/png"),
}

for f in sorted(glob.glob("opcion-*.html")) + sorted(glob.glob("index.html")):
    s = open(f, encoding="utf-8").read()
    hits = 0
    for k, v in TOK.items():
        n = s.count(k)
        hits += n
        s = s.replace(k, v)
    open(f, "w", encoding="utf-8").write(s)
    print("%-28s %2d tokens inlined  %6.1f KB" % (f, hits, len(s.encode())/1024))
