# FishyLand Phase 1+2 regression: auth, fishing anti-cheat, inventory, shop, gear
import os
import sys
import time
import uuid

import pytest
import requests

sys.path.insert(0, "/app/backend")
sys.path.insert(0, "/app/scripts")
from e2e_fishing import controller_holds  # noqa: E402
import sim as S  # noqa: E402


def _base():
    url = os.environ.get("REACT_APP_BACKEND_URL")
    if not url:
        with open("/app/frontend/.env") as f:
            for line in f:
                if line.startswith("REACT_APP_BACKEND_URL="):
                    url = line.split("=", 1)[1].strip()
    return url.rstrip("/")


BASE = _base() + "/api"
OWNER = ("owner@fishingrealm.com", "RealmOwner#2026")


def guest():
    r = requests.post(f"{BASE}/auth/guest")
    assert r.status_code == 200
    d = r.json()
    return {"Authorization": f"Bearer {d['access_token']}"}, d["player"]


# --- Auth ---
class TestAuth:
    def test_owner_login(self):
        r = requests.post(f"{BASE}/auth/login", json={"email": OWNER[0], "password": OWNER[1]})
        assert r.status_code == 200
        d = r.json()
        assert d["player"]["role"] == "owner"
        assert "access_token" in d and "refresh_token" in d
        assert "access_token" in r.cookies or "httponly" in r.headers.get("set-cookie", "").lower()

    def test_wrong_password(self):
        r = requests.post(f"{BASE}/auth/login", json={"email": f"TEST_{uuid.uuid4().hex[:6]}@x.com", "password": "bad"})
        assert r.status_code == 401

    def test_register_login_persist(self):
        tag = uuid.uuid4().hex[:8]
        email, pw = f"test_{tag}@example.com", "secret123"
        r = requests.post(f"{BASE}/auth/register", json={"username": f"T_{tag}", "email": email, "password": pw})
        assert r.status_code == 200
        assert r.json()["player"]["gold"] == 1000
        H = {"Authorization": f"Bearer {r.json()['access_token']}"}
        assert requests.post(f"{BASE}/shop/buy", json={"item_id": "glow_shrimp", "qty": 1}, headers=H).status_code == 200
        r2 = requests.post(f"{BASE}/auth/login", json={"email": email, "password": pw})
        assert r2.status_code == 200
        assert r2.json()["player"]["gold"] < 1000
        dup = requests.post(f"{BASE}/auth/register", json={"username": f"U_{tag}", "email": email, "password": pw})
        assert dup.status_code == 400

    def test_register_validation(self):
        r = requests.post(f"{BASE}/auth/register", json={"username": "a", "email": "bad", "password": "1"})
        assert r.status_code == 422

    def test_brute_force_lockout(self):
        email = f"test_lock_{uuid.uuid4().hex[:6]}@example.com"
        codes = [requests.post(f"{BASE}/auth/login", json={"email": email, "password": "x"}).status_code for _ in range(6)]
        assert codes[:5] == [401] * 5
        assert codes[5] == 429

    def test_guest_claim_then_login(self):
        H, p = guest()
        assert p["is_guest"] is True
        email = f"test_claim_{uuid.uuid4().hex[:6]}@example.com"
        r = requests.post(f"{BASE}/auth/claim", json={"email": email, "password": "claim123"}, headers=H)
        assert r.status_code == 200 and r.json()["player"]["is_guest"] is False
        again = requests.post(f"{BASE}/auth/claim", json={"email": email + "x", "password": "claim123"}, headers=H)
        assert again.status_code == 400
        lg = requests.post(f"{BASE}/auth/login", json={"email": email, "password": "claim123"})
        assert lg.status_code == 200 and lg.json()["player"]["id"] == p["id"]

    def test_me_unauth(self):
        assert requests.get(f"{BASE}/auth/me").status_code == 401

    def test_refresh(self):
        r = requests.post(f"{BASE}/auth/guest").json()
        rr = requests.post(f"{BASE}/auth/refresh", json={"refresh_token": r["refresh_token"]})
        assert rr.status_code == 200 and "access_token" in rr.json()


# --- Fishing anti-cheat + real fight ---
class TestFishing:
    def test_anticheat_and_land(self):
        H, p0 = guest()
        c = requests.post(f"{BASE}/fish/cast", json={"bait": "worm"}, headers=H)
        assert c.status_code == 200
        c = c.json()
        assert c["stamina"] == p0["stamina"] - 1
        r = requests.post(f"{BASE}/fish/land", json={"encounter_id": c["encounter_id"], "holds": []}, headers=H)
        assert r.status_code == 400 and "No reel input" in r.json()["detail"]
        # reuse of rejected encounter
        r = requests.post(f"{BASE}/fish/land", json={"encounter_id": c["encounter_id"], "holds": [[0, 5]]}, headers=H)
        assert r.status_code == 400
        # cooldown
        r = requests.post(f"{BASE}/fish/cast", json={"bait": "worm"}, headers=H)
        assert r.status_code == 429
        time.sleep(1.6)
        c = requests.post(f"{BASE}/fish/cast", json={"bait": "worm"}, headers=H).json()
        iv, end, _ = controller_holds(c["params"])
        r = requests.post(f"{BASE}/fish/land", json={"encounter_id": c["encounter_id"], "holds": iv}, headers=H)
        assert r.status_code == 400 and "faster" in r.json()["detail"]
        # bad timeline
        time.sleep(1.6)
        c = requests.post(f"{BASE}/fish/cast", json={"bait": "worm"}, headers=H).json()
        r = requests.post(f"{BASE}/fish/land", json={"encounter_id": c["encounter_id"], "holds": [[10, 5]]}, headers=H)
        assert r.status_code == 400
        # real fight
        time.sleep(1.6)
        c = requests.post(f"{BASE}/fish/cast", json={"bait": "glow_shrimp"}, headers=H).json()
        iv, end, expect = controller_holds(c["params"])
        time.sleep(c["bite_delay_ms"] / 1000 + c["fight_delay_ms"] / 1000 + end * S.DT + 0.2)
        res = requests.post(f"{BASE}/fish/land", json={"encounter_id": c["encounter_id"], "holds": iv}, headers=H)
        assert res.status_code == 200
        res = res.json()
        assert res["outcome"] == expect
        if expect == "landed":
            assert res["fish"]["species_id"] == c["species_id"]
            inv = requests.get(f"{BASE}/inventory/fish", headers=H).json()
            assert any(f["id"] == res["fish"]["id"] for f in inv)
            dex = requests.get(f"{BASE}/fishdex", headers=H).json()
            assert c["species_id"] in dex
            gold0 = res["player"]["gold"]
            s = requests.post(f"{BASE}/inventory/sell", json={"ids": [res["fish"]["id"]]}, headers=H).json()
            assert s["sold"] == 1 and s["player"]["gold"] == gold0 + res["fish"]["value"]
        reuse = requests.post(f"{BASE}/fish/land", json={"encounter_id": c["encounter_id"], "holds": iv}, headers=H)
        assert reuse.status_code == 400

    def test_bad_bait_and_water(self):
        H, _ = guest()
        assert requests.post(f"{BASE}/fish/cast", json={"bait": "enhance_stone"}, headers=H).status_code == 400
        assert requests.post(f"{BASE}/fish/cast", json={"water": "abyss"}, headers=H).status_code == 400
        assert requests.post(f"{BASE}/fish/land", json={"encounter_id": "nope", "holds": [[0, 1]]}, headers=H).status_code == 400


# --- Economy: shop, items, gear ---
class TestEconomy:
    def test_shop_and_potion(self):
        H, p = guest()
        r = requests.post(f"{BASE}/shop/buy", json={"item_id": "glow_shrimp", "qty": 2}, headers=H).json()
        assert r["player"]["items"]["glow_shrimp"] == p["items"]["glow_shrimp"] + 2
        assert r["player"]["gold"] < p["gold"]
        u = requests.post(f"{BASE}/items/use", json={"item_id": "stamina_potion"}, headers=H).json()
        assert u["player"]["stamina"] == p["stamina"] + 30
        assert u["player"]["items"]["stamina_potion"] == p["items"]["stamina_potion"] - 1
        assert requests.post(f"{BASE}/shop/buy", json={"item_id": "glow_shrimp", "qty": 0}, headers=H).status_code == 422
        assert requests.post(f"{BASE}/shop/buy", json={"item_id": "glow_shrimp", "qty": 99}, headers=H).status_code in (200, 400)

    def test_gear_enhance_repair_locked(self):
        H, p = guest()
        r = requests.post(f"{BASE}/gear/buy", json={"slot": "rod", "tier": 2}, headers=H)
        assert r.status_code == 400 and "Requires level 5" in r.json()["detail"]
        rp = requests.post(f"{BASE}/gear/repair", json={"slot": "rod"}, headers=H)
        assert rp.status_code == 400 and "fully repaired" in rp.json()["detail"]
        costs = requests.get(f"{BASE}/gear/costs", headers=H).json()
        e = requests.post(f"{BASE}/gear/enhance", json={"slot": "rod"}, headers=H)
        assert e.status_code == 200
        e = e.json()
        assert e["player"]["gold"] == p["gold"] - costs["rod"]["enhance_gold"]
        assert e["player"]["items"]["enhance_stone"] == p["items"]["enhance_stone"] - costs["rod"]["enhance_stones"]
        if e["success"]:
            assert e["player"]["br"] > p["br"]
        assert requests.post(f"{BASE}/gear/enhance", json={"slot": "boots"}, headers=H).status_code == 400

    def test_sell_nothing(self):
        H, _ = guest()
        assert requests.post(f"{BASE}/inventory/sell", json={"all": True}, headers=H).status_code == 400
        assert requests.post(f"{BASE}/inventory/sell", json={}, headers=H).status_code == 400

    def test_game_data_and_feed(self):
        d = requests.get(f"{BASE}/game/data")
        assert d.status_code == 200
        assert requests.get(f"{BASE}/world/feed").status_code == 200
