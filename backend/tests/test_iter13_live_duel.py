# Iteration 13: live Fishing Duel (queue / match / state / leave / kg from landed fish)
import os, sys, time
import pytest, requests

sys.path.insert(0, "/app/backend"); sys.path.insert(0, "/app/scripts"); sys.path.insert(0, os.path.dirname(__file__))

def _base():
    u = os.environ.get("REACT_APP_BACKEND_URL")
    if not u:
        for l in open("/app/frontend/.env"):
            if l.startswith("REACT_APP_BACKEND_URL="):
                u = l.split("=", 1)[1].strip()
    return u.rstrip("/") + "/api"

BASE = _base()


def _login(name):
    r = requests.post(f"{BASE}/auth/login", json={"username": name, "password": "Angler#2026"})
    assert r.status_code == 200, r.text
    return {"Authorization": f"Bearer {r.json().get('token') or r.json().get('access_token')}"}


@pytest.fixture(scope="module")
def H():
    a, b = _login("TestAngler"), _login("TestAngler2")
    if os.environ.get("SKIP_WAIT"):
        return a, b
    # wait out any leftover match (active while end > now-30s)
    for _ in range(80):
        sa = requests.get(f"{BASE}/duel/live/state", headers=a).json()
        sb = requests.get(f"{BASE}/duel/live/state", headers=b).json()
        if sa["state"] != "matched" and sb["state"] != "matched":
            break
        time.sleep(3)
    requests.post(f"{BASE}/duel/live/leave", headers=a); requests.post(f"{BASE}/duel/live/leave", headers=b)
    return a, b


class TestLiveDuel:
    def test_state_requires_auth(self):
        assert requests.get(f"{BASE}/duel/live/state").status_code in (401, 403)

    def test_queue_match_state_leave(self, H):
        a, b = H
        r1 = requests.post(f"{BASE}/duel/live/queue", headers=a)
        assert r1.status_code == 200 and r1.json() == {"state": "waiting"}, r1.text
        assert requests.get(f"{BASE}/duel/live/state", headers=a).json()["state"] == "waiting"
        r2 = requests.post(f"{BASE}/duel/live/queue", headers=b).json()
        assert r2["state"] == "matched", r2
        m = r2["match"]
        assert m["phase"] == "countdown"
        assert m["me"]["username"] == "TestAngler2" and m["foe"]["username"] == "TestAngler"
        assert m["me"]["kg"] == 0 and 175 <= m["seconds_left"] <= 186
        sa = requests.get(f"{BASE}/duel/live/state", headers=a).json()
        sb = requests.get(f"{BASE}/duel/live/state", headers=b).json()
        assert sa["match"]["id"] == sb["match"]["id"] == m["id"]
        assert sa["match"]["me"]["username"] == "TestAngler"
        # re-queue returns same match
        assert requests.post(f"{BASE}/duel/live/queue", headers=a).json()["match"]["id"] == m["id"]
        lv = requests.post(f"{BASE}/duel/live/leave", headers=a)
        assert lv.status_code == 400, lv.text
        pytest.match_id = m["id"]

    def test_landed_fish_adds_kg(self, H):
        a, b = H
        st = requests.get(f"{BASE}/duel/live/state", headers=a).json()
        if st["state"] != "matched":
            pytest.skip("no active match")
        st = st["match"]
        time.sleep(max(0, (st["seconds_left"] - 180)) + 1.5)
        before = requests.get(f"{BASE}/duel/live/state", headers=a).json()["match"]
        assert before["phase"] == "live"
        for _ in range(8):
            c = requests.post(f"{BASE}/fish/cast", json={"bait": "worm"}, headers=a).json()
            if c.get("result") == "hooked":
                break
            time.sleep(2.5)
        assert c.get("result") == "hooked", c
        eid = c["encounter"]["id"]
        sta = c["encounter"]["stamina"]
        time.sleep(sta * 0.8 + 0.5)
        el = sta + 0.5
        iv = [[0.2, el * 0.4], [el * 0.5, el * 0.8]]
        res = requests.post(f"{BASE}/fish/land", json={"encounter_id": eid, "success": True, "elapsed": el, "game_time": el, "holds": iv}, headers=a).json()
        after = requests.get(f"{BASE}/duel/live/state", headers=a).json()["match"]
        foe_view = requests.get(f"{BASE}/duel/live/state", headers=b).json()["match"]
        if res.get("success"):
            w = res["catch"]["weight"]
            assert abs(after["me"]["kg"] - before["me"]["kg"] - w) < 0.01, (after, w)
            assert after["me"]["catches"] == before["me"]["catches"] + 1
            assert abs(foe_view["foe"]["kg"] - after["me"]["kg"]) < 0.01
        else:
            pytest.skip(f"fish not landed: {res}")
