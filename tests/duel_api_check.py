# Quick API check for live duel + world presence (iteration 17)
import os, sys, requests
BASE = open('/app/frontend/.env').read().split('REACT_APP_BACKEND_URL=')[1].split()[0].rstrip('/')
def login(u):
    r = requests.post(f"{BASE}/api/auth/login", json={"username": u, "password": "Angler#2026"})
    r.raise_for_status(); d = r.json(); return d.get("token") or d.get("access_token")
for u in ("TestAngler", "TestAngler2"):
    t = login(u); h = {"Authorization": f"Bearer {t}"}
    s = requests.get(f"{BASE}/api/duel/live/state", headers=h).json()
    print(u, "state", s.get("state"), (s.get("match") or {}).get("phase"))
    if "leave" in sys.argv:
        print(" leave", requests.post(f"{BASE}/api/duel/live/leave", headers=h).text)
    me = requests.get(f"{BASE}/api/me", headers=h)
    print(" me", me.status_code, str(me.json())[:200] if me.ok else me.text[:200])
