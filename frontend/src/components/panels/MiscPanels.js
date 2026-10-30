import { useState } from "react";
import { Lock, Check } from "lucide-react";
import { toast } from "sonner";
import { useNavigate } from "react-router-dom";
import Modal from "./Modal";
import { useGame } from "../../store";
import { api, errMsg, tokens } from "../../lib/api";
import { t } from "../../i18n";
import { PORTAL } from "../../portal";
import { applyAudio } from "../../game/sfx";

export function WatersPanel() {
  const data = useGame((s) => s.data);
  const p = useGame((s) => s.player);
  return (
    <Modal title="World Map · Waters" testid="waters-modal">
      <div className="grid sm:grid-cols-2 gap-2">
        {data.waters.filter((w) => !PORTAL || w.playable).map((w, i) => {
          const current = w.id === "crystal_lagoon";
          return (
            <div key={w.id} className={`fr-chip !rounded px-3 py-2 flex items-center gap-2 ${current ? "!border-amber-300 shadow-[0_0_10px_#ffd34d]" : "opacity-80"}`} data-testid={`water-${w.id}`}>
              <span className="font-deco font-black text-amber-300 w-6">{i + 1}</span>
              <div className="flex-1">
                <div className="font-cinzel font-bold text-sm">{w.name}</div>
                <div className="text-[11px] text-amber-100/60">Unlock Lv {w.unlock} · Rec. BR {w.rec_br.toLocaleString()}</div>
              </div>
              {current ? <span className="text-emerald-300 text-xs flex items-center gap-1"><Check size={13} />Here</span>
                : <span className="text-amber-100/60 text-xs flex items-center gap-1"><Lock size={12} />{`Lv ${w.unlock}`}</span>}
            </div>
          );
        })}
      </div>
    </Modal>
  );
}

const Toggle = ({ label, k, testid }) => {
  const v = useGame((s) => s.settings[k]);
  const setS = useGame((s) => s.setSetting);
  const set = (key, val) => { setS(key, val); applyAudio(); };
  return (
    <label className="flex items-center justify-between fr-chip !rounded px-3 py-2 cursor-pointer">
      <span className="font-cinzel text-sm">{label}</span>
      <input type="checkbox" checked={v} onChange={(e) => set(k, e.target.checked)} data-testid={testid} className="w-4 h-4 accent-amber-400" />
    </label>
  );
};

export function SettingsPanel() {
  const nav = useNavigate();
  const logout = async () => { await api.post("/auth/logout").catch(() => {}); tokens.clear(); useGame.setState({ player: null, modal: null, result: null, system: [], phase: "idle" }); nav("/"); };
  return (
    <Modal title="Settings" width={420} testid="settings-modal">
      <div className="flex flex-col gap-2">
        <Toggle label="Sound effects" k="sound" testid="setting-sound" />
        <Toggle label="Music" k="music" testid="setting-music" />
        <Toggle label="Low graphics (no bloom / rays)" k="low" testid="setting-low-graphics" />
        <Toggle label="Show FPS" k="fps" testid="setting-show-fps" />
        <button type="button" className="fr-btn fr-btn-teal py-2 mt-2" onClick={() => useGame.setState({ modal: null, tutorialOpen: true })} data-testid="open-tutorial-btn">How to Play</button>
        {!PORTAL && <button type="button" className="fr-btn fr-btn-dark py-2" onClick={() => useGame.getState().openModal({ type: "account" })} data-testid="open-account-btn">Account</button>}
        {!PORTAL && <button type="button" className="fr-btn py-2" onClick={logout} data-testid="logout-btn">Log Out</button>}
      </div>
    </Modal>
  );
}

export function AccountPanel() {
  const p = useGame((s) => s.player);
  const setPlayer = useGame((s) => s.setPlayer);
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const claim = async (e) => {
    e.preventDefault();
    try { const { data } = await api.post("/auth/claim", { email, password }); setPlayer(data.player); toast.success("Account claimed! Your progress is safe."); }
    catch (err) { toast.error(errMsg(err)); }
  };
  return (
    <Modal title="Account" width={420} testid="account-modal">
      {p.is_guest ? (
        <form onSubmit={claim} className="flex flex-col gap-2">
          <p className="text-sm text-amber-100/80">You are playing as a guest. Claim your account to keep <b>{p.username}</b> forever.</p>
          <input className="fr-input" type="email" placeholder={t("email")} value={email} onChange={(e) => setEmail(e.target.value)} data-testid="claim-email-input" required />
          <input className="fr-input" type="password" placeholder={t("password")} value={password} onChange={(e) => setPassword(e.target.value)} data-testid="claim-password-input" minLength={6} required />
          <button className="fr-btn py-2" type="submit" data-testid="claim-submit-btn">Claim Account</button>
        </form>
      ) : (
        <div className="text-sm" data-testid="account-info">Signed in as <b className="text-amber-200">{p.username}</b> · {p.email}</div>
      )}
    </Modal>
  );
}

export function ComingSoon({ title, desc, phase }) {
  return (
    <Modal title={title} width={440} testid="coming-soon-modal">
      <div className="flex flex-col items-center text-center gap-3 py-2">
        <div className="font-deco text-2xl gold-text font-black">{t("comingSoon")}</div>
        <p className="text-sm text-amber-100/85">{desc}</p>
        <span className="fr-chip px-3 py-1 text-xs font-cinzel text-cyan-200" data-testid="coming-soon-phase">Build phase {phase}</span>
      </div>
    </Modal>
  );
}
