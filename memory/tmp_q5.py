import subprocess
def patch(p, pairs):
    s = open(p).read()
    for a, b in pairs:
        assert a in s, (p, a[:90]); s = s.replace(a, b, 1)
    open(p, 'w').write(s)
B = '/app/backend/'
F = '/app/frontend/src/'
# duel: finished matches stay visible to each player until they leave
patch(B + 'duel_live.py', [
    ('    return await db.live_duels.find_one({"players.id": uid, "state": {"$ne": "done"}, "end": {"$gt": _iso(_now() - timedelta(seconds=30))}})',
     '    return await db.live_duels.find_one({"players": {"$elemMatch": {"id": uid, "left": {"$ne": True}}}, "end": {"$gt": _iso(_now() - timedelta(seconds=300))}})'),
    ('''    if m and m.get("paid"):
        await db.live_duels.update_one({"id": m["id"]}, {"$set": {"state": "done"}})''', '''    if m and _now() >= datetime.fromisoformat(m["end"]):
        await _settle(m)
        await db.live_duels.update_one({"id": m["id"], "players.id": uid}, {"$set": {"players.$.left": True}})'''),
])
# Tackle Box -> Inventory
patch(F + 'world/World.js', [('inventory: ["Tackle Box", "inventory"]', 'inventory: ["Inventory", "inventory"]'),
    ('  useEffect(() => {\n    const on = (e) => { goTo(e.detail); nav("/game", { replace: true }); };', '  useEffect(() => {\n    const op = (e) => nav(`/game/profile/${encodeURIComponent(e.detail)}`);\n    window.addEventListener("fr-profile", op);\n    return () => window.removeEventListener("fr-profile", op);\n  }, [nav]);\n  useEffect(() => {\n    const on = (e) => { goTo(e.detail); nav("/game", { replace: true }); };')])
# tap another angler to open their profile
patch(F + 'game/Scene.js', [('''  c.addChild(f.c, name, status, bubble);
  c.x = p.x; c.y = p.y;''', '''  c.addChild(f.c, name, status, bubble);
  c.x = p.x; c.y = p.y;
  c.eventMode = "static"; c.cursor = "pointer";
  c.hitArea = new Rectangle(-40, -ANGLER_H, 80, ANGLER_H + 10);
  c.on("pointertap", (e) => { e.stopPropagation(); window.dispatchEvent(new CustomEvent("fr-profile", { detail: p.username })); });''')])
# rename the game everywhere
subprocess.run("grep -rlE 'Fishing Realms|Fishing Realm\\b' /app/frontend/src /app/frontend/public/index.html /app/backend --include=*.js --include=*.html --include=*.py | xargs -r sed -i -E 's/Fishing Realms/FishyLand/g; s/Fishing Realm\\b/FishyLand/g'", shell=True)
print('ok')
