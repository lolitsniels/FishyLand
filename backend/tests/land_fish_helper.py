# Helper: login an account and land N fish via the real-time controller (seed data for UI tests)
import sys, time, requests
sys.path.insert(0, "/app/backend"); sys.path.insert(0, "/app/scripts")
from e2e_fishing import controller_holds
import sim as S
from test_fishing_realm import BASE

email, pw, n = sys.argv[1], sys.argv[2], int(sys.argv[3])
r = requests.post(f"{BASE}/auth/login", json={"email": email, "password": pw}).json()
H = {"Authorization": f"Bearer {r['access_token']}"}
for i in range(n):
    c = requests.post(f"{BASE}/fish/cast", json={"bait": "worm"}, headers=H).json()
    iv, end, exp = controller_holds(c["params"])
    time.sleep(c["bite_delay_ms"] / 1000 + c["fight_delay_ms"] / 1000 + end * S.DT + 0.2)
    res = requests.post(f"{BASE}/fish/land", json={"encounter_id": c["encounter_id"], "holds": iv}, headers=H).json()
    print(i, c["species_id"], res.get("outcome"))
    time.sleep(1.6)
p = requests.get(f"{BASE}/player", headers=H).json()
print("gold", p["gold"], "lvl", p["level"], "dex", p["fishdex_count"], "rod dur", p["gear"]["rod"]["cur_dur"], "stones", p["items"].get("enhance_stone"))
