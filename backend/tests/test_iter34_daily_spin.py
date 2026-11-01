# Iteration 34: Wheel of Fortune (daily spin) - normal wheel, once-per-day, fish slice, golden day-7 wheel, streak reset
import os
from datetime import datetime, timedelta, timezone

import pytest
import requests
from bson import ObjectId
from dotenv import load_dotenv
from pymongo import MongoClient

load_dotenv("/app/frontend/.env")
load_dotenv("/app/backend/.env")
BASE_URL = os.environ.get("REACT_APP_BACKEND_URL").rstrip("/")
DB = MongoClient(os.environ.get("MONGO_URL"))[os.environ.get("DB_NAME")]

NORMAL_IDS = ["gold_s", "bait", "gold_m", "crafted", "pearls_s", "gold_l", "pearls_m", "fish_rare"]
NORMAL_KINDS = ["gold", "bait", "gold", "crafted", "pearls", "gold", "pearls", "fish"]
GOLDEN_IDS = ["gold_l", "pearls_5", "crafted", "pearls_10", "gold_xl", "fish_epic", "pearls_20", "fish_legendary", "skin", "jackpot"]


def day(offset=0):
    return (datetime.now(timezone.utc) + timedelta(days=offset)).strftime("%Y-%m-%d")


def guest():
    r = requests.post(f"{BASE_URL}/api/auth/guest", timeout=20)
    assert r.status_code == 200
    d = r.json()
    s = requests.Session()
    s.headers["Authorization"] = f"Bearer {d['token']}"
    return s, d["user"]["id"]


def set_chest(uid, d, last):
    DB.users.update_one({"_id": ObjectId(uid)}, {"$set": {"login_chest": {"day": d, "last_claim": last}}})


def pearls(uid):
    return DB.users.find_one({"_id": ObjectId(uid)}).get("pearls", 0)


# Normal wheel state
def test_get_normal_wheel():
    s, _ = guest()
    d = s.get(f"{BASE_URL}/api/daily-spin").json()
    assert d["day"] == 1 and d["better"] is False and d["claimed_today"] is False
    assert [x["id"] for x in d["segments"]] == NORMAL_IDS
    assert [x["kind"] for x in d["segments"]] == NORMAL_KINDS
    assert sum(x["weight"] for x in d["segments"]) == 100
    kinds = {x["kind"] for x in d["segments"]}
    assert not kinds & {"scrap", "xp", "potion", "crate_bronze", "crate_silver", "ingredient"}
    assert d["segments"][1]["name"] == "Live Bait" or "Live" in d["segments"][1]["label"]
    assert d["segments"][4]["label"] == "1 Pearl" and d["segments"][6]["label"] == "3 Pearls"
    assert "rare" in d["segments"][7]["label"].lower()
    assert "day_key" not in d


# Once per UTC day
def test_spin_once_per_day():
    s, _ = guest()
    r = s.post(f"{BASE_URL}/api/daily-spin/spin").json()
    assert r["spun"] is True
    res = r["result"]
    assert res["id"] in NORMAL_IDS and res["day"] == 1 and res["better"] is False and isinstance(res["label"], str)
    assert "bonus_pearls" not in res
    assert r["state"]["claimed_today"] is True and r["state"]["last"]["id"] == res["id"]
    r2 = s.post(f"{BASE_URL}/api/daily-spin/spin").json()
    assert r2["spun"] is False and "already" in r2["message"].lower()
    g = s.get(f"{BASE_URL}/api/daily-spin").json()
    assert g["claimed_today"] is True and g["last"]["index"] == res["index"]


# Fish slice lands fish in inventory (reset chest repeatedly until fish slice hits)
def test_fish_slice_goes_to_inventory():
    s, uid = guest()
    for _ in range(250):
        before = s.get(f"{BASE_URL}/api/inventory").json()["total"]
        r = s.post(f"{BASE_URL}/api/daily-spin/spin").json()
        print("SPIN", _, r.get("spun"), r.get("result", {}).get("id"), r.get("state", {}).get("day"))
        assert r["spun"] is True, (r, DB.users.find_one({"_id": ObjectId(uid)}).get("login_chest"))
        if r["result"]["id"] == "fish_rare":
            f = r["result"]["fish"]
            assert f["rarity"] == "rare"
            inv = s.get(f"{BASE_URL}/api/inventory").json()
            assert inv["total"] == before + 1
            assert any(x.get("species_id") == f["species_id"] or x.get("name") == f["name"] for x in inv["fish"])
            assert f["name"] in r["result"]["label"]
            return
        set_chest(uid, 0, day(-3))
    pytest.fail("fish slice never hit in 250 spins")


# Golden wheel on day 7
def test_golden_wheel_day7():
    s, uid = guest()
    set_chest(uid, 6, day(-1))
    g = s.get(f"{BASE_URL}/api/daily-spin").json()
    assert g["day"] == 7 and g["better"] is True and len(g["segments"]) == 10
    assert [x["id"] for x in g["segments"]] == GOLDEN_IDS
    assert sum(x["weight"] for x in g["segments"]) == 100
    seen_pearl_slice = False
    for _ in range(40):
        p0 = pearls(uid)
        r = s.post(f"{BASE_URL}/api/daily-spin/spin").json()
        assert r["spun"] is True and r["result"]["better"] is True and r["result"]["day"] == 7
        assert r["result"]["bonus_pearls"] == 5
        p1 = pearls(uid)
        seg = next(x for x in g["segments"] if x["id"] == r["result"]["id"])
        extra = seg["qty"] if seg["kind"] == "pearls" else 0
        if seg["kind"] == "skin" and "Pearls" in r["result"]["label"]:
            extra = 25
        assert p1 - p0 == extra + 5, (seg, p0, p1)
        assert r["user"]["pearls"] == p1
        assert r["state"]["last"]["bonus_pearls"] == 5
        if seg["kind"] == "pearls":
            seen_pearl_slice = True
            break
        set_chest(uid, 6, day(-1))
    assert seen_pearl_slice


# After day 7, next day wraps to day 1
def test_streak_wraps_after_day7():
    s, uid = guest()
    set_chest(uid, 7, day(-1))
    assert s.get(f"{BASE_URL}/api/daily-spin").json()["day"] == 1


# Consecutive day increments
def test_streak_increments():
    s, uid = guest()
    set_chest(uid, 3, day(-1))
    g = s.get(f"{BASE_URL}/api/daily-spin").json()
    assert g["day"] == 4 and g["better"] is False


# Missing a day resets to day 1
def test_streak_reset_on_missed_day():
    s, uid = guest()
    set_chest(uid, 3, day(-3))
    g = s.get(f"{BASE_URL}/api/daily-spin").json()
    assert g["day"] == 1 and g["better"] is False and len(g["segments"]) == 8


# Auth required
def test_spin_requires_auth():
    assert requests.get(f"{BASE_URL}/api/daily-spin").status_code in (401, 403)
    assert requests.post(f"{BASE_URL}/api/daily-spin/spin").status_code in (401, 403)
