# Building wall-penetration sweep (exec after collide_helpers): pushes the angler at each building from many sides
# and measures how much of the angler's body rect is covered by the building sprite while he is drawn behind it.
MASK_JS = """async (o)=>{
  window.__bm = window.__bm || {};
  const key = o.k+'_'+o.x+'_'+o.y;
  if (!window.__bm[key]) {
    const img = await new Promise((res,rej)=>{const i=new Image(); i.onload=()=>res(i); i.onerror=rej; i.src='/art/map/'+o.k+'.webp';});
    const w=o.w, h=Math.round(img.height*w/img.width);
    const c=document.createElement('canvas'); c.width=w; c.height=h; const g=c.getContext('2d');
    if (o.flip){g.translate(w,0); g.scale(-1,1);} g.drawImage(img,0,0,w,h);
    const a=g.getImageData(0,0,w,h).data;
    // footColumns replica (N=48)
    const N=48,H=Math.max(8,Math.round(N*img.height/img.width)),c2=document.createElement('canvas');c2.width=N;c2.height=H;
    const g2=c2.getContext('2d');g2.drawImage(img,0,0,N,H);const b=g2.getImageData(0,0,N,H).data;const cols=[];
    for(let x=0;x<N;x++){let y=H-1;while(y>=0&&b[(y*N+x)*4+3]<140)y--;let t=0;while(t<H&&b[(t*N+x)*4+3]<140)t++;
      if(y<0)continue;const up=(H-1-y)/H,top=(H-t)/H;if(up*h>w*0.22)continue;const fx=(x+0.5)/N-0.5;
      cols.push({x:o.x+(o.flip?-fx:fx)*w,y:o.y-up*h,tall:(top-up)*h});}
    const ys=cols.map(c=>c.y).sort((p,q)=>p-q);const sortY=cols.length>4?ys[Math.floor(ys.length/2)]:o.y;
    const xs=cols.map(c=>c.x);
    window.__bm[key]={w,h,a:Array.from(a.filter((_,i)=>i%4==3)),sortY,x0:Math.min(...xs),x1:Math.max(...xs),tall:Math.max(...cols.map(c=>c.tall)),base:Math.max(...ys)};
  }
  const m=window.__bm[key];
  return {sortY:m.sortY,x0:m.x0,x1:m.x1,tall:m.tall,base:m.base,h:m.h};
}"""

COVER_JS = """(q)=>{const m=window.__bm[q.key];const o=q.o;let n=0,hit=0;
  for(let yy=q.y-165;yy<q.y-15;yy+=5)for(let xx=q.x-26;xx<=q.x+26;xx+=4){n++;
    const lx=Math.round(xx-(o.x-m.w/2)),ly=Math.round(yy-(o.y-m.h));
    if(lx>=0&&ly>=0&&lx<m.w&&ly<m.h&&m.a[ly*m.w+lx]>140)hit++;}
  return hit/n;}"""


async def push2(page, x, y, keys, ms=2400):
    await page.evaluate(f"()=>{{__fx.dest=null; __fx.path=[]; __fx.me.x={x}; __fx.me.y={y};}}")
    await page.wait_for_timeout(150)
    for k in keys: await page.keyboard.down(k)
    await page.wait_for_timeout(ms)
    for k in keys: await page.keyboard.up(k)
    await page.wait_for_timeout(150)
    return await page.evaluate("()=>({x:Math.round(__fx.me.x),y:Math.round(__fx.me.y)})")


async def sweep(page, name, o, ms=2400):
    o = {"flip": False, **o}
    m = await page.evaluate(MASK_JS, o)
    key = f"{o['k']}_{o['x']}_{o['y']}"
    x0, x1, base, T, sy = m["x0"], m["x1"], m["base"], m["tall"], m["sortY"]
    starts = []
    for f in [0.0, 0.25, 0.45, 0.65, 0.85, 1.05]:
        yy = base + 30 - f * T
        starts.append(((x0 - 70, yy), ["d"], f"L{f}"))
        starts.append(((x1 + 70, yy), ["a"], f"R{f}"))
    for f in [0.05, 0.3, 0.5, 0.7, 0.95]:
        xx = x0 + f * (x1 - x0)
        starts.append(((xx, base + 80), ["w"], f"F{f}"))
        starts.append(((xx, base - T - 60), ["s"], f"B{f}"))
    starts += [((x0 - 70, base + 70), ["w", "d"], "FL-diag"), ((x1 + 70, base + 70), ["w", "a"], "FR-diag"),
               ((x0 - 70, base - T - 50), ["s", "d"], "BL-diag"), ((x1 + 70, base - T - 50), ["s", "a"], "BR-diag")]
    bad, allres = [], []
    for (sx, syy), keys, tag in starts:
        p = await push2(page, round(sx), round(syy), keys, ms)
        if abs(p["x"] - sx) < 2 and abs(p["y"] - syy) < 2:
            continue  # start point not walkable / no movement
        behind = p["y"] < sy - 2
        cov = await page.evaluate(COVER_JS, {"key": key, "o": o, "x": p["x"], "y": p["y"]}) if behind else 0
        inband = (x0 - 4 < p["x"] < x1 + 4) and (base - 0.78 * T < p["y"] < base)
        allres.append(f"{tag}:{p['x']},{p['y']}{'b' if behind else ''}{round(cov,2) if cov else ''}")
        if (behind and cov > 0.12) or inband:
            bad.append((tag, p, round(cov, 2), "INBAND" if inband else ""))
    print(f"[{name}] x0={round(x0)} x1={round(x1)} base={round(base)} sortY={round(sy)} tall={round(T)} -> flagged={bad}")
    print("   all:", " | ".join(allres))
    return bad


async def front_scan(page, name, o, step=20, ms=2000):
    # walk straight up at many x along the building's front; report spots where the angler ends up drawn behind the walls
    o = {"flip": False, **o}
    m = await page.evaluate(MASK_JS, o)
    key = f"{o['k']}_{o['x']}_{o['y']}"
    out = []
    x = m["x0"] - 30
    while x <= m["x1"] + 30:
        p = await push2(page, round(x), round(m["base"] + 80), ["w"], ms)
        behind = p["y"] < m["sortY"] - 2
        cov = await page.evaluate(COVER_JS, {"key": key, "o": o, "x": p["x"], "y": p["y"]}) if behind else 0
        if behind and cov > 0.15:
            out.append((p["x"], p["y"], round(cov, 2)))
        x += step
    print(f"[front {name}] sortY={round(m['sortY'])} base={round(m['base'])} covered_spots={out}")
    return out
