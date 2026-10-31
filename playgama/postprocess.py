"""Post-build for the Playgama archive: relative asset paths, local fonts, no external URLs left in code that runs."""
import os, re, sys, glob, urllib.request

B = sys.argv[1]
UA = "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0 Safari/537.36"
FONTS = "https://fonts.googleapis.com/css2?family=Inter:wght@600&family=Noto+Sans:wght@500;600;700;800&family=Lilita+One&display=swap"


def get(url):
    return urllib.request.urlopen(urllib.request.Request(url, headers={"User-Agent": UA}), timeout=60).read()


# 1) fonts shipped inside the archive (latin subsets only)
os.makedirs(f"{B}/fonts", exist_ok=True)
css = get(FONTS).decode()
blocks = re.findall(r"/\* ([\w-]+) \*/\s*(@font-face \{.*?\})", css, flags=re.S)
out = []
for i, (subset, block) in enumerate(blocks):
    if subset != "latin": continue
    url = re.search(r"url\((https://[^)]+)\)", block).group(1)
    name = f"f{i}.woff2"
    open(f"{B}/fonts/{name}", "wb").write(get(url))
    out.append(block.replace(url, name))
open(f"{B}/fonts/fonts.css", "w").write("\n".join(out))

# 2) absolute "/art/..." style paths -> relative to index.html (iframe hosts serve games from a sub-folder)
ROOTS = r"(art|audio|fonts|favicon[\w.-]*|fav-\d+\.png|apple-touch-icon\.png|logo[\w.-]*|ui\.css)"
def rel(text, prefix=""):
    text = re.sub(r'(["\'`(])/' + ROOTS + r'(?=[/"\'`)?.])', lambda m: m.group(1) + prefix + m.group(2), text)
    return text
for f in glob.glob(f"{B}/static/js/*.js"):
    s = open(f, encoding="utf-8").read(); open(f, "w", encoding="utf-8").write(rel(s))
for f in glob.glob(f"{B}/static/css/*.css"):
    s = open(f, encoding="utf-8").read(); open(f, "w", encoding="utf-8").write(rel(s, "../../"))
for f in [f"{B}/ui.css"] + glob.glob(f"{B}/*.css"):
    if os.path.exists(f):
        s = open(f, encoding="utf-8").read(); open(f, "w", encoding="utf-8").write(rel(s))
idx = f"{B}/index.html"
s = open(idx, encoding="utf-8").read()
s = s.replace('src="./static', 'src="static').replace('href="./static', 'href="static')
open(idx, "w", encoding="utf-8").write(s)

# 3) report any external URL loaders left (scripts/styles/fetch targets)
bad = []
for f in glob.glob(f"{B}/**/*.html", recursive=True) + glob.glob(f"{B}/**/*.css", recursive=True):
    for m in re.findall(r'(?:src|href)=["\'](https?://[^"\']+)|url\((https?://[^)]+)\)', open(f, encoding="utf-8", errors="ignore").read()):
        bad.append((f, m))
print("external refs in html/css:", bad or "none")
print("archive files:", sum(len(fs) for _, _, fs in os.walk(B)))
