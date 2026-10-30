# Phase-1 2.5D world port: auth, presence (/world/pos), pearls stripped, gear buying, cast/land, travel
import os, time, uuid
import pytest
import requests

def _base():
    u = os.environ.get("REACT_APP_BACKEND_URL")
    if not u:
        for line in open("/app/frontend/.env"):
            if line.startswith("REACT_APP_BACKEND_URL="):
                u = line.split("=", 1)[1].strip()
    return u.rstrip("/") + "/api"

BASE = _base()
PW = "Angler#2026"


def login(name, pw=PW):
    r = requests.post(f"{BASE}/auth/login", json={"username": name, "password": pw}, timeout=20)
    assert r.status_code == 200, r.text
    return {"Authorization": f"Bearer {r.json()['token']}"}


@pytest.fixture(scope="module")
def h1():
    return login("TestAngler")


@pytest.fixture(scope="module")
def h2():
    return login("TestAngler2")


# --- Auth
class TestAuth:
    def test_login_returns_token_and_user(self):
        r = requests.post(f"{BASE}/auth/login", json={"username": "TestAngler", "password": PW})
        assert r.status_code == 200
        d = r.json()
        assert isinstance(d["token"], str) and d["user"]["username"] == "TestAngler"
        assert "access_token" in r.headers.get("set-cookie", "") and "httponly" in r.headers.get("set-cookie", "").lower()

    def test_login_wrong_password(self):
        r = requests.post(f"{BASE}/auth/login", json={"username": "TestAngler", "password": "nope"})
        assert r.status_code == 401
        # reset counter via a successful login
        login("TestAngler")

    def test_register_new_user(self):
        name = "T" + uuid.uuid4().hex[:9]
        r = requests.post(f"{BASE}/auth/register", json={"username": name, "password": "Passw0rd!x"})
        assert r.status_code == 200, r.text
        d = r.json()
        tok = d.get("token") or d.get("access_token")
        assert tok
        me = requests.get(f"{BASE}/auth/me", headers={"Authorization": f"Bearer {tok}"})
        assert me.status_code == 200 and me.json()["username"] == name
        assert me.json()["water"] == "millbrook"

    def test_guest(self):
        r = requests.post(f"{BASE}/auth/guest", json={})
        assert r.status_code == 200, r.text
        d = r.json()
        assert d.get("token") or d.get("access_token")


# --- Presence
class TestPresence:
    def test_requires_auth(self):
        r = requests.post(f"{BASE}/world/pos", json={"loc": "harbour", "x": 1, "y": 1})
        assert r.status_code in (401, 403)

    def test_same_loc_sees_each_other(self, h1, h2):
        requests.post(f"{BASE}/world/pos", json={"loc": "harbour", "x": 400, "y": 600, "phase": "idle"}, headers=h1)
        r = requests.post(f"{BASE}/world/pos", json={"loc": "harbour", "x": 500, "y": 610, "phase": "idle"}, headers=h2)
        assert r.status_code == 200
        d = r.json()
        names = [p["username"] for p in d["players"]]
        assert "TestAngler" in names and "TestAngler2" not in names
        assert d["here"] >= 2
        p = next(p for p in d["players"] if p["username"] == "TestAngler")
        assert p["x"] == 400 and p["y"] == 600 and "_id" not in p
        r1 = requests.post(f"{BASE}/world/pos", json={"loc": "harbour", "x": 401, "y": 600}, headers=h1).json()
        assert "TestAngler2" in [p["username"] for p in r1["players"]]

    def test_different_loc_isolated(self, h1, h2):
        requests.post(f"{BASE}/world/pos", json={"loc": "millbrook", "x": 545, "y": 508, "phase": "wait"}, headers=h1)
        r = requests.post(f"{BASE}/world/pos", json={"loc": "harbour", "x": 500, "y": 610}, headers=h2).json()
        assert "TestAngler" not in [p["username"] for p in r["players"]]
        r = requests.post(f"{BASE}/world/pos", json={"loc": "millbrook", "x": 500, "y": 610}, headers=h2).json()
        p = [p for p in r["players"] if p["username"] == "TestAngler"]
        assert p and p[0]["phase"] == "wait"

    def test_unknown_loc_falls_back_to_harbour(self, h1, h2):
        requests.post(f"{BASE}/world/pos", json={"loc": "zzz", "x": 10, "y": 10}, headers=h1)
        r = requests.post(f"{BASE}/world/pos", json={"loc": "harbour", "x": 500, "y": 610}, headers=h2).json()
        assert "TestAngler" in [p["username"] for p in r["players"]]

    def test_validation(self, h1):
        assert requests.post(f"{BASE}/world/pos", json={"loc": "harbour", "x": 5000, "y": 10}, headers=h1).status_code == 422
        assert requests.post(f"{BASE}/world/pos", json={"loc": "harbour", "x": -1, "y": 10}, headers=h1).status_code == 422


# --- Pearls stripped from gear/bait
class TestPearls:
    def test_game_data_no_pearls(self, h1):
        r = requests.get(f"{BASE}/game/data", headers=h1)
        assert r.status_code == 200
        d = r.json()
        items = []
        for k, v in d.items():
            if isinstance(v, list) and k in ("rods", "reels", "lines", "baits", "gear", "bait"):
                items += v
            elif isinstance(v, dict) and k == "gear":
                for vv in v.values():
                    items += vv
        assert items, f"no gear lists found in keys {list(d.keys())}"
        assert all("pearls" not in g for g in items), [g["id"] for g in items if "pearls" in g]


# --- Fishing: cast + land with a realistic fight duration
class TestFishing:
    def test_cast_and_land(self, h2):
        for _ in range(8):
            r = requests.post(f"{BASE}/fish/cast", headers=h2)
            assert r.status_code == 200, r.text
            d = r.json()
            if d["result"] == "hooked":
                break
            time.sleep(1.2)
        else:
            pytest.skip("no bite in 8 casts")
        enc = d["encounter"]
        wait = enc["stamina"] + 1.0
        time.sleep(wait)
        holds = [[0.2, 1.0], [1.5, 2.4], [3.0, 3.8]]
        r = requests.post(f"{BASE}/fish/land", json={"encounter_id": enc["id"], "success": True, "elapsed": wait,
                                                   "holds": holds, "game_time": wait}, headers=h2)
        assert r.status_code == 200, r.text
        res = r.json()
        assert res["success"] is True, res
        assert res["catch"]["value"] > 0


# --- Travel
class TestTravel:
    def test_travel_requires_level(self, h2):
        r = requests.post(f"{BASE}/waters/travel", json={"water": "greyfell"}, headers=h2)
        assert r.status_code == 400
