# sweep helper: walk up (front) / down (back) at many x across a building and record where the angler stops
SWEEP_JS = """async ([bx, by, w, depth, dir, step]) => {
  const out = [], sleep = (t) => new Promise(r => setTimeout(r, t));
  for (let x = bx - w * 0.5; x <= bx + w * 0.5; x += step) {
    __fx.dest = null; __fx.path = []; __fx.keys.clear();
    __fx.me.x = x; __fx.me.y = dir === 'up' ? by + 90 : by - depth - 160;
    await sleep(120);
    __fx.keys.add(dir); await sleep(dir === 'up' ? 1500 : 1300); __fx.keys.clear(); await sleep(80);
    out.push([Math.round(x), Math.round(__fx.me.x), Math.round(__fx.me.y)]);
  }
  return out;
}"""

async def sweep(page, name, bx, by, w, fh, dir="up", step=24):
    r = await page.evaluate(SWEEP_JS, [bx, by, w, w * fh, dir, step])
    # front: a stop well above the base line means the angler got into the walls
    if dir == "up":
        deep = [p for p in r if p[2] < by - 40 and abs(p[1] - bx) < w * 0.42]
    else:
        deep = [p for p in r if p[2] > by - w * fh * 0.6 and abs(p[1] - bx) < w * 0.42]
    print(name, dir, "stops:", [p[2] for p in r])
    print("   DEEP:", deep)
    return deep
