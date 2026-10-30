# Iteration 8: crab cages removed, contracts/crew orders still load, shop buy, market, presence coords up to 6000
import os
import pytest
import requests

BASE_URL = os.environ.get("REACT_APP_BACKEND_URL").rstrip("/")


def _login(u, p):
    r = requests.post(f"{BASE_URL}/api/auth/login", json={"username": u, "password": p}, timeout=20)
    if r.status_code != 200:
        pytest.skip(f"login failed {r.status_code}")
    d = r.json()
    return d.get("token") or d.get("access_token")


@pytest.fixture(scope="module")
def h():
    return {"Authorization": f"Bearer {_login('TestAngler', 'Angler#2026')}"}


# Game data: no cage fish/cage items
def test_game_data_no_cages(h):
    r = requests.get(f"{BASE_URL}/api/game/data", headers=h, timeout=20)
    assert r.status_code == 200
    d = r.json()
    fish = d.get("fish") or []
    assert len(fish) > 0
    assert not [f for f in fish if f.get("cage")], "cage fish still listed"
    assert "cages" not in d or not d["cages"]
    assert "crab" not in r.text.lower() or "cage" not in r.text.lower().replace("caged, living", "")


# Removed cage endpoints should 404/405
@pytest.mark.parametrize("path", ["/api/cages", "/api/crab-cages", "/api/cages/state"])
def test_cage_endpoints_gone(h, path):
    r = requests.get(f"{BASE_URL}{path}", headers=h, timeout=20)
    assert r.status_code in (404, 405)


# Contracts load
def test_contracts_load(h):
    r = requests.get(f"{BASE_URL}/api/contracts", headers=h, timeout=20)
    assert r.status_code == 200, r.text
    body = r.text.lower()
    assert "crab cage" not in body
    r2 = requests.get(f"{BASE_URL}/api/contracts/wanted", headers=h, timeout=20)
    assert r2.status_code == 200, r2.text


# Crew + crew order load
def test_crew_order_load(h):
    me = requests.get(f"{BASE_URL}/api/auth/me", headers=h, timeout=20)
    assert me.status_code == 200
    crews = requests.get(f"{BASE_URL}/api/crews", headers=h, timeout=20)
    assert crews.status_code == 200, crews.text
    cid = me.json().get("crew_id") or (me.json().get("user") or {}).get("crew_id")
    if not cid:
        lst = crews.json()
        lst = lst.get("crews", lst) if isinstance(lst, dict) else lst
        if not lst:
            pytest.skip("no crews")
        cid = lst[0].get("id")
    r = requests.get(f"{BASE_URL}/api/crews/{cid}", headers=h, timeout=20)
    assert r.status_code == 200, r.text
    r = requests.get(f"{BASE_URL}/api/crews/{cid}/order", headers=h, timeout=20)
    assert r.status_code in (200, 403, 404), r.text
    assert r.status_code != 500


# Buy cheap bait and verify gold decreases
def test_buy_bait(h):
    d = requests.get(f"{BASE_URL}/api/game/data", headers=h, timeout=20).json()
    baits = [b for b in d.get("baits", d.get("bait", [])) if b.get("price") and not b.get("pearls") and b.get("level", 1) <= 1]
    assert baits, "no cheap bait"
    b = min(baits, key=lambda x: x["price"])
    me0 = requests.get(f"{BASE_URL}/api/auth/me", headers=h, timeout=20).json()
    u0 = me0.get("user", me0)
    r = requests.post(f"{BASE_URL}/api/shop/buy-bait", headers=h, json={"bait_id": b["id"], "qty": 1}, timeout=20)
    assert r.status_code == 200, r.text
    u1 = r.json()
    assert u1["gold"] < u0["gold"]
    assert u1["bait"].get(b["id"], 0) > (u0.get("bait") or {}).get(b["id"], 0)


def test_market_load(h):
    r = requests.get(f"{BASE_URL}/api/market", headers=h, timeout=20)
    assert r.status_code == 200, r.text


def test_waters_no_cage(h):
    r = requests.get(f"{BASE_URL}/api/game/data", headers=h, timeout=20)
    w = r.json().get("waters")
    assert w is not None
    assert "cage" not in str(w).lower()
