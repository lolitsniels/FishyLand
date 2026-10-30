S = "/app/frontend/src/"


def edit(p, pairs):
    s = open(S + p).read()
    for a, b in pairs:
        assert a in s, (p, a[:70])
        s = s.replace(a, b)
    open(S + p, "w").write(s)


edit('pages/Landing.js', [
    ('import { createGuest } from "../tfl/lib/guest";', 'import { createGuest } from "../tfl/lib/guest";\nimport { CharacterPicker } from "../world/CharacterPicker";\nimport { DEFAULT_LOOK } from "../game/look";'),
    ('  const { login, data } = useGame();\n  const [f, setF] = useState({ username: "", password: "", email: "" });', '  const { login } = useGame();\n  const [f, setF] = useState({ username: "", password: "", email: "" });\n  const [look, setLook] = useState(DEFAULT_LOOK);'),
    ('''    const starters = (data?.avatars || []).filter((a) => a.price === 0);
    const body = { username: f.username.trim(), password: f.password, ...(f.email.trim() ? { email: f.email.trim() } : {}), ...(starters.length ? { avatar: starters[Math.floor(Math.random() * starters.length)].id } : {}) };''',
     '''    const body = { username: f.username.trim(), password: f.password, avatar: look, ...(f.email.trim() ? { email: f.email.trim() } : {}) };'''),
    ('''    <form onSubmit={register} className="flex flex-col gap-3" data-testid="lp-signup-form">
''', '''    <form onSubmit={register} className="flex flex-col gap-3" data-testid="lp-signup-form">
      <CharacterPicker value={look} onChange={setLook} testid="lp-char" />
'''),
])
edit('world/World.js', [
    ('import CatchCard from "./CatchCard";', 'import CatchCard from "./CatchCard";\nimport { lookFace } from "../game/look";'),
    ('''        <img src="art/angler.png" alt="" className="w-[150%] max-w-none -ml-[12%]" />''', '''        <img src={lookFace(u.avatar)} alt="" className="w-full h-full object-cover" data-testid="player-portrait" />'''),
    ('  useEffect(() => { fx.username = user?.username || ""; fx.title = user?.active_title || ""; }, [user]);', '  useEffect(() => { fx.username = user?.username || ""; fx.title = user?.active_title || ""; fx.look = user?.avatar; fx.rod = user?.gear?.rod || "rod_cane"; }, [user]);'),
])
s = open(S + 'tfl/game-skin.css').read() + '\n.g-portrait.g-face img { width: 100%; height: 100%; margin: 0; object-fit: cover; }\n'
open(S + 'tfl/game-skin.css', 'w').write(s)
edit('tfl/pages/game/Inventory.js', [('<div className="g-portrait !w-[86px] !h-[86px] hidden sm:block"><img src="/art/angler.png" alt="" /></div>', '<div className="g-portrait g-face !w-[86px] !h-[86px] hidden sm:block"><img src={lookFace(user.avatar)} alt="" /></div>'),
                                     ('import { GameTabs, Slot, tierRarity } from "../../components/GameUI";', 'import { GameTabs, Slot, tierRarity } from "../../components/GameUI";\nimport { lookFace } from "../../../game/look";')])
print("ok")
