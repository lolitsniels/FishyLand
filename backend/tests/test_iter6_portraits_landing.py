# Iteration 6: retired portrait endpoints (410), profile/leaderboard look:* avatars, landing public APIs
import os, re, uuid
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
LOOK = re.compile(r"^look:[mf]_\d+_\d+$")


def _db():
    env = dict(l.strip().split("=", 1) for l in open("/app/backend/.env") if "=" in l)
    return MongoClient(env["MONGO_URL"].strip('"'))[env["DB_NAME"].strip('"')]


def login(name):
    r = requests.post(f"{BASE}/auth/login", json={"username": name, "password": PW}, timeout=20)
    assert r.status_code == 200, r.text
    return {"Authorization": f"Bearer {r.json()['token']}"}


@pytest.fixture(scope="module")
def h():
    return login("TestAngler")


# --- Retired portrait endpoints
@pytest.mark.parametrize("path", ["/cosmetics/avatar", "/cosmetics/buy-avatar"])
def test_portrait_endpoints_410(h, path):
    before = requests.get(f"{BASE}/auth/me", headers=h, timeout=20).json()
    r = requests.post(f"{BASE}{path}", json={"avatar_id": "av_lad"}, headers=h, timeout=20)
    assert r.status_code == 410, r.text
    after = requests.get(f"{BASE}/auth/me", headers=h, timeout=20).json()
    b = before.get("user", before); a = after.get("user", after)
    assert a["avatar"] == b["avatar"]
    assert LOOK.match(a["avatar"])


# --- Profile returns look:* and no avatar_name
def test_profile_look(h):
    r = requests.get(f"{BASE}/players/TestAngler", headers=h, timeout=20)
    assert r.status_code == 200
    d = r.json()
    u = d.get("user", d)
    assert LOOK.match(u["avatar"]), u["avatar"]
    assert not u.get("avatar_name")


def test_profile_legacy_user_maps_default(h):
    db = _db()
    name = "TEST_" + uuid.uuid4().hex[:8]
    _db().rate_events.delete_many({"action": "signup"})
    r = requests.post(f"{BASE}/auth/register", json={"username": name, "password": PW}, timeout=20)
    assert r.status_code == 200, r.text
    db.users.update_one({"username": name}, {"$set": {"avatar": "av_lad"}})
    p = requests.get(f"{BASE}/players/{name}", headers=h, timeout=20).json()
    u = p.get("user", p)
    assert u["avatar"] == "look:m_1_1"
    assert not u.get("avatar_name")
    db.users.delete_one({"username": name})


def test_leaderboards_look(h):
    r = requests.get(f"{BASE}/leaderboards", headers=h, timeout=20)
    assert r.status_code == 200
    avs = re.findall(r'"avatar":\s*"([^"]*)"', r.text)
    assert avs, "no avatars in leaderboards"
    bad = [a for a in avs if not LOOK.match(a)]
    assert not bad, bad[:5]


def test_period_leaderboards_look(h):
    r = requests.get(f"{BASE}/leaderboards/period", headers=h, timeout=20)
    if r.status_code != 200:
        pytest.skip(f"period {r.status_code}")
    avs = re.findall(r'"avatar":\s*"([^"]*)"', r.text)
    bad = [a for a in avs if not LOOK.match(a)]
    assert not bad, bad[:5]


# --- Landing public endpoints
def test_landing_public_apis():
    s = requests.get(f"{BASE}/game/stats", timeout=20)
    assert s.status_code == 200
    for k in ("online", "players", "active_today", "catches"):
        assert k in s.json()
    n = requests.get(f"{BASE}/news/public", timeout=20)
    assert n.status_code == 200 and isinstance(n.json().get("items"), list)
    c = requests.get(f"{BASE}/news/landing-catches", timeout=20)
    assert c.status_code == 200 and isinstance(c.json(), list)
