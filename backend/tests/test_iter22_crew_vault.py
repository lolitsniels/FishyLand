# Iteration 22: Clubhouse upgrades - bank cap / Crew Vault perk, deposit cap, buy perms, luck + energy perks applied
import os
import pytest
import requests
from bson import ObjectId
from pymongo import MongoClient

BASE_URL = os.environ.get("REACT_APP_BACKEND_URL").rstrip("/")
API = f"{BASE_URL}/api"


def _env(k):
    for line in open("/app/backend/.env"):
        if line.startswith(k + "="):
            return line.split("=", 1)[1].strip().strip('"')


db = MongoClient(_env("MONGO_URL"))[_env("DB_NAME")]


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
    db.users.update_one({"username": "Niels"}, {"$max": {"gold": 2_000_000}})
    db.users.update_one({"username": "TestAngler2"}, {"$max": {"gold": 50_000}})
    r = requests.post(f"{API}/crews", headers=niels, json={"name": "TEST Iter22 Vault", "tag": "TV22", "desc": "t", "open": True})
    assert r.status_code == 200, r.text
    c = r.json()
    j = requests.post(f"{API}/crews/{c['id']}/join", headers=ta2)
    assert j.status_code == 200, j.text
    yield c
    for h in (ta2, niels):
        requests.post(f"{API}/crews/{c['id']}/leave", headers=h)


def hall(h, cid):
    r = requests.get(f"{API}/crews/{cid}/hall", headers=h)
    assert r.status_code == 200, r.text
    return r.json()


def set_bank(cid, n):
    db.crews.update_one({"_id": ObjectId(cid)}, {"$set": {"bank": n}})


# Hall shape: bank_cap + perk defs
class TestHallDefs:
    def test_bank_cap_default(self, crew, niels):
        h = hall(niels, crew["id"])
        assert h["bank_cap"] == 250000
        assert "_id" not in h

    def test_vault_def(self, crew, niels):
        defs = {d["key"]: d for d in hall(niels, crew["id"])["defs"]}
        v = defs["vault"]
        assert v["name"] == "Crew Vault" and v["tier"] == 0 and v["cost"] == 20000
        assert v["next"] == "the bank holds up to 500,000 gold"
        for k, name in (("luck", "Lucky Charms"), ("energy", "Galley Rations")):
            assert defs[k]["name"] == name
        assert {"hall", "market", "repair"} <= set(defs)


# Deposit cap
class TestDeposit:
    def test_deposit_within_cap(self, crew, ta2):
        set_bank(crew["id"], 0)
        g0 = me(ta2)["gold"]
        r = requests.post(f"{API}/crews/{crew['id']}/hall/deposit", headers=ta2, json={"amount": 100})
        assert r.status_code == 200, r.text
        assert r.json()["hall"]["bank"] == 100
        assert r.json()["user"]["gold"] == g0 - 100

    def test_deposit_beyond_cap_400(self, crew, ta2):
        set_bank(crew["id"], 249_950)
        g0 = me(ta2)["gold"]
        r = requests.post(f"{API}/crews/{crew['id']}/hall/deposit", headers=ta2, json={"amount": 100})
        assert r.status_code == 400, r.text
        assert "Crew Vault" in r.json()["detail"]
        assert me(ta2)["gold"] == g0
        assert hall(ta2, crew["id"])["bank"] == 249_950

    def test_deposit_exact_fill_ok(self, crew, ta2):
        set_bank(crew["id"], 249_950)
        r = requests.post(f"{API}/crews/{crew['id']}/hall/deposit", headers=ta2, json={"amount": 50})
        assert r.status_code == 200, r.text
        assert r.json()["hall"]["bank"] == 250_000


# Buying perks
class TestBuy:
    def test_member_cannot_buy(self, crew, ta2):
        set_bank(crew["id"], 100_000)
        r = requests.post(f"{API}/crews/{crew['id']}/hall/buy", headers=ta2, json={"perk": "vault"})
        assert r.status_code == 403, r.text

    def test_leader_buys_vault(self, crew, niels):
        set_bank(crew["id"], 100_000)
        r = requests.post(f"{API}/crews/{crew['id']}/hall/buy", headers=niels, json={"perk": "vault"})
        assert r.status_code == 200, r.text
        h = hall(niels, crew["id"])
        assert h["bank_cap"] == 500_000 and h["bank"] == 80_000
        v = {d["key"]: d for d in h["defs"]}["vault"]
        assert v["tier"] == 1 and v["current"] == "the bank holds up to 500,000 gold"

    def test_deposit_after_vault(self, crew, ta2):
        set_bank(crew["id"], 260_000)
        r = requests.post(f"{API}/crews/{crew['id']}/hall/deposit", headers=ta2, json={"amount": 100})
        assert r.status_code == 200, r.text

    def test_buy_luck_applies_to_odds(self, crew, niels, ta2):
        set_bank(crew["id"], 100_000)
        r = requests.post(f"{API}/crews/{crew['id']}/hall/buy", headers=niels, json={"perk": "luck"})
        assert r.status_code == 200, r.text
        odds = requests.get(f"{API}/fish/odds", headers=ta2).json()
        crew_part = [p for p in odds["parts"] if p["key"] == "crew"]
        assert crew_part and crew_part[0]["luck"] == 1

    def test_buy_energy_regen(self, crew, niels, ta2):
        before = me(ta2)["energy_regen_sec"]
        set_bank(crew["id"], 100_000)
        r = requests.post(f"{API}/crews/{crew['id']}/hall/buy", headers=niels, json={"perk": "energy"})
        assert r.status_code == 200, r.text
        after = me(ta2)["energy_regen_sec"]
        assert after < before
        assert abs(before / after - 1.1) < 0.02

    def test_officer_can_buy(self, crew, niels, ta2):
        assert requests.post(f"{API}/crews/{crew['id']}/promote", headers=niels, json={"username": "TestAngler2"}).status_code == 200
        set_bank(crew["id"], 100_000)
        r = requests.post(f"{API}/crews/{crew['id']}/hall/buy", headers=ta2, json={"perk": "repair"})
        assert r.status_code == 200, r.text

    def test_not_enough_bank(self, crew, niels):
        set_bank(crew["id"], 10)
        r = requests.post(f"{API}/crews/{crew['id']}/hall/buy", headers=niels, json={"perk": "market"})
        assert r.status_code == 400

    def test_unknown_perk(self, crew, niels):
        r = requests.post(f"{API}/crews/{crew['id']}/hall/buy", headers=niels, json={"perk": "nope"})
        assert r.status_code == 400
