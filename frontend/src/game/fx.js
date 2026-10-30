// Shared mutable state read every frame by the Pixi scene and the tension bar.
export const fx = {
  phase: "idle",
  pos: 0.5,
  fill: 0,
  zone: 0,
  red: 0,
  tick: 0,
  limit: 1,
  trick: 0,
  target: { x: 620, y: 500 },
  speciesImg: null,
  rarity: null,
  weight: 0,
  phaseAt: 0,
  hold: false,
  username: "",
  title: "",
};

export function setPhase(p) {
  fx.phase = p;
  fx.phaseAt = performance.now();
}
if (typeof window !== "undefined") window.__fx = fx;
