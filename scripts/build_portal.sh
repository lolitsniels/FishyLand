#!/bin/bash
# Builds the self-contained portal version (Playgama + GameDistribution via Playgama Bridge).
# Usage: GD_GAME_ID=<your GameDistribution game id> bash /app/scripts/build_portal.sh
set -e
OUT=/app/portal_builds
mkdir -p $OUT
cd /app/frontend
rm -rf build
REACT_APP_PORTAL=1 PUBLIC_URL=. GENERATE_SOURCEMAP=false REACT_APP_BACKEND_URL= yarn build > /tmp/portal_build.log 2>&1 || { tail -30 /tmp/portal_build.log; exit 1; }
rm -rf $OUT/game && cp -r build $OUT/game
python3 /app/scripts/portal_postprocess.py "$OUT/game" "${GD_GAME_ID:-REPLACE_WITH_GAMEDISTRIBUTION_GAME_ID}"
cd $OUT/game && rm -f ../fishing-realm-portal.zip && zip -qr ../fishing-realm-portal.zip . && cd ..
python3 /app/scripts/portal_postprocess.py --thumbs "$OUT"
du -sh $OUT/fishing-realm-portal.zip
