# Character look (avatar = look:<g>_<s>_<h>): register, guest default, legacy mapping, /me/look, presence look/rod
import os, uuid
import pytest
import requests
from pymongo import MongoClient


def _base():
    u = os.environ.get("REACT_APP_BACKEND_URL")
    if not u:
        for line in open("/app/frontend/.env"):
            if line.startswith("REACT_APP_BACKEND_URL="):
                u = line.split("=", 1)[1].strip()
    return u.rstrip("/") + "/api"


BASE = _base()
PW = "Angler#2026"


def _db():
    env = dict(l.strip().split("=", 1) for l in open("/app/backend/.env") if "=" in l)
    return MongoClient(env["MONGO_URL"].strip('"'))[env["DB_NAME"].strip('"')]


@pytest.fixture(scope="module", autouse=True)
def clear_rate():
    _db().rate_events.delete_many({"action": "signup"})
    yield


def login(name):
    r = requests.post(f"{BASE}/auth/login", json={"username": name, "password": PW}, timeout=20)
    assert r.status_code == 200, r.text
    return {"Authorization": f"Bearer {r.json()['token']}"}


# --- Register with a chosen look
def test_register_with_look_persists():
    name = "TEST_" + uuid.uuid4().hex[:8]
    r = requests.post(f"{BASE}/auth/register", json={"username": name, "password": "Passw0rd!x", "avatar": "look:f_2_3"})
    assert r.status_code == 200, r.text
    assert r.json()["user"]["avatar"] == "look:f_2_3"
    me = requests.get(f"{BASE}/auth/me", headers={"Authorization": f"Bearer {r.json()['token']}"})
    assert me.status_code == 200 and me.json()["avatar"] == "look:f_2_3"


def test_register_invalid_look_falls_back_default():
    name = "TEST_" + uuid.uuid4().hex[:8]
    r = requests.post(f"{BASE}/auth/register", json={"username": name, "password": "Passw0rd!x", "avatar": "av_lad"})
    assert r.status_code == 200, r.text
    assert r.json()["user"]["avatar"] == "look:m_1_1"


def test_register_without_look_default():
    name = "TEST_" + uuid.uuid4().hex[:8]
    r = requests.post(f"{BASE}/auth/register", json={"username": name, "password": "Passw0rd!x"})
    assert r.status_code == 200, r.text
    assert r.json()["user"]["avatar"] == "look:m_1_1"


def test_guest_default_look():
    r = requests.post(f"{BASE}/auth/guest", json={})
    assert r.status_code == 200, r.text
    assert r.json()["user"]["avatar"].startswith("look:")
    # fresh guests get m_1_1 (a resumed guest might have changed it)
    if not r.json().get("resumed"):
        assert r.json()["user"]["avatar"] == "look:m_1_1"


# --- Legacy mapping
def test_legacy_avatar_maps_to_default():
    db = _db()
    u = db.users.find_one({"username": "TestAngler2"})
    orig = u.get("avatar")
    try:
        db.users.update_one({"_id": u["_id"]}, {"$set": {"avatar": "av_lad"}})
        me = requests.get(f"{BASE}/auth/me", headers=login("TestAngler2")).json()
        assert me["avatar"] == "look:m_1_1"
    finally:
        db.users.update_one({"_id": u["_id"]}, {"$set": {"avatar": orig}})


# --- /me/look
class TestSetLook:
    def test_set_valid_look(self):
        h = login("TestAngler2")
        r = requests.post(f"{BASE}/me/look", json={"avatar": "look:m_3_2"}, headers=h)
        assert r.status_code == 200, r.text
        assert r.json()["user"]["avatar"] == "look:m_3_2"
        assert requests.get(f"{BASE}/auth/me", headers=h).json()["avatar"] == "look:m_3_2"

    @pytest.mark.parametrize("bad", ["av_lad", "look:x_9_9", "look:m_4_0", "look:f_0_5", "", "look:m_1_1x"])
    def test_invalid_look_400(self, bad):
        r = requests.post(f"{BASE}/me/look", json={"avatar": bad}, headers=login("TestAngler2"))
        assert r.status_code in (400, 422), r.text

    def test_unauth_401(self):
        r = requests.post(f"{BASE}/me/look", json={"avatar": "look:m_1_1"})
        assert r.status_code in (401, 403)


# --- Presence look / rod
def test_presence_includes_look_and_rod():
    h1, h2 = login("TestAngler"), login("TestAngler2")
    requests.post(f"{BASE}/world/pos", json={"loc": "harbour", "x": 500, "y": 500}, headers=h2)
    r = requests.post(f"{BASE}/world/pos", json={"loc": "harbour", "x": 600, "y": 500}, headers=h1)
    assert r.status_code == 200
    peers = r.json()["players"]
    p2 = next((p for p in peers if p["username"] == "TestAngler2"), None)
    assert p2, peers
    me2 = requests.get(f"{BASE}/auth/me", headers=h2).json()
    assert p2["look"] == me2["avatar"]
    assert p2["rod"] == me2["gear"]["rod"]
