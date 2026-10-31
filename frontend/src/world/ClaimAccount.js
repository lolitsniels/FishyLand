import { useState } from "react";
import { toast } from "sonner";
import { api, errMsg } from "../tfl/lib/api";
import { useGame as useTfl } from "../tfl/context/GameContext";
import { ls } from "../offline/bridge";

// Guests turn their angler into a full account (name + password) and get a one-time welcome gift.
export function ClaimAccount() {
  const { user, login } = useTfl();
  const [f, setF] = useState({ username: "", password: "", email: "" });
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState("");
  if (!user?.is_guest) return null;
  const set = (k) => (e) => setF({ ...f, [k]: e.target.value });
  const submit = async (e) => {
    e.preventDefault(); setBusy(true); setErr("");
    try {
      const r = await api.post("/auth/complete-signup", { username: f.username.trim(), password: f.password, ...(f.email.trim() ? { email: f.email.trim() } : {}), source: ls.getItem("owo_source") || undefined });
      login(r.data);
      toast.success(r.data.reward ? `Account claimed! +${r.data.reward.gold} gold and +${r.data.reward.pearls} Pearls` : "Account claimed!");
    } catch (ex) { setErr(errMsg(ex)); } finally { setBusy(false); }
  };
  return (
    <form onSubmit={submit} className="panel p-3 mb-2 flex flex-col gap-2" data-testid="claim-account-form">
      <div className="font-cinzel font-bold text-amber-200 text-sm">Claim your account</div>
      <p className="text-[12.5px] text-[#f4ead2]">You're playing as a guest. Pick a name and password to keep your angler on any device and get <b className="text-amber-300">500 gold and 25 Pearls</b>.</p>
      <input className="fl-input" placeholder="Angler name (3-16 letters, numbers or _)" value={f.username} onChange={set("username")} autoComplete="username" data-testid="claim-username" />
      <input className="fl-input" type="password" placeholder="Password" value={f.password} onChange={set("password")} autoComplete="new-password" data-testid="claim-password" />
      <input className="fl-input" type="email" placeholder="Email (optional, for password resets)" value={f.email} onChange={set("email")} autoComplete="email" data-testid="claim-email" />
      {err && <div className="text-red-300 text-xs" data-testid="claim-error">{err}</div>}
      <button className="fr-btn py-2" disabled={busy || f.username.trim().length < 3 || f.password.length < 4} data-testid="claim-submit">{busy ? "Saving..." : "Claim account and gift"}</button>
    </form>
  );
}
