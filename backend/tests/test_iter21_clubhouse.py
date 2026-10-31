# Iteration 21: Crew Clubhouse walk-in room - crew detail trophies/avatars, clubhouse presence isolation, manage/readonly perms
import os
import pytest
import requests

BASE_URL = os.environ.get("REACT_APP_BACKEND_URL").rstrip("/")
API = f"{BASE_URL}/api"


def login(u, p):
    r = requests.post(f"{API}/auth/login", json={"username": u, "password": p})
    assert r.status_code == 200, r.text
    return {"Authorization": f"Bearer {r.json()['token']}"}


def me(h):
    d = requests.get(f"{API}/auth/me", headers=h).json()
    return d.get("user", d)


@pytest.fixture(scope="module")
def niels():
    return login("Niels", "Niels112233!")


@pytest.fixture(scope="module")
def ta2():
    return login("TestAngler2", "Angler#2026")


@pytest.fixture(scope="module")
def ta1():
    return login("TestAngler", "Angler#2026")


@pytest.fixture(scope="module")
def crew(niels, ta2, ta1):
    for h in (ta2, ta1, niels):
        c = me(h).get("crew")
        if c:
            requests.post(f"{API}/crews/{c['id']}/leave", headers=h)
    r = requests.post(f"{API}/crews", headers=niels, json={"name": "TEST Iter21 Club", "tag": "TI21", "desc": "t", "open": True})
    assert r.status_code == 200, r.text
    c = r.json()
    j = requests.post(f"{API}/crews/{c['id']}/join", headers=ta2)
    assert j.status_code == 200, j.text
    yield c
    for h in (ta2, niels):
        requests.post(f"{API}/crews/{c['id']}/leave", headers=h)


# Crew detail: trophies + member avatars
class TestCrewDetail:
    def test_trophies_shape(self, crew, niels):
        r = requests.get(f"{API}/crews/{crew['id']}", headers=niels)
        assert r.status_code == 200, r.text
        t = r.json()["trophies"]
        assert set(["catches", "kg", "species", "best"]) <= set(t)
        assert isinstance(t["catches"], int) and isinstance(t["species"], int)
        assert isinstance(t["best"], list) and len(t["best"]) <= 3

    def test_members_have_avatar_and_roles(self, crew, niels):
        d = requests.get(f"{API}/crews/{crew['id']}", headers=niels).json()
        names = {m["username"]: m for m in d["members"]}
        assert "Niels" in names and "TestAngler2" in names
        assert names["Niels"]["role"] == "leader" and names["TestAngler2"]["role"] == "member"
        for m in d["members"]:
            assert "avatar" in m and "_id" not in m
        assert "_id" not in d

    def test_detail_fields_used_by_shelf(self, crew, ta2):
        d = requests.get(f"{API}/crews/{crew['id']}", headers=ta2).json()
        for k in ("member_count", "max_members", "created_at", "leader", "open"):
            assert k in d, k

    def test_unknown_crew_404(self, niels):
        r = requests.get(f"{API}/crews/000000000000000000000000", headers=niels)
        assert r.status_code == 404


# Clubhouse presence is crew-scoped
class TestClubPresence:
    def test_same_crew_sees_each_other(self, crew, niels, ta2):
        requests.post(f"{API}/world/pos", headers=niels, json={"loc": "clubhouse", "x": 1000, "y": 1100})
        r = requests.post(f"{API}/world/pos", headers=ta2, json={"loc": "clubhouse", "x": 1010, "y": 1100})
        assert r.status_code == 200
        assert "Niels" in [p["username"] for p in r.json()["players"]]

    def test_non_member_not_in_clubhouse(self, crew, niels, ta1):
        requests.post(f"{API}/world/pos", headers=niels, json={"loc": "clubhouse", "x": 1000, "y": 1100})
        r = requests.post(f"{API}/world/pos", headers=ta1, json={"loc": "clubhouse", "x": 1000, "y": 1100})
        assert r.status_code == 200
        assert "Niels" not in [p["username"] for p in r.json()["players"]]

    def test_island_and_clubhouse_separate(self, crew, niels, ta2):
        requests.post(f"{API}/world/pos", headers=niels, json={"loc": "clubhouse", "x": 1000, "y": 1100})
        r = requests.post(f"{API}/world/pos", headers=ta2, json={"loc": "crew_island", "x": 1000, "y": 1100})
        assert "Niels" not in [p["username"] for p in r.json()["players"]]


# Desk / mailbox permissions
class TestClubPerms:
    def test_member_cannot_change_settings(self, crew, ta2):
        r = requests.post(f"{API}/crews/{crew['id']}/settings", headers=ta2, json={"open": False})
        assert r.status_code in (403, 400), r.text

    def test_leader_toggle_open_persists(self, crew, niels):
        r = requests.post(f"{API}/crews/{crew['id']}/settings", headers=niels, json={"open": False})
        assert r.status_code == 200, r.text
        assert requests.get(f"{API}/crews/{crew['id']}", headers=niels).json()["open"] is False
        requests.post(f"{API}/crews/{crew['id']}/settings", headers=niels, json={"open": True})
        assert requests.get(f"{API}/crews/{crew['id']}", headers=niels).json()["open"] is True

    def test_promote_demote(self, crew, niels):
        r = requests.post(f"{API}/crews/{crew['id']}/promote", headers=niels, json={"username": "TestAngler2"})
        assert r.status_code == 200, r.text
        d = requests.get(f"{API}/crews/{crew['id']}", headers=niels).json()
        assert {m["username"]: m["role"] for m in d["members"]}["TestAngler2"] == "officer"
        r = requests.post(f"{API}/crews/{crew['id']}/demote", headers=niels, json={"username": "TestAngler2"})
        assert r.status_code == 200, r.text

    def test_member_cannot_kick(self, crew, ta2):
        r = requests.post(f"{API}/crews/{crew['id']}/kick", headers=ta2, json={"username": "Niels"})
        assert r.status_code in (403, 400)
