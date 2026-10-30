# Iteration 18: live duel catches give nothing (no inventory/xp/gold/journal), score still counts; winner gets no gold
import time

import pytest
import requests

from test_iter16_catch_card import BASE


def _login(u):
    r = requests.post(f"{BASE}/auth/login", json={"username": u, "password": "Angler#2026"})
    if r.status_code != 200:
        pytest.skip(f"login {u} failed {r.status_code}")
    d = r.json()
    return {"Authorization": f"Bearer {d.get('access_token') or d.get('token')}"}


def _snap(H):
    r = requests.get(f"{BASE}/auth/me", headers=H)
    assert r.status_code == 200, r.text[:200]
    p = r.json().get("user", r.json())
    inv = requests.get(f"{BASE}/inventory", headers=H).json()
    j = requests.get(f"{BASE}/journal", headers=H).json()
    jc = sum(v.get("count", 0) for v in j.values())
    s = {"gold": p.get("gold"), "xp": p.get("xp"), "dex": len(j), "inv": len(inv.get("fish", [])), "journal": jc}
    assert s["gold"] is not None and s["xp"] is not None, p.keys()
    return s


def _land(H):
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
            if r.json().get("success"):
                return r.json()
        time.sleep(1.7)
    pytest.skip("could not land a fish")


@pytest.fixture(scope="module")
def duel():
    h1, h2 = _login("TestAngler"), _login("TestAngler2")
    for h in (h1, h2):
        requests.post(f"{BASE}/duel/live/leave", headers=h)
    s = requests.get(f"{BASE}/duel/live/state", headers=h1).json()
    if s.get("state") == "matched":
        pytest.skip(f"TestAngler still in a duel: {s}")
    assert requests.post(f"{BASE}/duel/live/queue", headers=h1).json()["state"] == "waiting"
    m = requests.post(f"{BASE}/duel/live/queue", headers=h2).json()
    assert m["state"] == "matched", m
    time.sleep(7)
    return h1, h2


def test_duel_catch_gives_nothing(duel):
    h1, h2 = duel
    before = _snap(h1)
    res = _land(h1)
    after = _snap(h1)
    print("before", before, "after", after, "res", {k: res.get(k) for k in ("duel", "xp")}, res["catch"])
    assert res.get("duel") is True
    assert res.get("xp") == 0
    assert "id" not in res["catch"] and "value" not in res["catch"]
    assert after["inv"] == before["inv"]
    assert after["gold"] == before["gold"]
    assert after["xp"] == before["xp"]
    assert after["dex"] == before["dex"]
    assert after["journal"] == before["journal"]
    s1 = requests.get(f"{BASE}/duel/live/state", headers=h1).json()["match"]
    s2 = requests.get(f"{BASE}/duel/live/state", headers=h2).json()["match"]
    assert s1["me"]["kg"] == pytest.approx(res["catch"]["weight"], abs=0.01)
    assert s2["foe"]["kg"] == pytest.approx(res["catch"]["weight"], abs=0.01)
    assert s1["me"]["catches"] == 1


def test_duel_end_no_gold(duel):
    h1, h2 = duel
    g1 = _snap(h1)["gold"]
    m = requests.get(f"{BASE}/duel/live/state", headers=h1).json()["match"]
    time.sleep(m["seconds_left"] + 3)
    s1 = requests.get(f"{BASE}/duel/live/state", headers=h1).json()["match"]
    s2 = requests.get(f"{BASE}/duel/live/state", headers=h2).json()["match"]
    print(s1, s2)
    assert s1["phase"] == "done" and s1["result"] == "win" and s2["result"] == "lose"
    assert not s1.get("reward")
    assert _snap(h1)["gold"] == g1
    for h in (h1, h2):
        assert requests.post(f"{BASE}/duel/live/leave", headers=h).status_code == 200


def test_normal_catch_after_duel_regular(duel):
    h1, _ = duel
    before = _snap(h1)
    res = _land(h1)
    after = _snap(h1)
    assert not res.get("duel")
    assert res["xp"] > 0 and res["catch"].get("id")
    assert after["inv"] == before["inv"] + 1
    requests.post(f"{BASE}/inventory/sell", json={"catch_ids": [res["catch"]["id"]]}, headers=h1)
