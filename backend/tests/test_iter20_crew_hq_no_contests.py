# Iteration 20: Harbour Crew HQ list, crew lifecycle regression, crew tournaments retired (contests), buy-in tournaments intact
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
def crew(niels, ta2):
    for h in (ta2, niels):
        c = me(h).get("crew")
        if c:
            requests.post(f"{API}/crews/{c['id']}/leave", headers=h)
    r = requests.post(f"{API}/crews", headers=niels, json={"name": "TEST Iter20 Crew", "tag": "TI20", "desc": "t", "open": True})
    assert r.status_code == 200, r.text
    c = r.json()
    yield c
    for h in (ta2, niels):
        requests.post(f"{API}/crews/{c['id']}/leave", headers=h)


# Crew tournaments retired
class TestContestsRetired:
    def test_no_open_contests(self, ta2):
        r = requests.get(f"{API}/contests", headers=ta2)
        assert r.status_code == 200, r.text
        d = r.json()
        assert d["current"] == [], d["current"]

    def test_upcoming_has_no_crew_contest(self, ta2):
        d = requests.get(f"{API}/contests", headers=ta2).json()
        assert not d.get("upcoming"), f"upcoming still advertises crew contest: {d.get('upcoming')}"

    def test_buyin_tournaments_still_work(self, ta2):
        r = requests.get(f"{API}/tournaments", headers=ta2)
        assert r.status_code == 200, r.text


# Harbour Crew HQ list + lifecycle
class TestCrewHQ:
    def test_list_shape(self, ta2):
        d = requests.get(f"{API}/crews", headers=ta2).json()
        assert isinstance(d["crews"], list) and d["min_level"] == 30 and "cost" in d and "max" in d
        for c in d["crews"]:
            for k in ("id", "name", "tag", "leader", "member_count", "max_members", "open"):
                assert k in c, k

    def test_low_level_create_rejected(self, ta2):
        if me(ta2).get("crew"):
            pytest.skip("in crew")
        r = requests.post(f"{API}/crews", headers=ta2, json={"name": "TEST Low20", "tag": "TL20"})
        assert r.status_code == 400

    def test_create_and_listed(self, crew, niels):
        d = requests.get(f"{API}/crews", headers=niels).json()
        assert any(c["id"] == crew["id"] for c in d["crews"])
        assert me(niels)["crew"]["id"] == crew["id"]

    def test_join_open(self, crew, ta2, niels):
        r = requests.post(f"{API}/crews/{crew['id']}/join", headers=ta2)
        assert r.status_code == 200, r.text
        d = requests.get(f"{API}/crews/{crew['id']}", headers=niels).json()
        assert {m["username"] for m in d["members"]} == {"Niels", "TestAngler2"}

    def test_settings_toggle(self, crew, niels):
        r = requests.post(f"{API}/crews/{crew['id']}/settings", headers=niels, json={"open": False})
        assert r.status_code == 200, r.text
        assert requests.get(f"{API}/crews/{crew['id']}", headers=niels).json()["open"] is False
        requests.post(f"{API}/crews/{crew['id']}/settings", headers=niels, json={"open": True})

    def test_crew_chat(self, crew, ta2):
        r = requests.post(f"{API}/chat/crew", headers=ta2, json={"text": "TEST iter20 crew hello"})
        assert r.status_code in (200, 201), r.text
        g = requests.get(f"{API}/chat/crew", headers=ta2)
        assert g.status_code == 200 and "TEST iter20 crew hello" in g.text

    def test_leave(self, crew, ta2):
        r = requests.post(f"{API}/crews/{crew['id']}/leave", headers=ta2)
        assert r.status_code == 200
        assert me(ta2).get("crew") is None
