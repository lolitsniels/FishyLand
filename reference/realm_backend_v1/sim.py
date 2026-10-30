"""Deterministic fight simulation. MUST stay identical to frontend/src/game/sim.js."""
DT = 1.0 / 30.0


def mulberry32(seed: int):
    state = [seed & 0xFFFFFFFF]

    def imul(a, b):
        return ((a & 0xFFFFFFFF) * (b & 0xFFFFFFFF)) & 0xFFFFFFFF

    def nxt():
        a = (state[0] + 0x6D2B79F5) & 0xFFFFFFFF
        state[0] = a
        t = imul(a ^ (a >> 15), 1 | a)
        t = ((t + imul(t ^ (t >> 7), 61 | t)) & 0xFFFFFFFF) ^ t
        return ((t ^ (t >> 14)) & 0xFFFFFFFF) / 4294967296
    return nxt


def zone_of(pos, gw):
    d = abs(pos - 0.5)
    if d <= gw:
        return 0
    if d <= gw + 0.1:
        return 1
    if d <= gw + 0.2:
        return 2
    return 3


def simulate(p: dict, held: list):
    rng = mulberry32(p["seed"])
    s, e = p["strength"], p["erratic"]
    power, control, line, gw = p["power"], p["control"], p["line"], p["green_w"]
    limit, tricks = p["limit_ticks"], p["tricks"]
    pos, vel, fill, red, ff, target = 0.5, 0.0, 0.15, 0.0, 0.0, 0.0
    green_ticks = 0
    tick = 0
    while tick < limit:
        h = held[tick] if tick < len(held) else False
        if tick % 6 == 0:
            target = (rng() * 2.0 - 1.0) * e + (rng() - 0.35) * s * 0.6
        ff = ff + (target - ff) * 0.25
        tf = 0.0
        for tr in tricks:
            if tr["at"] <= tick < tr["at"] + tr["dur"]:
                k = tr["kind"]
                if k == "dive":
                    tf = tf + 1.6 * s
                elif k == "run":
                    tf = tf - 1.3 * s
                elif k == "shake":
                    tf = tf + (1.4 * s if tick % 4 < 2 else -1.4 * s)
                else:
                    tf = tf + 1.2 * s
        pf = 1.15 if h else -1.05
        acc = (pf + (ff + tf) / control) * 3.0
        vel = vel * 0.86 + acc * DT
        pos = pos + vel * DT
        if pos < 0.0:
            pos = 0.0
            vel = 0.0
        if pos > 1.0:
            pos = 1.0
            vel = 0.0
        z = zone_of(pos, gw)
        if z == 0:
            fill = fill + DT * power / (6.0 + 10.0 * s)
            green_ticks += 1
        elif z == 1:
            fill = fill + DT * 0.35 * power / (6.0 + 10.0 * s)
        elif z == 2:
            fill = fill - DT * 0.1
        else:
            fill = fill - DT * 0.15
        if fill < 0.0:
            fill = 0.0
        if z == 3:
            red = red + DT
        else:
            red = 0.0
        tick += 1
        if fill >= 1.0:
            return "landed", tick, green_ticks
        if red > 0.6 * line:
            return ("snapped" if pos > 0.5 else "escaped"), tick, green_ticks
    return "timeout", tick, green_ticks
