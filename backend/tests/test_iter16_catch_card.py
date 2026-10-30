# Iteration 16: catch popup backend data — length_cm on land/inventory, logical fish_length, sell flow
import os
import sys
import time

import pytest
import requests

sys.path.insert(0, "/app/backend")
from fish_size import fish_length, shape_a  # noqa: E402
from game_data import FISH, FISH_BY_ID  # noqa: E402


def _base():
    v = os.environ.get("REACT_APP_BACKEND_URL")
    if not v:
        for line in open("/app/frontend/.env"):
            if line.startswith("REACT_APP_BACKEND_URL="):
                v = line.split("=", 1)[1].strip()
    return v.rstrip("/")


ROOT = _base()
BASE = ROOT + "/api"


@pytest.fixture(scope="module")
def H():
    r = requests.post(f"{BASE}/auth/login", json={"username": "TestAngler", "password": "Angler#2026"})
    if r.status_code != 200:
        pytest.skip(f"login failed {r.status_code} {r.text[:200]}")
    d = r.json()
    tok = d.get("access_token") or d.get("token")
    return {"Authorization": f"Bearer {tok}"}


@pytest.fixture(scope="module")
def landed(H):
    """Cast until hooked, wait out the fight, land successfully. Returns land response."""
    for _ in range(25):
        c = requests.post(f"{BASE}/fish/cast", json={}, headers=H)
        assert c.status_code == 200, c.text[:300]
        d = c.json()
        if d.get("result") == "hooked" and not d["encounter"].get("boss_id"):
            enc = d["encounter"]
            wait = enc["stamina"] * 0.95 + 0.5
            time.sleep(wait)
            holds = [[i * 1.0, i * 1.0 + 0.6] for i in range(int(wait))]
            r = requests.post(f"{BASE}/fish/land", json={"encounter_id": enc["id"], "success": True, "elapsed": wait,
                                                         "game_time": wait, "holds": holds}, headers=H)
            assert r.status_code == 200, r.text[:300]
            res = r.json()
            if res.get("success"):
                return res
        time.sleep(1.7)
    pytest.skip("Could not land a fish in 25 casts")


# fish_length unit: logical sizes
class TestFishLength:
    def test_bluegill_range(self):
        bg = next(f for f in FISH if f["name"] == "Bluegill")
        assert 14 <= fish_length(bg, 0.1) <= 17
        assert 30 <= fish_length(bg, 0.9) <= 33

    def test_pike_longer_than_carp_same_weight(self):
        assert fish_length({"name": "Northern Pike"}, 5) > fish_length({"name": "Common Carp"}, 5) * 1.3

    def test_monotonic_and_positive(self):
        for f in FISH:
            lo, hi = fish_length(f, f["min_kg"]), fish_length(f, f["max_kg"])
            assert 0 < lo <= hi, f["name"]

    def test_moray_is_eel_shaped(self):
        # 'Moray' contains 'ray' -> classified DEEP (a=0.028) before EEL; morays are eels
        assert shape_a("Green Moray") == 0.0018, f"Green Moray a={shape_a('Green Moray')}"


# land API returns length_cm consistent with weight/species
class TestLandAndInventory:
    def test_land_has_length(self, landed):
        c = landed["catch"]
        assert isinstance(c["length_cm"], (int, float)) and c["length_cm"] > 0
        assert abs(c["length_cm"] - fish_length(FISH_BY_ID[c["species_id"]], c["weight"])) < 0.2
        assert c["rarity"] in ("common", "uncommon", "rare", "epic", "legendary", "mythic")
        assert isinstance(landed.get("xp"), (int, float)) and landed["xp"] > 0
        assert c.get("id")

    def test_inventory_lengths_consistent(self, H, landed):
        inv = requests.get(f"{BASE}/inventory", headers=H).json()
        ids = {f["id"]: f for f in inv["fish"]}
        assert landed["catch"]["id"] in ids
        bad = []
        for f in inv["fish"]:
            sp = FISH_BY_ID.get(f["species_id"])
            if not sp or f.get("length_cm") is None:
                bad.append((f.get("name"), f.get("length_cm")))
                continue
            if abs(f["length_cm"] - fish_length(sp, f["weight"])) > 0.2:
                bad.append((f["name"], f["weight"], f["length_cm"]))
        assert not bad, bad[:10]

    def test_sell_landed(self, H, landed):
        g0 = requests.get(f"{BASE}/auth/me", headers=H).json()["gold"]
        r = requests.post(f"{BASE}/inventory/sell", json={"catch_ids": [landed["catch"]["id"]]}, headers=H)
        assert r.status_code == 200, r.text[:200]
        d = r.json()
        assert d["count"] == 1 and d["gold"] >= 1
        assert d["user"]["gold"] == g0 + d["gold"]
        inv = requests.get(f"{BASE}/inventory", headers=H).json()
        assert landed["catch"]["id"] not in {f["id"] for f in inv["fish"]}


# regression iteration 15: crew island music asset served
def test_crew_island_audio():
    r = requests.get(f"{ROOT}/audio/crew_island.mp3", stream=True)
    assert r.status_code == 200
    assert "audio" in r.headers.get("content-type", "") or "mpeg" in r.headers.get("content-type", "")
