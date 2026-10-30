def patch(p, pairs):
    s = open(p).read()
    for a, b in pairs:
        assert a in s, (p, a[:80]); s = s.replace(a, b, 1)
    open(p, 'w').write(s)
F = '/app/frontend/'
patch(F + 'src/world/World.js', [
    ('''    <div className="pcard pointer-events-auto" data-testid="player-panel">
      <div className="pcard-face"><img src={lookFace(u.avatar)} alt="" data-testid="player-portrait" /></div>
      <span className="pcard-lv" data-testid="player-level">Lv.{u.level}</span>
      <div className="pcard-name" data-testid="player-name">{u.username}</div>
      <div className="pcard-place" data-testid="location-chip">{place} · <Users size={10} className="inline -mt-0.5" /> <span data-testid="here-count">{here}</span></div>
      <div className="pcard-under">
        <div className="pcard-chips">
          <span data-testid="gold-value"><Coins size={12} color="#ffd34d" />{(u.gold ?? 0).toLocaleString()}</span>
          <span title="Pearls are earned in game and only buy cosmetics" data-testid="pearls-value"><Gem size={12} color="#bff4ff" />{(u.pearls ?? 0).toLocaleString()}</span>
          <span data-testid="energy-value"><Zap size={11} color="#7ff3ff" />{Math.floor(u.energy)}/{u.max_energy}</span>
        </div>
        <Bar value={u.energy} max={u.max_energy} testid="energy-bar" />
        <Bar value={u.xp_into_level ?? 0} max={u.xp_next || 1} color="linear-gradient(90deg,#b44dff,#ff8af0)" testid="xp-bar" />
      </div>
    </div>''', '''    <div className="pcard pointer-events-auto" data-testid="player-panel">
      <div className="pcard-face"><img src={lookFace(u.avatar)} alt="" data-testid="player-portrait" /></div>
      <span className="pcard-lv" data-testid="player-level">{u.level}</span>
      <div className="pcard-name" data-testid="player-name">{u.username}</div>
      <div className="pcard-place" data-testid="location-chip">{place} · <Users size={10} className="inline -mt-0.5" /> <span data-testid="here-count">{here}</span></div>
      <div className="pcard-bars" title={`Energy ${Math.floor(u.energy)}/${u.max_energy}`}>
        <div className="pcard-bar"><i style={{ width: `${Math.min(100, (u.energy / u.max_energy) * 100)}%` }} data-testid="energy-bar" /><span data-testid="energy-value">{Math.floor(u.energy)}/{u.max_energy}</span></div>
        <div className="pcard-bar xp"><i style={{ width: `${Math.min(100, ((u.xp_into_level ?? 0) / (u.xp_next || 1)) * 100)}%` }} data-testid="xp-bar" /></div>
      </div>
      <Coins size={15} color="#ffd34d" className="pcard-ic gold" /><b className="pcard-v gold" data-testid="gold-value">{compact(u.gold)}</b>
      <Gem size={14} color="#bff4ff" className="pcard-ic pearl" /><b className="pcard-v pearl" title="Pearls are earned in game and only buy cosmetics" data-testid="pearls-value">{compact(u.pearls)}</b>
    </div>'''),
    ('function TopBar(', 'const compact = (n = 0) => (n >= 1e6 ? `${(n / 1e6).toFixed(n >= 1e7 ? 0 : 1)}M` : n >= 1e4 ? `${Math.floor(n / 1e3)}K` : (n || 0).toLocaleString());\n\nfunction TopBar('),
])
patch(F + 'src/game/tilemap.js', [
    ('''    const rx = Math.max(16, (w * fw) / 2), ry = Math.max(14, (w * fh) / 2);
    g.beginPath(); g.ellipse(o.x, o.y - ry, rx, ry, 0, 0, 7); g.fill();''', '''    const rx = Math.max(16, (w * fw) / 2), ry = Math.max(14, (w * fh) / 2);
    if (def.rect) g.fillRect(o.x - rx, o.y - 2 * ry, 2 * rx, 2 * ry + 6);
    else { g.beginPath(); g.ellipse(o.x, o.y - ry, rx, ry, 0, 0, 7); g.fill(); }'''),
    ('''    for (const [px, py] of d.posts || []) { ctx.beginPath(); ctx.arc(px, py, 13, 0, 7); ctx.fill(); ctx.strokeStyle = "#2a180a"; ctx.lineWidth = 3; ctx.stroke(); ctx.fillStyle = "#6b4523"; ctx.beginPath(); ctx.arc(px - 3, py - 3, 6, 0, 7); ctx.fill(); ctx.fillStyle = "#4a2e16"; }''',
     '''    for (const [px, py] of d.posts || []) ctx.drawImage(img.post, px - 22, py - 40, 44, 65);'''),
    ('''    for (let x = -10; x <= L + 30; x += 70) for (const y of [-hw - 2, hw + 2]) { ctx.beginPath(); ctx.arc(x, y, 9, 0, 7); ctx.fillStyle = "#5a3a1c"; ctx.fill(); ctx.strokeStyle = "#2a180a"; ctx.lineWidth = 3; ctx.stroke(); }
    ctx.restore();''', '''    ctx.restore();
    for (let d = -10; d <= L + 30; d += 80) for (const side of [-1, 1]) {
      const px = ax + Math.cos(ang) * d - Math.sin(ang) * side * (hw + 2), py = ay + Math.sin(ang) * d + Math.cos(ang) * side * (hw + 2);
      ctx.drawImage(img.post, px - 16, py - 34, 32, 47);
    }'''),
])
s = open(F + 'src/game/tilemap.js').read()
for k in ["tackle_shop", "tavern", "guild_hall", "pearl_shop", "market_stall", "bait_hut", "house"]:
    s = s.replace(f"  {k}: {{ w:", f"  {k}: {{ rect: true, w:", 1)
s = s.replace("  fountain: { w: 270, fp: [0.94, 0.5]", "  fountain: { w: 270, fp: [0.94, 0.5], rect: true")
s = s.replace("  quest_board: { w: 150, fp: [0.8, 0.12] }", "  quest_board: { w: 150, fp: [0.9, 0.16], rect: true }")
s = s.replace("  barrels: { w: 130, fp: [0.9, 0.36] }", "  barrels: { w: 130, fp: [0.9, 0.42], rect: true }")
open(F + 'src/game/tilemap.js', 'w').write(s)
patch(F + 'src/game/Scene.js', [('const TEX_KEYS = ["grass", "sand", "dirt", "planks", "cobble", "water", "river"];', 'const TEX_KEYS = ["grass", "sand", "dirt", "planks", "cobble", "water", "river", "post"];')])
print('ok')
