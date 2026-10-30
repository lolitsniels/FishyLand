import { SKINS, HAIRS, parseLook, lookId, idleSprite } from "../game/look";

const Row = ({ label, children }) => (
  <div className="flex flex-col gap-1.5">
    <span className="font-cinzel text-[11px] font-bold tracking-widest text-amber-200 uppercase">{label}</span>
    <div className="flex flex-wrap gap-2">{children}</div>
  </div>
);

// Gender, skin tone and hair colour picker with a live preview; used at sign-up and in the profile.
export function CharacterPicker({ value, onChange, testid = "char-picker" }) {
  const l = parseLook(value);
  const set = (p) => onChange(lookId({ ...l, ...p }));
  return (
    <div className="flex gap-4 items-center" data-testid={testid}>
      <div className="w-[92px] h-[176px] shrink-0 rounded-xl border-2 border-amber-600/70 bg-[radial-gradient(circle_at_50%_70%,rgba(255,220,140,.25),rgba(0,0,0,.4)_70%)] grid place-items-end justify-center overflow-hidden" data-testid={`${testid}-preview`}>
        <img key={value} src={`/${idleSprite(value)}`} alt="Your angler" className="h-[168px] w-auto object-contain pop" />
      </div>
      <div className="flex flex-col gap-3 min-w-0">
        <Row label="Angler">
          {[["m", "Male"], ["f", "Female"]].map(([g, t]) => (
            <button key={g} type="button" onClick={() => set({ g })} className={`fr-btn ${l.g === g ? "" : "fr-btn-dark"} px-4 py-1 text-sm`} aria-pressed={l.g === g} data-testid={`${testid}-gender-${g}`}>{t}</button>
          ))}
        </Row>
        <Row label="Skin tone">
          {SKINS.map((c, i) => (
            <button key={c} type="button" onClick={() => set({ s: i })} aria-label={`Skin tone ${i + 1}`} aria-pressed={l.s === i} data-testid={`${testid}-skin-${i}`}
              className={`w-8 h-8 rounded-full border-2 transition-transform hover:scale-110 ${l.s === i ? "border-amber-200 scale-110 shadow-[0_0_10px_rgba(255,216,99,.8)]" : "border-black/60"}`} style={{ background: c }} />
          ))}
        </Row>
        <Row label="Hair colour">
          {HAIRS.map(([c, t], i) => (
            <button key={c} type="button" onClick={() => set({ h: i })} title={t} aria-label={`${t} hair`} aria-pressed={l.h === i} data-testid={`${testid}-hair-${i}`}
              className={`w-8 h-8 rounded-full border-2 transition-transform hover:scale-110 ${l.h === i ? "border-amber-200 scale-110 shadow-[0_0_10px_rgba(255,216,99,.8)]" : "border-black/60"}`} style={{ background: c }} />
          ))}
        </Row>
      </div>
    </div>
  );
}
