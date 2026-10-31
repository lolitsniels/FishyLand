# Iteration 23: tutorial endpoints, patron portraits, fish_v2 art coverage
import os
import pytest
import requests

BASE_URL = os.environ.get("REACT_APP_BACKEND_URL").rstrip("/")


@pytest.fixture(scope="module")
def s():
    ss = requests.Session()
    r = ss.post(f"{BASE_URL}/api/auth/login", json={"username": "TestAngler", "password": "Angler#2026"})
    if r.status_code != 200:
        pytest.skip("login failed")
    ss.headers["Authorization"] = f"Bearer {r.json().get('token') or r.json().get('access_token')}"
    return ss


# Tutorial API
def test_tutorial_restart_and_step(s):
    r = s.post(f"{BASE_URL}/api/tutorial/restart")
    assert r.status_code == 200
    t = r.json()["user"]["tutorial"]
    assert t["step"] == 0 and t["done"] is False
    r = s.post(f"{BASE_URL}/api/tutorial/step", json={"step": 1})
    assert r.json()["user"]["tutorial"]["step"] == 1
    r = s.post(f"{BASE_URL}/api/tutorial/step", json={"step": 99})
    assert r.status_code == 422


def test_tutorial_skip_then_restart(s):
    r = s.post(f"{BASE_URL}/api/tutorial/skip")
    assert r.json()["user"]["tutorial"]["done"] is True
    r = s.post(f"{BASE_URL}/api/tutorial/restart")
    assert r.json()["user"]["tutorial"]["done"] is False


# Patron portraits on contracts
def test_contract_portraits(s):
    r = s.get(f"{BASE_URL}/api/contracts")
    assert r.status_code == 200, r.text[:200]
    d = r.json()
    ports = {p["id"]: p["portrait"] for p in d.get("patrons", [])}
    print(ports)
    assert set(ports) >= {"harbourmaster", "baitseller", "sailor", "cook"}
    for pid, url in ports.items():
        assert url == f"/art/npc/{pid}.webp"
        assert requests.get(f"{BASE_URL}{url}").status_code == 200


# All species art
def test_all_species_art_exist(s):
    d = s.get(f"{BASE_URL}/api/game/data").json()
    ids = sorted({f.get("species_id", f.get("id")) for f in d["fish"]})
    print("species", len(ids))
    missing = []
    for i in ids:
        r = requests.head(f"{BASE_URL}/art/fish_v2/{i}.webp")
        if r.status_code != 200 or "image" not in r.headers.get("content-type", ""):
            missing.append(i)
    assert not missing, missing
    assert len(ids) >= 356
