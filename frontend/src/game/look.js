// Player character look = avatar: "look:<gender>_<skin>_<hair>".
export const SKINS = ["#f7d6ba", "#e2aa80", "#b87c54", "#784c32"];
export const HAIRS = [["#261e1c", "Black"], ["#704222", "Brown"], ["#e8c066", "Blonde"], ["#ba4020", "Red"], ["#cdd0dc", "Silver"]];
export const DEFAULT_LOOK = "look:m_1_1";

export const parseLook = (a) => {
  const m = /^look:([mf])_([0-3])_([0-4])$/.exec(a || "");
  return m ? { g: m[1], s: +m[2], h: +m[3] } : { g: "m", s: 1, h: 1 };
};
export const lookId = ({ g, s, h }) => `look:${g}_${s}_${h}`;
const key = (a) => { const l = parseLook(a); return `${l.g}_${l.s}_${l.h}`; };
export const lookSprite = (a) => `art/chars/${key(a)}.webp`;
export const lookFace = (a) => `/art/chars/face_${key(a)}.webp`;
// Grip point of the raised front fist, as a fraction of the sprite box (feet anchor is bottom-centre).
export const HAND = { m: [0.886, 0.354], f: [0.885, 0.288] };
export const handSprite = (a) => `art/chars/hand_${key(a)}.webp`;
