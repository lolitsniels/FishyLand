#!/usr/bin/env bash
# Builds the offline Playgama archive: /app/playgama/fishyland-playgama.zip
set -euo pipefail
FE=/app/frontend; PG=/app/playgama; W=/tmp/pg_build
rm -rf "$W" && mkdir -p "$W"
rsync -a --exclude node_modules --exclude build --exclude public/pgtest --exclude public/downloads "$FE/" "$W/"
ln -s "$FE/node_modules" "$W/node_modules"
cp "$PG/index.html" "$W/public/index.html"
rm -f "$W/public/robots.txt" "$W/public/sitemap.xml" "$W/public/manifest.json" "$W/public/art/og.jpg"
cd "$W"
REACT_APP_OFFLINE=1 REACT_APP_BACKEND_URL= PUBLIC_URL=. GENERATE_SOURCEMAP=false DISABLE_ESLINT_PLUGIN=true INLINE_RUNTIME_CHUNK=false node "$FE/node_modules/@craco/craco/dist/bin/craco.js" build > "$W/build.log" 2>&1 || { tail -40 "$W/build.log"; exit 1; }
B="$W/build"
# Bridge SDK (bundled locally, loaded first in <head>) + config next to index.html
[ -f /tmp/pgb/package/dist/playgama-bridge.js ] || (rm -rf /tmp/pgb && mkdir -p /tmp/pgb && cd /tmp/pgb && npm pack @playgama/bridge --silent >/dev/null && tar xzf *.tgz)
cp /tmp/pgb/package/dist/playgama-bridge.js "$B/"
cp "$PG/playgama-bridge-config.json" "$B/"
python3 "$PG/postprocess.py" "$B"
rm -f "$PG/fishyland-playgama.zip"
(cd "$B" && zip -qr -9 "$PG/fishyland-playgama.zip" .)
du -sh "$PG/fishyland-playgama.zip"
