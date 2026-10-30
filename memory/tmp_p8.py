def patch(p, pairs):
    s = open(p).read()
    for a, b in pairs:
        assert a in s, (p, a[:90]); s = s.replace(a, b, 1)
    open(p, 'w').write(s)
F = '/app/frontend/src/'
s = open(F + 'world/World.js').read()
s = s.replace('sceneFor(fx.mode === "harbour" ? "harbour" : user?.water || "millbrook")', 'sceneFor(placeOf(fx.mode, user))')
s = s.replace('sceneFor(m === "harbour" ? "harbour" : user?.water || "millbrook")', 'sceneFor(placeOf(m, user))')
s = s.replace('const here = usePresence(mode === "harbour" ? "harbour" : user?.water || "harbour");', 'const here = usePresence(placeOf(mode, user));')
s = s.replace('const nearSpot = sceneFor(mode === "harbour" ? "harbour" : user?.water || "millbrook")', 'const nearSpot = sceneFor(placeOf(mode, user))')
s = s.replace('<Scene place={mode === "harbour" ? "harbour" : user.water || "millbrook"} />', '<Scene place={placeOf(mode, user)} />')
s = s.replace('place={mode === "harbour" ? "The Harbour" : water?.name}', 'place={mode === "harbour" ? "The Harbour" : mode === "crew" ? `${user.crew?.name || "Crew"} Island` : water?.name}')
s = s.replace('const BAR_R_WATER = ["quests", "profile"];', 'const BAR_R_WATER = ["quests", "profile"];\nconst placeOf = (m, user) => (m === "harbour" ? "harbour" : m === "crew" ? "crew_island" : user?.water || "millbrook");')
s = s.replace('''    if (mode === "water" && page && HARBOUR_ONLY.has(page)) { toast("That's in the harbour. Sail back to visit it."); nav("/game", { replace: true }); }''', '''    if (mode !== "harbour" && page && HARBOUR_ONLY.has(page) && !(mode === "crew" && page === "crews")) { toast("That's in the harbour. Sail back to visit it.", { id: "harbour-only" }); nav("/game", { replace: true }); }''')
s = s.replace('      else if (id === "harbour") goTo("harbour");', '      else if (id === "harbour") goTo("harbour");\n      else if (id === "crew-pond") toast("The crew pond has no fish yet. Your crew can stock it soon.", { id: "crew-pond" });')
s = s.replace('{(mode === "water" ? BAR_R_WATER : BAR_R).map((k) =>', '{(mode !== "harbour" ? BAR_R_WATER : BAR_R).map((k) =>')
s = s.replace('.filter((k) => mode !== "water" || !HARBOUR_ONLY.has(k))', '.filter((k) => mode === "harbour" || !HARBOUR_ONLY.has(k))')
# leaping fish art = species that live in this water
s = s.replace('  const here = usePresence(placeOf(mode, user));', '''  const here = usePresence(placeOf(mode, user));
  useEffect(() => { fx.leapArt = mode === "water" && data ? data.fish.filter((f) => f.water === user?.water).map((f) => fishArt(f.rarity, f.species_id ?? f.id)) : []; }, [mode, data, user?.water]);''')
if 'fishArt' not in s.split('export default')[0].split('\n', 30)[-1] and 'import { fishArt }' not in s:
    s = s.replace('import CatchCard from "./CatchCard";', 'import CatchCard from "./CatchCard";\nimport { fishArt } from "./useFight";')
open(F + 'world/World.js', 'w').write(s)
print('world ok')
