// Browser MMORPG (browsermmorpg.com) 1x1 attribution pixels.
import { PORTAL } from "./portal";
import { ls, ss } from "../../offline/bridge";
const BASE = "https://browsermmorpg.com/track";
const ping = (file) => { if (PORTAL) return; const img = new Image(1, 1); img.alt = ""; img.src = `${BASE}/${file}`; };

export function bmmVisit() {
  if (ss.getItem("bmm_visit")) return;
  ss.setItem("bmm_visit", "1");
  ping("visit_1501.jpg");
}

export function bmmRegistration(playerId) {
  if (!playerId || ls.getItem(`bmm_reg_${playerId}`)) return;
  ls.setItem(`bmm_reg_${playerId}`, "1");
  ping(`reg_1501_${encodeURIComponent(playerId)}.jpg`);
}
