import Modal from "../components/panels/Modal";
import { useGame } from "../store";
import { setPref, usePrefs } from "../tfl/lib/prefs";
import { lengthUnit } from "../tfl/lib/api";

function Choice({ label, value, options, onPick, testid }) {
  return (
    <div className="flex items-center justify-between gap-4 py-3 border-b border-amber-900/40 last:border-0" data-testid={testid}>
      <span className="font-cinzel font-bold text-amber-100 text-sm">{label}</span>
      <div className="flex gap-2">
        {options.map(([v, t]) => (
          <button key={String(v)} type="button" onClick={() => onPick(v)} aria-pressed={value === v} data-testid={`${testid}-${v}`}
            className={`fr-btn ${value === v ? "" : "fr-btn-dark"} px-4 py-1 text-sm min-w-[64px]`}>{t}</button>
        ))}
      </div>
    </div>
  );
}

// In-game settings: music, sound effects and the units fish are shown in.
export function GameSettings({ onClose }) {
  const settings = useGame((s) => s.settings);
  const setSetting = useGame((s) => s.setSetting);
  const p = usePrefs();
  const onOff = [[true, "On"], [false, "Off"]];
  return (
    <Modal title="Settings" testid="settings-modal" width={460} onClose={onClose}>
      <div className="px-2 py-1">
        <Choice label="Music" value={!!settings.music} options={onOff} onPick={(v) => setSetting("music", v)} testid="set-music" />
        <Choice label="Sound effects" value={!!settings.sound} options={onOff} onPick={(v) => setSetting("sound", v)} testid="set-sound" />
        <Choice label="Weight" value={p.weight_unit} options={[["kg", "kg"], ["lb", "lb"]]} onPick={(v) => setPref("weight_unit", v)} testid="set-weight" />
        <Choice label="Length" value={p.length_unit || lengthUnit()} options={[["cm", "cm"], ["in", "inches"]]} onPick={(v) => setPref("length_unit", v)} testid="set-length" />
      </div>
    </Modal>
  );
}
