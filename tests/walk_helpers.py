# WASD walk-to helper (exec'd with g=globals()): steers fx.keys towards waypoints, reports stalls
WALK_JS = """async ([pts, maxMs]) => {
  const sleep = (t) => new Promise(r => setTimeout(r, t)); const log = [];
  __fx.dest = null; __fx.path = [];
  for (const [tx, ty] of pts) {
    const t0 = performance.now(); let last = [__fx.me.x, __fx.me.y], lastT = t0, stalled = false;
    while (performance.now() - t0 < maxMs) {
      const dx = tx - __fx.me.x, dy = ty - __fx.me.y;
      if (Math.hypot(dx, dy) < 14) break;
      __fx.keys.clear();
      if (Math.abs(dx) > 10) __fx.keys.add(dx < 0 ? 'left' : 'right');
      if (Math.abs(dy) > 10) __fx.keys.add(dy < 0 ? 'up' : 'down');
      await sleep(120);
      if (performance.now() - lastT > 2500) {
        if (Math.hypot(__fx.me.x - last[0], __fx.me.y - last[1]) < 4) { stalled = true; break; }
        last = [__fx.me.x, __fx.me.y]; lastT = performance.now();
      }
    }
    __fx.keys.clear(); await sleep(250);
    log.push({ to: [tx, ty], at: [Math.round(__fx.me.x), Math.round(__fx.me.y)], stalled, near: __fx.near, atSpot: __fx.atSpot });
  }
  return log;
}"""

def subdivide(pts, start, step=28):
    out, (px, py) = [], start
    for (x, y) in pts:
        n = max(1, int(((x - px) ** 2 + (y - py) ** 2) ** 0.5 // step))
        out += [[px + (x - px) * i / n, py + (y - py) * i / n] for i in range(1, n + 1)]
        px, py = x, y
    return out

async def walk(page, pts, max_ms=30000, fine=False):
    if fine:
        me = await page.evaluate("()=>[__fx.me.x,__fx.me.y]")
        pts = subdivide(pts, me)
    r = await page.evaluate(WALK_JS, [pts, max_ms])
    if fine:
        r = [s for s in r if s["stalled"]][:6] + r[-1:]
    for s in r:
        print("   ", s)
    return r
