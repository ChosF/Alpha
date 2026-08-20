import base64, glob, os

A = "assets"
def b64(p, mime):
    with open(os.path.join(A, p), "rb") as f:
        return "data:%s;base64,%s" % (mime, base64.b64encode(f.read()).decode())

TOK = {
    "__FONT_KOLLEKTIF__": b64("kollektif-subset.ttf", "font/ttf"),
    "__A_WHITE__":        b64("alpha-mark-white.png", "image/png"),
}

for f in sorted(glob.glob("alpha-*.html")):
    s = open(f, encoding="utf-8").read()
    hits = sum(s.count(k) for k in TOK)
    for k, v in TOK.items():
        s = s.replace(k, v)
    open(f, "w", encoding="utf-8").write(s)
    print("%-30s %2d tokens  %7.1f KB" % (f, hits, len(s.encode())/1024))
