"""E2E backend check: guest -> cast -> play fight with a controller -> land; plus anti-cheat rejections."""
import os, sys, time, requests
sys.path.insert(0, "/app/backend")
import sim as S

API = os.environ.get("API", "http://localhost:8001/api")


def controller_holds(p):
    """Greedy controller with 4-tick reaction; returns hold intervals and the end tick."""
    held = []
    rng = S.mulberry32(p["seed"])
    s, e = p["strength"], p["erratic"]
    pos, vel, ff, target, h = 0.5, 0.0, 0.0, 0.0, False
    for tick in range(p["limit_ticks"]):
        if tick % 4 == 0:
            h = pos + vel * 0.3 < 0.5
        held.append(h)
        if tick % 6 == 0:
            target = (rng() * 2.0 - 1.0) * e + (rng() - 0.35) * s * 0.6
        ff = ff + (target - ff) * 0.25
        tf = 0.0
        for tr in p["tricks"]:
            if tr["at"] <= tick < tr["at"] + tr["dur"]:
                k = tr["kind"]
                tf += 1.6 * s if k == "dive" else -1.3 * s if k == "run" else ((1.4 * s if tick % 4 < 2 else -1.4 * s) if k == "shake" else 1.2 * s)
        acc = ((1.15 if h else -1.05) + (ff + tf) / p["control"]) * 3.0
        vel = vel * 0.86 + acc * S.DT
        pos = pos + vel * S.DT
        if pos < 0: pos, vel = 0.0, 0.0
        if pos > 1: pos, vel = 1.0, 0.0
    outcome, end, _ = S.simulate(p, held)
    held = held[:end]
    iv, start = [], None
    for t, v in enumerate(held):
        if v and start is None: start = t
        if not v and start is not None: iv.append([start, t]); start = None
    if start is not None: iv.append([start, end])
    return iv, end, outcome


def main():
    r = requests.post(f"{API}/auth/guest").json()
    H = {"Authorization": f"Bearer {r['access_token']}"}
    p0 = r["player"]
    print("guest", p0["username"], "BR", p0["br"], "stamina", p0["stamina"])

    c = requests.post(f"{API}/fish/cast", json={"bait": "worm"}, headers=H).json()
    r2 = requests.post(f"{API}/fish/land", json={"encounter_id": c["encounter_id"], "holds": []}, headers=H)
    print("empty input ->", r2.status_code, r2.json()["detail"])
    time.sleep(1.6)
    c = requests.post(f"{API}/fish/cast", json={"bait": "worm"}, headers=H).json()
    iv, end, _ = controller_holds(c["params"])
    r3 = requests.post(f"{API}/fish/land", json={"encounter_id": c["encounter_id"], "holds": iv}, headers=H)
    print("too fast ->", r3.status_code, r3.json()["detail"])

    landed = 0
    for i in range(3):
        time.sleep(1.6)
        c = requests.post(f"{API}/fish/cast", json={"bait": "glow_shrimp"}, headers=H).json()
        iv, end, expect = controller_holds(c["params"])
        wait = c["bite_delay_ms"] / 1000 + c["fight_delay_ms"] / 1000 + end * S.DT + 0.2
        time.sleep(wait)
        res = requests.post(f"{API}/fish/land", json={"encounter_id": c["encounter_id"], "holds": iv}, headers=H).json()
        print(f"fight {i}: {c['species_id']} {c['rarity']} expect={expect} server={res['outcome']} ticks={res['end_tick']}/{end}")
        landed += res["outcome"] == "landed"
        reuse = requests.post(f"{API}/fish/land", json={"encounter_id": c["encounter_id"], "holds": iv}, headers=H)
        assert reuse.status_code == 400
    p = requests.get(f"{API}/player", headers=H).json()
    print("after: lvl", p["level"], "xp", p["xp"], "dex", p["fishdex_count"], "BR", p["br"], "rod dur", p["gear"]["rod"]["cur_dur"])
    s = requests.post(f"{API}/inventory/sell", json={"all": True}, headers=H)
    print("sell all ->", s.status_code, s.json().get("gold"))
    e = requests.post(f"{API}/gear/enhance", json={"slot": "rod"}, headers=H).json()
    print("enhance ->", e.get("success"), e.get("enh"), "BR", e["player"]["br"])
    rp = requests.post(f"{API}/gear/repair", json={"slot": "rod"}, headers=H)
    print("repair ->", rp.status_code, rp.json().get("cost", rp.json().get("detail")))
    print("landed", landed, "of 3")


if __name__ == "__main__":
    main()
