# Iteration 12: Crews HQ (list/create/join/leave) + crew_island presence + chat dedupe sanity
import os
import time
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
def crew(niels, ta2):
    # make sure neither account is in a crew already
    for h in (ta2, niels):
        c = me(h).get("crew")
        if c:
            requests.post(f"{API}/crews/{c['id']}/leave", headers=h)
    r = requests.post(f"{API}/crews", headers=niels, json={"name": "TEST Pytest Crew", "tag": "TPY", "desc": "t", "open": True})
    assert r.status_code == 200, r.text
    c = r.json()
    yield c
    for h in (ta2, niels):
        requests.post(f"{API}/crews/{c['id']}/leave", headers=h)


class TestCrews:
    def test_list_crews_shape(self, ta1):
        r = requests.get(f"{API}/crews", headers=ta1)
        assert r.status_code == 200
        d = r.json()
        assert isinstance(d["crews"], list) and d["cost"] == 5000 and d["min_level"] == 30

    def test_create_low_level_rejected(self, ta2):
        if me(ta2).get("crew"):
            pytest.skip("already in crew")
        r = requests.post(f"{API}/crews", headers=ta2, json={"name": "TEST Low", "tag": "TLW"})
        assert r.status_code == 400 and "level" in r.json()["detail"].lower()

    def test_create_and_detail(self, crew, niels):
        assert crew["name"] == "TEST Pytest Crew" and crew["tag"] == "TPY"
        d = requests.get(f"{API}/crews/{crew['id']}", headers=niels).json()
        assert d["members"][0]["username"] == "Niels"
        assert me(niels)["crew"]["id"] == crew["id"]

    def test_join_and_member_list(self, crew, ta2, niels):
        r = requests.post(f"{API}/crews/{crew['id']}/join", headers=ta2)
        assert r.status_code == 200, r.text
        assert me(ta2)["crew"]["id"] == crew["id"]
        d = requests.get(f"{API}/crews/{crew['id']}", headers=niels).json()
        assert {m["username"] for m in d["members"]} == {"Niels", "TestAngler2"}

    def test_crew_island_presence(self, crew, ta2, niels, ta1):
        requests.post(f"{API}/world/pos", headers=niels, json={"loc": "crew_island", "x": 500, "y": 500})
        r = requests.post(f"{API}/world/pos", headers=ta2, json={"loc": "crew_island", "x": 510, "y": 500})
        assert r.status_code == 200
        names = [p["username"] for p in r.json()["players"]]
        assert "Niels" in names
        # a non-member sending crew_island lands in harbour, not in the crew room
        r2 = requests.post(f"{API}/world/pos", headers=ta1, json={"loc": "crew_island", "x": 510, "y": 500})
        assert r2.status_code == 200
        assert "Niels" not in [p["username"] for p in r2.json()["players"]]

    def test_leave(self, crew, ta2):
        r = requests.post(f"{API}/crews/{crew['id']}/leave", headers=ta2)
        assert r.status_code == 200
        assert me(ta2).get("crew") is None
