# Helper: keep TestAngler2 "walking" in a location for N seconds (multiplayer presence UI test)
import sys, time, math, requests
sys.path.insert(0, "/app/backend/tests")
from test_world_phase1 import BASE, login

loc, secs = sys.argv[1], int(sys.argv[2])
h = login("TestAngler2")
t0 = time.time()
while time.time() - t0 < secs:
    k = time.time() - t0
    r = requests.post(f"{BASE}/world/pos", json={"loc": loc, "x": 500 + 120 * math.sin(k / 3), "y": 600, "phase": "idle"}, headers=h, timeout=10)
    time.sleep(1.5)
print("done", r.json().get("here"))
