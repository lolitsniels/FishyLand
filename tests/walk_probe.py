# Exhaustive building-penetration probe (exec after collide_helpers): uses window.__walk + window.__objs (real sortY)
# Flood-fills walk cells reachable from the bbox border, then for every reachable cell whose feet are above the
# building's sortY (drawn behind) measures how much of the angler body rect (52x150) is covered by the opaque sprite.
# Each bad cell is classified: "roof" = feet at/above 70% of that column's visible height (normal back-side occlusion),
# "WALL" = feet inside the lower 70% of the building's visible height (= standing inside / in front of walls but drawn behind).
PROBE_JS = """async (q)=>{
  const objs = window.__objs.filter(o=>q.keys.includes(o.k));
  const S=6, out={};
  for (const o of objs){
    const img = await new Promise((res,rej)=>{const i=new Image(); i.onload=()=>res(i); i.onerror=rej; i.src='/art/map/'+o.k+'.webp';});
    const w=o.w, h=Math.round(img.height*w/img.width);
    const c=document.createElement('canvas'); c.width=w; c.height=h; const g=c.getContext('2d');
    if (o.flip){g.translate(w,0); g.scale(-1,1);} g.drawImage(img,0,0,w,h);
    const a=g.getImageData(0,0,w,h).data, L=o.x-w/2, T0=o.y-h;
    const colTop=[],colBot=[];
    for(let x=0;x<w;x++){let t=0;while(t<h&&a[(t*w+x)*4+3]<=140)t++;let b=h-1;while(b>=0&&a[(b*w+x)*4+3]<=140)b--;colTop.push(t);colBot.push(b);}
    const X0=L-160, X1=L+w+160, Y0=T0-200, Y1=o.y+160;
    const gw=Math.ceil((X1-X0)/S), gh=Math.ceil((Y1-Y0)/S), seen=new Uint8Array(gw*gh), st=[];
    for(let i=0;i<gw;i++)for(const j of [0,gh-1]) st.push([i,j]);
    for(let j=0;j<gh;j++)for(const i of [0,gw-1]) st.push([i,j]);
    while(st.length){const [i,j]=st.pop(); if(i<0||j<0||i>=gw||j>=gh)continue; const id=j*gw+i; if(seen[id])continue;
      if(!window.__walk(X0+i*S,Y0+j*S)){seen[id]=2;continue;} seen[id]=1; st.push([i+1,j],[i-1,j],[i,j+1],[i,j-1]);}
    const cover=(x,y)=>{let n=0,hit=0;for(let yy=y-165;yy<y-15;yy+=5)for(let xx=x-26;xx<=x+26;xx+=4){n++;
      const lx=Math.round(xx-L),ly=Math.round(yy-T0);if(lx>=0&&ly>=0&&lx<w&&ly<h&&a[(ly*w+lx)*4+3]>140)hit++;}return hit/n;};
    // building's main base / height for classification
    const bots=colBot.filter(b=>b>=0).sort((p,r)=>p-r), baseY=T0+bots[Math.floor(bots.length*0.5)], topY=T0+Math.min(...colTop);
    let wall=[], roof=0, maxc=0, isolated=0;
    for(let j=0;j<gh;j++)for(let i=0;i<gw;i++){const x=X0+i*S,y=Y0+j*S,id=j*gw+i;
      if(seen[id]===0 && window.__walk(x,y)) isolated++;
      if(seen[id]!==1 || y>=o.sortY-2)continue;
      const cv=cover(x,y); if(cv<=q.thr)continue; if(cv>maxc)maxc=cv;
      const frac=(baseY-y)/(baseY-topY);
      if(frac>=0.70) roof++; else wall.push([Math.round(x),Math.round(y),+cv.toFixed(2),+frac.toFixed(2)]);}
    wall.sort((p,r)=>r[2]-p[2]);
    const xs=wall.map(p=>p[0]), ys=wall.map(p=>p[1]);
    out[o.k+'@'+o.x+','+o.y]={w,h,sortY:Math.round(o.sortY),baseY:Math.round(baseY),topY:Math.round(topY),isolatedWalk:isolated,maxCover:+maxc.toFixed(2),
      roofOcclusionCells:roof,WALL_cells:wall.length,wallBox:wall.length?[Math.min(...xs),Math.max(...xs),Math.min(...ys),Math.max(...ys)]:null,wallTop:wall.slice(0,6)};
  }
  return out;
}"""
