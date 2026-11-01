import os
import re
import sys

SRC = "/app/frontend/src"
IMP = re.compile(r"""(?:\bimport\s[^'"]*?from\s*|\bimport\s*\(\s*|\bimport\s+|\brequire\(\s*|\bexport\s[^'"]*?from\s*)['"]([^'"]+)['"]""")
EXTS = ["", ".js", ".jsx", ".ts", ".tsx", ".json", ".css", "/index.js", "/index.jsx", "/index.ts", "/index.tsx"]


def resolve(base, spec):
    if spec.startswith("@/"):
        p = os.path.join(SRC, spec[2:])
    elif spec.startswith("."):
        p = os.path.join(os.path.dirname(base), spec)
    else:
        return None
    for e in EXTS:
        q = os.path.normpath(p + e)
        if os.path.isfile(q):
            return q
    return None


seen, stack = set(), [os.path.join(SRC, "index.js")]
while stack:
    f = stack.pop()
    if f in seen:
        continue
    seen.add(f)
    if not f.endswith((".js", ".jsx", ".ts", ".tsx")):
        continue
    for spec in IMP.findall(open(f, errors="ignore").read()):
        r = resolve(f, spec)
        if r:
            stack.append(r)

dead = []
for d, _, fs in os.walk(SRC):
    for f in fs:
        p = os.path.join(d, f)
        if p.endswith((".js", ".jsx", ".ts", ".tsx", ".css")) and p not in seen and "/components/ui/" not in p:
            dead.append(p)
for p in sorted(dead):
    print(os.path.relpath(p, SRC))
if "--delete" in sys.argv:
    for p in dead:
        os.remove(p)
    print("deleted", len(dead), file=sys.stderr)
