import { getPrefs } from "./prefs";
import { sfx as play } from "../../game/sfx";

// Menu/legacy sound names mapped onto the recorded effects in public/audio/sfx.
const MAP = { cast: "cast", bite: "bite", reel: "click", catch: "land", rare: "legendary", snap: "snap", level: "legendary", achievement: "coin", boss: "legendary", pm: "click", mention: "click" };
const last = {};

export function sfx(name, gapMs = 400) {
  const p = getPrefs();
  if (!p.sound_on || window.__flMuted || (name === "mention" && !p.sound_mention) || !MAP[name]) return;
  const now = Date.now();
  if (last[name] && now - last[name] < gapMs) return;
  last[name] = now;
  play(MAP[name]);
}

export const sfxAchievements = (list) => { if (list && list.length) setTimeout(() => sfx("achievement"), 700); };
export const RARE_UP = ["epic", "legendary", "mythic"];
