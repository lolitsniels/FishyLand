# Iteration 35: Wheel of Fortune art URLs (no broken images) + TestAngler2 golden wheel + harbour map art
import os
from datetime import datetime, timedelta, timezone

import pytest
import requests
from dotenv import load_dotenv
from pymongo import MongoClient

load_dotenv("/app/frontend/.env")
load_dotenv("/app/backend/.env")
BASE_URL = os.environ.get("REACT_APP_BACKEND_URL").rstrip("/")
DB = MongoClient(os.environ.get("MONGO_URL"))[os.environ.get("DB_NAME")]


def art(seg):  # mirrors frontend/src/tfl/lib/prizeArt.js
    k = seg["kind"]
    if k == "fish": return f"/art/fish_v2/{seg['species_id']}.webp" if seg.get("species_id") else "/art/spin/mystery_fish.webp"
    if k == "gold": return "/art/hud/gold.webp"
    if k == "pearls": return "/art/hud/pearl.webp"
    if k == "mythic": return "/art/fish_v2/331.webp"
    return f"/art/gear/{seg['item']}.webp"


def login(name):
    r = requests.post(f"{BASE_URL}/api/auth/login", json={"username": name, "password": "Angler#2026"}, timeout=20)
    assert r.status_code == 200, r.text
    s = requests.Session(); s.headers["Authorization"] = f"Bearer {r.json()['token']}"
    return s


def ok_img(path):
    r = requests.get(BASE_URL + path, timeout=20)
    return r.status_code == 200 and ("image" in r.headers.get("content-type", "")) and len(r.content) > 200


# Normal wheel art for TestAngler loads
def test_normal_wheel_art_loads():
    s = login("TestAngler")
    g = s.get(f"{BASE_URL}/api/daily-spin").json()
    assert len(g["segments"]) == (10 if g["better"] else 8)
    bad = [art(x) for x in g["segments"] if not ok_img(art(x))]
    assert not bad, bad


# Every crafted bait id (random pick per day) has gear art
def test_all_crafted_bait_art_exists():
    import sys; sys.path.insert(0, "/app/backend")
    from server import BAITS
    bad = [b["id"] for b in BAITS if b.get("crafted") and not ok_img(f"/art/gear/{b['id']}.webp")]
    assert not bad, bad
    assert ok_img("/art/gear/bait_live.webp")


# Golden wheel for TestAngler2: day 7, 10 segments, bonus 5 pearls, art loads
def test_golden_wheel_testangler2():
    y = (datetime.now(timezone.utc) - timedelta(days=1)).strftime("%Y-%m-%d")
    DB.users.update_one({"username": "TestAngler2"}, {"$set": {"login_chest": {"day": 6, "last_claim": y}}})
    s = login("TestAngler2")
    g = s.get(f"{BASE_URL}/api/daily-spin").json()
    assert g["day"] == 7 and g["better"] is True and len(g["segments"]) == 10
    bad = [art(x) for x in g["segments"] if not ok_img(art(x))]
    assert not bad, bad
    p0 = s.get(f"{BASE_URL}/api/auth/me").json()
    p0 = p0.get("pearls", p0.get("user", {}).get("pearls"))
    r = s.post(f"{BASE_URL}/api/daily-spin/spin").json()
    assert r["spun"] is True and r["result"]["bonus_pearls"] == 5
    seg = g["segments"][r["result"]["index"]]
    assert r["user"]["pearls"] == p0 + 5 + (seg["qty"] if seg["kind"] == "pearls" else 0)
    r2 = s.post(f"{BASE_URL}/api/daily-spin/spin").json()
    assert r2["spun"] is False
    # reset golden state again so UI test can use the golden wheel
    DB.users.update_one({"username": "TestAngler2"}, {"$set": {"login_chest": {"day": 6, "last_claim": y}}})


# Static spin modal + mythic art
@pytest.mark.parametrize("p", ["/art/npc/body_harbourmaster.webp", "/art/spin/mystery_fish.webp", "/art/fish_v2/331.webp", "/art/hud/gold.webp", "/art/hud/pearl.webp"])
def test_static_art(p):
    assert ok_img(p), p
