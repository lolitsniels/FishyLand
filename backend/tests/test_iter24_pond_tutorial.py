# Iteration 24: tutorial pearls reward, crew pond info/stock, pond casting & landing
import os
import time
import pytest
import requests
from pymongo import MongoClient
from bson import ObjectId

BASE_URL = os.environ.get("REACT_APP_BACKEND_URL").rstrip("/")
API = f"{BASE_URL}/api"
CREW_ID = "6ae5bd978e5290ee9639af05"
POND_IDS = set(range(950, 960))

mc = MongoClient("mongodb://localhost:27017")
db = mc["test_database"]


def login(u, p="Angler#2026"):
    s = requests.Session()
    r = s.post(f"{API}/auth/login", json={"username": u, "password": p})
    if r.status_code != 200:
        pytest.skip(f"login failed {u}: {r.text[:100]}")
    j = r.json()
    s.headers["Authorization"] = f"Bearer {j.get('token') or j.get('access_token')}"
    s.uid = (j.get("user") or {}).get("id")
    return s


@pytest.fixture(scope="module")
def leader():
    s = login("TestAngler")
    db.users.update_one({"username": "TestAngler"}, {"$set": {"energy": 500, "humancheck": {}}})
    return s


@pytest.fixture(scope="module")
def crew_backup():
    c = db.crews.find_one({"_id": ObjectId(CREW_ID)})
    assert c, "Test Crew missing"
    yield c
    # restore pond and bank after tests
    db.crews.update_one({"_id": c["_id"]}, {"$set": {"pond": c.get("pond", []), "bank": c.get("bank", 0)}})


# --- Tutorial reward ---
def test_tutorial_complete_gives_pearls_once():
    s = requests.Session()
    r = s.post(f"{API}/auth/guest", json={})
    assert r.status_code == 200, r.text[:200]
    j = r.json()
    s.headers["Authorization"] = f"Bearer {j['token']}"
    uid = ObjectId(j["user"]["id"])
    db.users.update_one({"_id": uid}, {"$set": {"tutorial": {"step": 9, "done": False}}})
    before = db.users.find_one({"_id": uid})
    p0, w0, b0 = before.get("pearls", 0), before["bait"].get("bait_worm", 0), before["bait"].get("bait_bread", 0)
    r = s.post(f"{API}/tutorial/complete")
    assert r.status_code == 200
    d = r.json()
    assert d["reward"] == {"bait_worm": 10, "bait_bread": 10, "pearls": 10}
    after = db.users.find_one({"_id": uid})
    assert after.get("pearls", 0) == p0 + 10
    assert after["bait"]["bait_worm"] == w0 + 10 and after["bait"]["bait_bread"] == b0 + 10
    assert d["user"].get("pearls", p0 + 10) == p0 + 10
    r2 = s.post(f"{API}/tutorial/complete")
    assert r2.json()["reward"] is None
    assert db.users.find_one({"_id": uid}).get("pearls", 0) == p0 + 10


# --- Pond info ---
def test_pond_info(leader, crew_backup):
    r = leader.get(f"{API}/crews/{CREW_ID}/pond")
    assert r.status_code == 200, r.text
    d = r.json()
    assert d["total"] == 10 and len(d["species"]) == 10
    assert {x["id"] for x in d["species"]} == POND_IDS
    for x in d["species"]:
        for k in ("stocked", "next", "caught", "cost"):
            assert k in x
    assert d["can_manage"] is True
    assert isinstance(d["bank"], int)
    assert sum(1 for x in d["species"] if x["next"]) <= 1


def test_pond_info_non_member():
    s = login("Niels", "Niels112233!")
    u = db.users.find_one({"username": "Niels"})
    if (u.get("crew") or {}).get("id") == CREW_ID:
        pytest.skip("Niels in crew")
    r = s.get(f"{API}/crews/{CREW_ID}/pond")
    assert r.status_code == 403


def test_pond_info_unauth():
    assert requests.get(f"{API}/crews/{CREW_ID}/pond").status_code in (401, 403)


# --- Stocking rules ---
def test_stock_rules(leader, crew_backup):
    db.crews.update_one({"_id": ObjectId(CREW_ID)}, {"$set": {"pond": [950], "bank": 200000}})
    r = leader.post(f"{API}/crews/{CREW_ID}/pond/stock", json={"species_id": 950})
    assert r.status_code == 400 and "already" in r.text
    r = leader.post(f"{API}/crews/{CREW_ID}/pond/stock", json={"species_id": 953})
    assert r.status_code == 400 and "first" in r.text
    r = leader.post(f"{API}/crews/{CREW_ID}/pond/stock", json={"species_id": 123})
    assert r.status_code == 400
    r = leader.post(f"{API}/crews/{CREW_ID}/pond/stock", json={"species_id": 951})
    assert r.status_code == 200, r.text
    d = r.json()
    assert d["stocked"] == 2 and d["bank"] == 200000 - 5000
    c = db.crews.find_one({"_id": ObjectId(CREW_ID)})
    assert c["pond"] == [950, 951] and c["bank"] == 195000
    # insufficient bank
    db.crews.update_one({"_id": ObjectId(CREW_ID)}, {"$set": {"bank": 100}})
    r = leader.post(f"{API}/crews/{CREW_ID}/pond/stock", json={"species_id": 952})
    assert r.status_code == 400 and "bank" in r.text
    assert db.crews.find_one({"_id": ObjectId(CREW_ID)})["pond"] == [950, 951]


def test_stock_non_manager(crew_backup):
    s2 = login("TestAngler2")
    c = db.crews.find_one({"_id": ObjectId(CREW_ID)})
    u2 = db.users.find_one({"username": "TestAngler2"})
    added = False
    if not any(m["user_id"] == str(u2["_id"]) for m in c["members"]):
        db.crews.update_one({"_id": c["_id"]}, {"$push": {"members": {"user_id": str(u2["_id"]), "username": "TestAngler2", "role": "member"}}})
        added = True
    try:
        r = s2.get(f"{API}/crews/{CREW_ID}/pond")
        assert r.status_code == 200 and r.json()["can_manage"] is False
        r = s2.post(f"{API}/crews/{CREW_ID}/pond/stock", json={"species_id": 952})
        assert r.status_code == 403
    finally:
        if added:
            db.crews.update_one({"_id": c["_id"]}, {"$pull": {"members": {"user_id": str(u2["_id"])}}})


# --- Pond casting ---
def test_cast_pond_no_crew():
    s = login("Niels", "Niels112233!")
    u = db.users.find_one({"username": "Niels"})
    if u.get("crew"):
        pytest.skip("Niels has crew")
    db.users.update_one({"_id": u["_id"]}, {"$set": {"energy": 200, "humancheck": {}}})
    r = s.post(f"{API}/fish/cast", json={"spot": "crew_pond"})
    assert r.status_code == 403, r.text


def test_cast_empty_pond(leader, crew_backup):
    db.crews.update_one({"_id": ObjectId(CREW_ID)}, {"$set": {"pond": []}})
    r = leader.post(f"{API}/fish/cast", json={"spot": "crew_pond"})
    assert r.status_code == 400 and "no fish yet" in r.text
    db.crews.update_one({"_id": ObjectId(CREW_ID)}, {"$set": {"pond": [950, 951]}})


def _cast_until_hooked(s, body, n=25):
    for _ in range(n):
        db.users.update_one({"username": "TestAngler"}, {"$set": {"energy": 500, "humancheck": {}, "rhythm": {}}})
        r = s.post(f"{API}/fish/cast", json=body) if body is not None else s.post(f"{API}/fish/cast")
        assert r.status_code == 200, r.text[:300]
        if r.json()["result"] == "hooked":
            return r.json()
        time.sleep(0.3)
    return None


def test_pond_cast_only_stocked(leader, crew_backup):
    db.crews.update_one({"_id": ObjectId(CREW_ID)}, {"$set": {"pond": [950, 951]}})
    uid = str(db.users.find_one({"username": "TestAngler"})["_id"])
    seen = set()
    for _ in range(5):
        j = _cast_until_hooked(leader, {"spot": "crew_pond"})
        assert j, "never hooked"
        p = db.pending.find_one({"user_id": uid})
        assert p["water"] == "crew_pond"
        seen.add(p["species_id"])
    print("seen", seen)
    assert seen <= {950, 951}


def test_normal_cast_never_pond(leader):
    uid = str(db.users.find_one({"username": "TestAngler"})["_id"])
    for _ in range(4):
        j = _cast_until_hooked(leader, None)
        assert j
        p = db.pending.find_one({"user_id": uid})
        assert p["water"] != "crew_pond" and p.get("species_id") not in POND_IDS
    j = _cast_until_hooked(leader, {})
    assert j
    p = db.pending.find_one({"user_id": uid})
    assert p["water"] != "crew_pond"


def test_pond_land_creates_catch(leader, crew_backup):
    db.crews.update_one({"_id": ObjectId(CREW_ID)}, {"$set": {"pond": [950, 951]}})
    j = _cast_until_hooked(leader, {"spot": "crew_pond"})
    assert j
    enc = j["encounter"]
    st = enc["stamina"]
    time.sleep(st + 0.6)
    el = st + 0.5
    holds = [[0.2, el * 0.3], [el * 0.4, el * 0.7], [el * 0.8, el - 0.1]]
    r = leader.post(f"{API}/fish/land", json={"encounter_id": enc["id"], "success": True, "elapsed": el, "holds": holds, "game_time": el})
    assert r.status_code == 200, r.text
    d = r.json()
    assert d["success"] is True, d
    sid = d["catch"]["species_id"]
    assert sid in (950, 951)
    uid = str(db.users.find_one({"username": "TestAngler"})["_id"])
    c = db.catches.find_one({"user_id": uid, "species_id": sid}, sort=[("_id", -1)])
    assert c["water"] == "crew_pond"
    assert db.journal.find_one({"user_id": uid, "species_id": sid})
    # pond info shows caught
    info = leader.get(f"{API}/crews/{CREW_ID}/pond").json()
    assert next(x for x in info["species"] if x["id"] == sid)["caught"] is True


def test_game_data_has_pond_fish():
    d = requests.get(f"{API}/game/data").json()
    pf = [f for f in d["fish"] if f["id"] in POND_IDS]
    assert len(pf) == 10 and all(f.get("pond") for f in pf)
    for i in POND_IDS:
        assert requests.head(f"{BASE_URL}/art/fish_v2/{i}.webp").status_code == 200
