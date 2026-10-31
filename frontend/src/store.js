import { create } from "zustand";
import { ls } from "./offline/bridge";

export const loadSettings = () => {
  try { return { sound: true, music: true, low: false, fps: false, ...JSON.parse(ls.getItem("fr_settings") || "{}") }; }
  catch { return { sound: true, music: true, low: false, fps: false }; }
};

let lineId = 0;

export const useGame = create((set, get) => ({
  player: null,
  data: null,
  modal: null,
  phase: "idle",
  bait: "worm",
  result: null,
  lostMsg: null,
  system: [],
  world: [],
  settings: loadSettings(),
  paused: false,
  needTap: false,
  setPlayer: (player) => set({ player }),
  patchPlayer: (p) => set({ player: { ...get().player, ...p } }),
  setData: (data) => set({ data }),
  openModal: (modal) => set({ modal }),
  closeModal: () => set({ modal: null }),
  setPhase: (phase) => set({ phase }),
  setBait: (bait) => set({ bait }),
  setResult: (result) => set({ result }),
  setLostMsg: (lostMsg) => set({ lostMsg }),
  setWorld: (world) => set({ world }),
  pushSystem: (text, kind = "info") =>
    set({ system: [...get().system.slice(-60), { id: ++lineId, text, kind, at: new Date() }] }),
  setSetting: (k, v) => {
    const settings = { ...get().settings, [k]: v };
    ls.setItem("fr_settings", JSON.stringify(settings));
    set({ settings });
  },
}));

export const speciesById = (id) => get_species(id);
function get_species(id) {
  return useGame.getState().data?.species.find((s) => s.id === id);
}
