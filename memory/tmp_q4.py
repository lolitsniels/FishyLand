p='/app/frontend/src/pages/Landing.js'; s=open(p).read()
a=s.index('const FISH_ART = [') if 'const FISH_ART = [' in s else s.index('function CatchTicker(')
b=s.index('export default function Landing()')
s=s[:a]+'''const SHOTS = [["harbour", "Walk the harbour with other anglers"], ["river", "Fish rivers, ponds and the open sea"], ["map", "Sail to new waters"], ["shop", "Upgrade your tackle"]];

'''+s[b:]
a=s.index('  return (\n    <div className="min-h-screen relative overflow-x-hidden text-amber-50" data-testid="welcome-page">')
s=s[:a]+'''  return (
    <div className="fl-home" data-testid="welcome-page">
      <header className="fl-top" data-testid="lp-topbar">
        <img src="/art/hud/logo_fishyland.webp" alt="FishyLand" className="fl-logo-sm" />
        <div className="flex items-center gap-3">
          {stats && <span className="fl-online" data-testid="lp-online"><i />{fmt(stats.online)} online</span>}
          {user ? <button type="button" className="btn btn-gold" onClick={go} data-testid="lp-continue">Play</button>
            : <button type="button" className="btn" onClick={() => setShowLogin(true)} data-testid="lp-login-toggle"><LogIn size={14} className="inline -mt-0.5 mr-1" />Log in</button>}
        </div>
      </header>
      <main className="fl-main">
        <div className="fl-mascot-row">
          <img src="/art/hud/mascot.webp" alt="The Harbourmaster" className="fl-mascot" data-testid="lp-mascot" />
          <div className="fl-bubble">Ahoy! Grab a rod, pick your angler and come fish with us. It's free, right in your browser.</div>
        </div>
        <img src="/art/hud/logo_fishyland.webp" alt="FishyLand" className="fl-logo" data-testid="lp-logo" />
        <div className="fl-grid">
          <section className="panel fl-card" data-testid="lp-board">
            <h2 className="fl-h">{user ? "Ready to cast?" : "Sign up now!"}</h2>
            {user ? (
              <div className="flex flex-col items-center gap-3 text-center" data-testid="lp-welcome-back">
                <div className="text-lg font-bold">Welcome back, {user.username}</div>
                <button type="button" className="btn btn-gold" onClick={go} data-testid="lp-continue-big">Back to the harbour</button>
              </div>
            ) : <SignupBox go={go} />}
          </section>
          <section className="fl-shots" data-testid="lp-shots">
            {SHOTS.map(([k, t]) => (
              <figure key={k} className="fl-shot" data-testid={`lp-shot-${k}`}><img src={`/art/shots/${k}.jpg`} alt={t} loading="lazy" /><figcaption>{t}</figcaption></figure>
            ))}
          </section>
        </div>
      </main>
      <footer className="fl-foot" data-testid="lp-footer">
        <span>© FishyLand</span>
        <Link to="/privacy" data-testid="wl-footer-privacy">Privacy</Link>
        <Link to="/terms" data-testid="wl-footer-terms">Terms</Link>
        <Link to="/wiki" data-testid="wl-footer-wiki">Wiki</Link>
      </footer>
      {showLogin && !user && (
        <div className="fixed inset-0 z-50 grid place-items-center bg-black/60" onClick={(e) => e.target === e.currentTarget && setShowLogin(false)} data-testid="lp-login-modal">
          <div className="panel fl-login"><h2 className="fl-h">Log in</h2><LoginBox onDone={go} /></div>
        </div>
      )}
    </div>
  );
}
'''
s=s.replace('<form onSubmit={submit} className="fr-panel absolute right-0 top-12 w-72 p-4 flex flex-col gap-3 z-30 rise" data-testid="lp-login-form">','<form onSubmit={submit} className="flex flex-col gap-3" data-testid="lp-login-form">')
s=s.replace('  const [shot, setShot] = useState(null);\n','').replace('  const [catches, setCatches] = useState([]);\n','').replace('  const [news, setNews] = useState([]);\n','')
s=s.replace('    api.get("/news/landing-catches").then((r) => setCatches(Array.isArray(r.data) ? r.data : [])).catch(() => {});\n','').replace('    api.get("/news/public").then((r) => setNews(r.data.items || [])).catch(() => {});\n','')
open(p,'w').write(s)
print('ok')
