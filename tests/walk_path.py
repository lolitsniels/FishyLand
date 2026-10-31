# BFS a walk path (via window.__walk) from a start cell to a target and feed it to the game's own walker (fx.path)
PATH_JS = """(q)=>{const S=6,[sx,sy]=q.from,[tx,ty]=q.to;const X0=Math.min(sx,tx)-400,Y0=Math.min(sy,ty)-400,gw=Math.ceil((Math.abs(sx-tx)+800)/S),gh=Math.ceil((Math.abs(sy-ty)+800)/S);
 const prev=new Int32Array(gw*gh).fill(-2);const ci=(x,y)=>Math.round((y-Y0)/S)*gw+Math.round((x-X0)/S);
 const s=ci(sx,sy),t=ci(tx,ty);const qu=[s];prev[s]=-1;
 while(qu.length){const c=qu.shift();if(c===t)break;const i=c%gw,j=(c/gw)|0;for(const[di,dj]of[[1,0],[-1,0],[0,1],[0,-1]]){const ni=i+di,nj=j+dj;if(ni<0||nj<0||ni>=gw||nj>=gh)continue;const n=nj*gw+ni;if(prev[n]!==-2)continue;if(!window.__walk(X0+ni*S,Y0+nj*S))continue;prev[n]=c;qu.push(n);}}
 if(prev[t]===-2)return null;const pts=[];for(let c=t;c!==-1;c=prev[c])pts.push({x:X0+(c%gw)*S,y:Y0+((c/gw)|0)*S});pts.reverse();
 const path=pts.filter((_,k)=>k%3===0||k===pts.length-1);return path;}"""

async def walk_to(page, frm, to, wait=9000):
    path = await page.evaluate(PATH_JS, {"from": frm, "to": to})
    if not path:
        print("NO PATH", frm, "->", to); return None
    await page.evaluate(f"()=>{{__fx.me.x={frm[0]};__fx.me.y={frm[1]};}}")
    await page.wait_for_timeout(200)
    await page.evaluate("(p)=>{__fx.path=p.slice(1);__fx.dest=p[0];}", path)
    await page.wait_for_timeout(wait)
    pos = await page.evaluate("()=>({x:Math.round(__fx.me.x),y:Math.round(__fx.me.y)})")
    print("WALKED", frm, "->", to, "steps", len(path), "end", pos)
    return pos
