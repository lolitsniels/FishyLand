# iteration 33: guild_hall/tavern walk pockets gone + front_scan re-run (exec inside browser_automation)
g = globals()
exec(open('/app/tests/collide_helpers.py').read(), g)
exec(open('/app/tests/building_sweep.py').read(), g)
await page.set_viewport_size({"width": 1920, "height": 1080})
await boot(page)
objs = await page.evaluate("()=>__objs.filter(o=>['guild_hall','tavern','tackle_shop','market_stall','pearl_shop'].includes(o.k))")
print("OBJS", objs)
pockets = await page.evaluate("""()=>{const r={};const z=(n,x0,x1,y0,y1)=>{let c=0,t=0,s=[];for(let x=x0;x<=x1;x+=4)for(let y=y0;y<=y1;y+=4){t++;if(__walk(x,y)){c++;if(s.length<6)s.push([x,y]);}}r[n]={walk:c,total:t,sample:s};};
 z('guild_left',1780,1850,872,908);z('guild_right',2120,2190,884,908);z('tavern_fl',702,750,1554,1566);
 r.p1=__walk(1827,869);r.p2=__walk(748,1564);r.pave_guild=__walk(1825,1000);r.pave_tav=__walk(740,1660);return r;}""")
print("POCKETS", pockets)
# also: any walkable cell above sortY within x-extent of each building, near the base (sortY-60..sortY-2)
for o in objs:
    r = await page.evaluate("""(o)=>{const w=o.w;let c=[];for(let x=Math.round(o.x-w*0.45);x<=o.x+w*0.45;x+=6)for(let y=Math.round(o.sortY-60);y<o.sortY-2;y+=4)if(__walk(x,y))c.push([x,y]);return {n:c.length,s:c.slice(0,10)};}""", o)
    print("ABOVE_SORTY", o["k"], o["x"], o["y"], r)
for o in objs:
    if o["k"] in ("guild_hall", "tavern", "tackle_shop", "market_stall"):
        try:
            await front_scan(page, o["k"], {"k": o["k"], "x": o["x"], "y": o["y"], "w": o["w"], "flip": o["flip"]}, step=20, ms=1800)
        except Exception as e:
            print("front_scan err", o["k"], str(e)[:120])
# walk-up from pavement into former pockets
for (sx, sy, nm) in [(1825, 1000, "guild_left"), (2150, 1000, "guild_right"), (725, 1660, "tavern_fl")]:
    p = await push2(page, sx, sy, ["w"], 2500)
    print("WALKUP", nm, p)
# alley tackle/market
for y in [770, 780, 790]:
    p = await push2(page, 1300, y, ["d"], 2000)
    print("ALLEY", y, p)
