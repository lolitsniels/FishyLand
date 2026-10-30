/*
 * The Fishing Lands. Copyright © 2026. All rights reserved.
 * This source code is proprietary and confidential. Unauthorized copying, reproduction,
 * modification, distribution or use of this file, in whole or in part, via any medium,
 * is strictly prohibited without prior written permission from the owner.
 */
import { useState } from "react";
import { toast } from "sonner";
import { api, errMsg } from "../../lib/api";
import { useGame } from "../../context/GameContext";
import { Panel } from "../ui-bits";

const EMPTY = { gold: "", xp: "", pearls: "", level: "", energy: "", pass_days: "", pass_items: "", bait_id: "", bait_qty: "", gear_id: "", water: "", species_id: "", weight: "", variant: "normal", crate_id: "", crate_qty: "" };
const CRATES = [["crate_bronze", "Bronze Crate"], ["crate_silver", "Silver Crate"], ["crate_gold", "Gold Crate"]];

const GiveTake = ({ value, onChange, testId }) => (
  <div className="inline-flex border border-[var(--border)] mb-1" data-testid={testId}>
    {[["give", "Give"], ["take", "Take"]].map(([k, l]) => <button key={k} type="button" className={`px-2 py-0.5 text-[10.5px] uppercase tracking-wider ${value === k ? (k === "take" ? "bg-[#5a2420] text-[#ffd2c8]" : "bg-[var(--gold-dim)] text-[#1a1410]") : "text-[var(--muted)]"}`} onClick={() => onChange(k)} data-testid={`${testId}-${k}`}>{l}</button>)}
  </div>
);

export function GrantPanel({ target, onChanged }) {
  const { user, data, refresh } = useGame();
  const [form, setForm] = useState(EMPTY);
  const [mode, setMode] = useState({ gold: "give", pearls: "give", crate: "give" });
  const setM = (k) => (v) => setMode({ ...mode, [k]: v });
  const [fishQ, setFishQ] = useState("");
  const set = (k) => (e) => setForm({ ...form, [k]: e.target.value });
  const grant = async () => {
    const body = { username: target.username, variant: form.variant };
    ["gold", "xp", "pearls", "level", "energy", "bait_qty", "species_id", "pass_days", "pass_items", "crate_qty"].forEach((k) => { if (form[k] !== "") body[k] = Number(form[k]); });
    ["gold", "pearls"].forEach((k) => { if (body[k]) body[k] = Math.abs(body[k]) * (mode[k] === "take" ? -1 : 1); });
    if (form.crate_id && body.crate_qty) { body.crate_id = form.crate_id; body.crate_qty = Math.abs(body.crate_qty) * (mode.crate === "take" ? -1 : 1); } else delete body.crate_qty;
    if (form.weight !== "") body.weight = Number(form.weight);
    ["bait_id", "gear_id", "water"].forEach((k) => { if (form[k]) body[k] = form[k]; });
    try {
      const r = await api.post("/admin/grant", body);
      toast.success(r.data.changes.join(", ") || "No changes");
      setForm(EMPTY); setMode({ gold: "give", pearls: "give", crate: "give" }); onChanged?.(r.data.user);
      if (r.data.user.username === user.username) refresh();
    } catch (e) { toast.error(errMsg(e)); }
  };
  const fishList = data.fish.filter((f) => !fishQ || f.name.toLowerCase().includes(fishQ.toLowerCase())).slice(0, 40);
  return (
    <Panel title={`Grant to ${target.username}`} testId="admin-grant-panel">
      <div className="space-y-3">
        <div className="grid grid-cols-2 md:grid-cols-4 gap-2">
          <div><label className="label block mb-1">Gold</label><GiveTake value={mode.gold} onChange={setM("gold")} testId="admin-gold-mode" /><input type="number" min={0} className="input num" value={form.gold} onChange={set("gold")} placeholder={mode.gold === "take" ? "amount to remove" : "amount to add"} data-testid="admin-gold-input" /></div>
          <div><label className="label block mb-1">XP (+)</label><input type="number" className="input num" value={form.xp} onChange={set("xp")} data-testid="admin-xp-input" /></div>
          <div><label className="label block mb-1">Pearls</label><GiveTake value={mode.pearls} onChange={setM("pearls")} testId="admin-pearls-mode" /><input type="number" min={0} className="input num" value={form.pearls} onChange={set("pearls")} data-testid="admin-pearls-input" /></div>
          <div><label className="label block mb-1">Set level</label><input type="number" min={1} max={250} className="input num" value={form.level} onChange={set("level")} data-testid="admin-level-input" /></div>
          <div><label className="label block mb-1">Set energy</label><input type="number" min={0} max={100} className="input num" value={form.energy} onChange={set("energy")} data-testid="admin-energy-input" /></div>
          <div><label className="label block mb-1">Angler Pass days (±)</label><input type="number" className="input num" value={form.pass_days} onChange={set("pass_days")} placeholder="e.g. 30" data-testid="admin-pass-days-input" /></div>
          <div><label className="label block mb-1">Pass items (+)</label><input type="number" min={1} className="input num" value={form.pass_items} onChange={set("pass_items")} title="Angler Pass · Month items into their Inventory" data-testid="admin-pass-items-input" /></div>
        </div>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-2">
          <div><label className="label block mb-1">Bait</label><select className="input" value={form.bait_id} onChange={set("bait_id")} data-testid="admin-bait-select"><option value="">-</option>{data.baits.map((b) => <option key={b.id} value={b.id}>{b.name}</option>)}</select></div>
          <div><label className="label block mb-1">Bait qty</label><input type="number" className="input num" value={form.bait_qty} onChange={set("bait_qty")} /></div>
          <div><label className="label block mb-1">Give gear</label><select className="input" value={form.gear_id} onChange={set("gear_id")} data-testid="admin-gear-select"><option value="">-</option>{[...data.rods, ...data.reels, ...data.lines].map((g) => <option key={g.id} value={g.id}>{g.name}</option>)}</select></div>
          <div><label className="label block mb-1">Crate</label><GiveTake value={mode.crate} onChange={setM("crate")} testId="admin-crate-mode" /><select className="input" value={form.crate_id} onChange={set("crate_id")} data-testid="admin-crate-select"><option value="">-</option>{CRATES.map(([id, n]) => <option key={id} value={id}>{n}</option>)}</select></div>
          <div><label className="label block mb-1">Crate qty</label><input type="number" min={1} max={100} className="input num" value={form.crate_qty} onChange={set("crate_qty")} placeholder="e.g. 1" data-testid="admin-crate-qty-input" /></div>
          <div><label className="label block mb-1">Unlock water</label><select className="input" value={form.water} onChange={set("water")} data-testid="admin-water-select"><option value="">-</option>{data.waters.map((w) => <option key={w.key} value={w.key}>{w.name}</option>)}</select></div>
        </div>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-2 items-end">
          <div className="col-span-2"><label className="label block mb-1">Add fish</label><input className="input mb-1" placeholder="Filter species..." value={fishQ} onChange={(e) => setFishQ(e.target.value)} /><select className="input" value={form.species_id} onChange={set("species_id")} data-testid="admin-species-select"><option value="">-</option>{fishList.map((f) => <option key={f.id} value={f.id}>{f.name} ({f.rarity})</option>)}</select></div>
          <div><label className="label block mb-1">Weight kg (blank = random)</label><input type="number" step="0.01" className="input num" value={form.weight} onChange={set("weight")} /></div>
          <div><label className="label block mb-1">Variant</label><select className="input" value={form.variant} onChange={set("variant")}>{data.variants.map((v) => <option key={v} value={v}>{v}</option>)}</select></div>
        </div>
        <button className="btn btn-gold" onClick={grant} data-testid="admin-grant-button">Apply changes</button>
      </div>
    </Panel>
  );
}
