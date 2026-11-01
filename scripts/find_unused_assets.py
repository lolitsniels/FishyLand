import os
import re
import sys

PUB = "/app/frontend/public"
SKIP_DIRS = {"art/fish_v2", "art/chars"}  # filenames are built from numeric ids / look codes
corpus = []
for root in ["/app/frontend/src", "/app/backend"]:
    for d, _, fs in os.walk(root):
        if "node_modules" in d or "__pycache__" in d or "/tests" in d:
            continue
        for f in fs:
            if f.endswith((".js", ".jsx", ".ts", ".tsx", ".py", ".css", ".json", ".html")):
                corpus.append(open(os.path.join(d, f), errors="ignore").read())
for f in ["ui.css", "index.html"]:
    corpus.append(open(f"{PUB}/{f}", errors="ignore").read())
text = "\n".join(corpus)

unused, total = [], 0
for sub in ["art", "audio"]:
    for d, _, fs in os.walk(f"{PUB}/{sub}"):
        rel = os.path.relpath(d, PUB)
        if any(rel == s or rel.startswith(s + "/") for s in SKIP_DIRS):
            continue
        for f in fs:
            stem = os.path.splitext(f)[0]
            path = os.path.join(d, f)
            # thumbs/variants share the stem of their parent asset
            base = re.sub(r"(_thumb|@2x)$", "", stem)
            if re.search(r"(?<![\w-])" + re.escape(base) + r"(?![\w-])", text) or re.search(re.escape(f), text):
                continue
            unused.append(path)
            total += os.path.getsize(path)
for p in sorted(unused):
    print(os.path.relpath(p, PUB), os.path.getsize(p) // 1024, "KB")
print("TOTAL", len(unused), total // 1024 // 1024, "MB", file=sys.stderr)
