# Iteration 14: finished live duel stays in phase 'done' for each player until /duel/live/leave
import os, time
import pytest, requests


def _base():
    u = os.environ.get("REACT_APP_BACKEND_URL")
    if not u:
        for l in open("/app/frontend/.env"):
            if l.startswith("REACT_APP_BACKEND_URL="):
                u = l.split("=", 1)[1].strip()
    return u.rstrip("/") + "/api"


BASE = _base()


def _login(name):
    r = requests.post(f"{BASE}/auth/login", json={"username": name, "password": "Angler#2026"})
    assert r.status_code == 200, r.text
    return {"Authorization": f"Bearer {r.json()['token']}"}


def _st(h):
    return requests.get(f"{BASE}/duel/live/state", headers=h).json()


@pytest.fixture(scope="module")
def H():
    a, b = _login("TestAngler"), _login("TestAngler2")
    for h in (a, b):
        s = _st(h)
        if s["state"] == "matched" and s["match"]["phase"] == "done":
            requests.post(f"{BASE}/duel/live/leave", headers=h)
    for _ in range(80):
        if _st(a)["state"] != "matched" and _st(b)["state"] != "matched":
            break
        time.sleep(3)
    requests.post(f"{BASE}/duel/live/leave", headers=a); requests.post(f"{BASE}/duel/live/leave", headers=b)
    return a, b


def test_done_phase_persists_until_leave(H):
    a, b = H
    assert requests.post(f"{BASE}/duel/live/queue", headers=a).json()["state"] == "waiting"
    m = requests.post(f"{BASE}/duel/live/queue", headers=b).json()["match"]
    time.sleep(max(0, m["seconds_left"]) + 2)
    sa, sb = _st(a), _st(b)
    assert sa["state"] == "matched" and sa["match"]["phase"] == "done", sa
    assert sb["state"] == "matched" and sb["match"]["phase"] == "done", sb
    assert sa["match"]["result"] == "draw" and sb["match"]["result"] == "draw"
    assert sa["match"]["reward"] == 0
    # keep polling for 20 s: still done for both
    for _ in range(4):
        time.sleep(5)
        assert _st(a)["match"]["phase"] == "done" and _st(b)["match"]["phase"] == "done"
    # A leaves -> A idle, B still done
    assert requests.post(f"{BASE}/duel/live/leave", headers=a).json() == {"ok": True}
    assert _st(a)["state"] == "idle"
    sb = _st(b)
    assert sb["state"] == "matched" and sb["match"]["phase"] == "done", sb
    # A can queue again without being matched into the old duel
    q = requests.post(f"{BASE}/duel/live/queue", headers=a).json()
    assert q["state"] == "waiting", q
    requests.post(f"{BASE}/duel/live/leave", headers=a)
    assert requests.post(f"{BASE}/duel/live/leave", headers=b).json() == {"ok": True}
    assert _st(b)["state"] == "idle"
