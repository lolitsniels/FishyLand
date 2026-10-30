// Browser MMORPG (browsermmorpg.com) 1x1 attribution pixels.
import { PORTAL } from "./portal";
const BASE = "https://browsermmorpg.com/track";
const ping = (file) => { if (PORTAL) return; const img = new Image(1, 1); img.alt = ""; img.src = `${BASE}/${file}`; };

export function bmmVisit() {
  if (sessionStorage.getItem("bmm_visit")) return;
  sessionStorage.setItem("bmm_visit", "1");
  ping("visit_1501.jpg");
}

export function bmmRegistration(playerId) {
  if (!playerId || localStorage.getItem(`bmm_reg_${playerId}`)) return;
  localStorage.setItem(`bmm_reg_${playerId}`, "1");
  ping(`reg_1501_${encodeURIComponent(playerId)}.jpg`);
}
