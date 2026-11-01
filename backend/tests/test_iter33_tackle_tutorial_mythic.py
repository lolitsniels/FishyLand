# Iteration 33: reel/line upgrade tracks, shop/enhance retirement, tutorial mythic first catch + live alert
import os, time, uuid
import pytest, requests
from pymongo import MongoClient
from bson import ObjectId

BASE = os.environ.get("REACT_APP_BACKEND_URL", "").rstrip("/") or open("/app/frontend/.env").read().split("REACT_APP_BACKEND_URL=")[1].split()[0].rstrip("/")
API = f"{BASE}/api"
mdb = MongoClient(os.environ.get("MONGO_URL", "mongodb://localhost:27017"))[os.environ.get("DB_NAME", "test_database")]


def login(u, p):
    r = requests.post(f"{API}/auth/login", json={"username": u, "password": p})
    assert r.status_code == 200, r.text
    d = r.json()
    return {"Authorization": f"Bearer {d.get('access_token') or d.get('token')}"}


def fresh_guest():
    """New guest; same-IP guests are resumed, so delete the resumed one and retry."""
    for _ in range(4):
        mdb.rate_events.delete_many({"action": "signup"})
        r = requests.post(f"{API}/auth/guest", json={"portal": "pg"})
        assert r.status_code == 200, r.text
        d = r.json()
        if not d.get("resumed"):
            return {"Authorization": f"Bearer {d['token']}"}, d["user"]["id"]
        mdb.users.delete_one({"_id": ObjectId(d["user"]["id"])})
    pytest.skip("Could not create a fresh guest")


@pytest.fixture(scope="module")
def guest():
    h, uid = fresh_guest()
    yield h, uid
    mdb.users.delete_one({"_id": ObjectId(uid)})


# --- Tackle upgrade track
class TestTackleUpgrade:
    def test_me_has_tackle_view(self, guest):
        h, _ = guest
        me = requests.get(f"{API}/auth/me", headers=h).json()
        me = me.get("user", me)
        t = me["tackle"]
        assert t["reel"] == {"level": 1, "max": 10, "stat": 1.0, "perk_pct": 0, "next_cost": 3}
        assert t["line"]["level"] == 1 and t["line"]["next_cost"] == 3

    def test_game_data_costs(self):
        d = requests.get(f"{API}/game/data").json()
        assert d["tackle"]["costs"] == [3, 5, 8, 12, 16, 20, 25, 30, 40]
        assert d["tackle"]["max_level"] == 10

    def test_short_pearls_error(self, guest):
        h, uid = guest
        mdb.users.update_one({"_id": ObjectId(uid)}, {"$set": {"pearls": 2}})
        r = requests.post(f"{API}/tackle/upgrade", json={"slot": "reel"}, headers=h)
        assert r.status_code == 400 and "You need 3 Pearls" in r.json()["detail"]

    def test_bad_slot(self, guest):
        h, _ = guest
        r = requests.post(f"{API}/tackle/upgrade", json={"slot": "rod"}, headers=h)
        assert r.status_code == 400

    def test_upgrade_charges_and_persists(self, guest):
        h, uid = guest
        mdb.users.update_one({"_id": ObjectId(uid)}, {"$set": {"pearls": 300}})
        r = requests.post(f"{API}/tackle/upgrade", json={"slot": "reel"}, headers=h)
        assert r.status_code == 200, r.text
        u = r.json()["user"]
        assert u["tackle"]["reel"]["level"] == 2 and u["tackle"]["reel"]["stat"] == 1.12 and u["tackle"]["reel"]["perk_pct"] == 2
        assert u["tackle"]["reel"]["next_cost"] == 5
        assert u["pearls"] == 297
        r = requests.post(f"{API}/tackle/upgrade", json={"slot": "line"}, headers=h)
        assert r.json()["user"]["tackle"]["line"]["stat"] == 1.11

    def test_max_level(self, guest):
        h, uid = guest
        for _ in range(8):
            r = requests.post(f"{API}/tackle/upgrade", json={"slot": "reel"}, headers=h)
            assert r.status_code == 200, r.text
        u = r.json()["user"]
        assert u["tackle"]["reel"]["level"] == 10 and u["tackle"]["reel"]["next_cost"] is None
        assert u["pearls"] == 300 - 3 - 3 - (5 + 8 + 12 + 16 + 20 + 25 + 30 + 40)
        r = requests.post(f"{API}/tackle/upgrade", json={"slot": "reel"}, headers=h)
        assert r.status_code == 400 and "max level" in r.json()["detail"]
        # reset for the mythic test
        mdb.users.update_one({"_id": ObjectId(uid)}, {"$unset": {"tackle": ""}, "$set": {"pearls": 0}})


# --- Shop / enhance retirement
class TestRetired:
    def test_buy_reel_line_rejected(self):
        h = login("TestAngler", "Angler#2026")
        for gid in ("reel_drag", "line_fluoro"):
            r = requests.post(f"{API}/shop/buy-gear", json={"gear_id": gid}, headers=h)
            assert r.status_code == 400, (gid, r.text)

    def test_enhance_410(self):
        h = login("TestAngler", "Angler#2026")
        assert requests.post(f"{API}/enhance/upgrade", json={"gear_id": "rod_cane"}, headers=h).status_code == 410
        r = requests.post(f"{API}/enhance/recycle", json={"gear_id": "rod_cane"}, headers=h)
        assert r.status_code in (410, 422), r.text


# --- Tutorial mythic
class TestTutorialMythic:
    def test_guaranteed_mythic_and_alert(self):
        h, uid = fresh_guest()
        try:
            first = None
            for i in range(3):
                r = requests.post(f"{API}/fish/cast", json={}, headers=h)
                assert r.status_code == 200, r.text
                c = r.json()
                assert c["result"] != "nothing", c
                assert c["result"] == "hooked", c
                p = c["encounter"]
                assert p["stamina"] == 42 and "Something ENORMOUS" in p["hint"], p
                first = c
                time.sleep(1.2)
            time.sleep(32)
            holds = [[i * 1.0, i * 1.0 + 0.5] for i in range(33)]
            r = requests.post(f"{API}/fish/land", json={"encounter_id": first["encounter"]["id"], "success": True, "elapsed": 34, "game_time": 34, "holds": holds}, headers=h)
            assert r.status_code == 200, r.text
            d = r.json()
            print("LAND", {k: d[k] for k in d if k in ("outcome", "catch", "message")})
            cat = d.get("catch") or {}
            assert cat.get("rarity") == "mythic" and "Mill Giant" in str(cat.get("name") or cat.get("species_name") or cat), cat
            name = mdb.users.find_one({"_id": ObjectId(uid)})["username"]
            h2 = login("TestAngler2", "Angler#2026")
            time.sleep(4)
            al = requests.get(f"{API}/alerts/live", headers=h2).json()
            mine = [a for a in al if a["username"] == name]
            assert mine and mine[0]["rarity"] == "mythic" and mine[0]["status"] == "landed", al
            # next cast is no longer guaranteed
            time.sleep(1.5)
            c2 = requests.post(f"{API}/fish/cast", json={}, headers=h).json()
            assert c2.get("result") != "hooked" or c2["encounter"].get("stamina") != 42, c2
        finally:
            mdb.users.delete_one({"_id": ObjectId(uid)})
