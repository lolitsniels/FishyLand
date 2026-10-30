import { useEffect, useState } from "react";
import { toast } from "sonner";
import { api, errMsg } from "../lib/api";
import { useGame } from "../context/GameContext";
import { Panel, Empty } from "./ui-bits";
import { Avatar } from "./Avatar";
import { RodSkinArt } from "./RodSkin";
import { loadTebexJs } from "../lib/tebex";
import { t as tt } from "../i18n";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "./ui/dialog";

function Preview({ it, me }) {
  if (it.kind === "rod_skin") return <span className="rod-skin-stage rod-skin-stage-lg"><RodSkinArt skin={it.id} /></span>;
  if (it.kind === "avatar") return <Avatar id={it.id} size="xl" frame={me.frame} />;
  if (it.kind === "frame") return <Avatar id={me.avatar} size="lg" frame={it.id} />;
  const byKind = (k) => it.items.find((i) => i.startsWith(k));
  const av = byKind("av_"), fr = byKind("frame_"), rod = byKind("skin_");
  return (
    <span className="flex items-end gap-3">
      {(av || fr) && <Avatar id={av || me.avatar} size="md" frame={fr || me.frame} />}
      {rod && <span className="rod-skin-stage"><RodSkinArt skin={rod} /></span>}
    </span>
  );
}

const KIND = { rod_skin: "Rod skin", avatar: "Animated avatar", frame: "Animated frame", pack: "Bundle" };

function GiftDialog({ it, onClose, onSend }) {
  const [to, setTo] = useState("");
  return (
    <Dialog open onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="panel max-w-sm w-[calc(100%-24px)]" data-testid="gift-dialog">
        <DialogHeader><DialogTitle className="font-display">{tt("Gift")} {tt(it.name)}</DialogTitle></DialogHeader>
        <p className="text-[12.5px] text-[var(--text-2)]">{tt("Type the angler's name. They get it straight after payment, with a message saying it came from you.")}</p>
        <input className="input" autoFocus placeholder={tt("Angler name")} value={to} onChange={(e) => setTo(e.target.value)} onKeyDown={(e) => e.key === "Enter" && to.trim() && onSend(to.trim())} data-testid="gift-username-input" />
        <button className="btn btn-gold" disabled={!to.trim()} onClick={() => onSend(to.trim())} data-testid="gift-send-button">{tt("Pay & send gift")} · ${it.usd.toFixed(2)}</button>
      </DialogContent>
    </Dialog>
  );
}

function Card({ it, me, canBuy, owned, onBuy, onGift }) {
  return (
    <div className={`cos-card ${it.kind === "pack" ? "cos-card-pack" : ""} ${it.limited ? "cos-card-limited" : ""}`} data-testid={`cosmetic-${it.id}`}>
      <div className="cos-stage"><Preview it={it} me={me} /></div>
      <div className="p-3 flex flex-col gap-1 flex-1">
        <span className="label !text-[10px] text-[#b48cff]">{tt(KIND[it.kind])}{owned && <span className="text-[var(--ok)]"> · {tt("owned")}</span>}</span>
        {it.limited && <span className="label !text-[10px] text-[var(--gold)]" data-testid={`cosmetic-left-${it.id}`}>{tt("Limited")} · {it.left} {tt("of")} {it.limited} {tt("left")}</span>}
        <span className="font-display text-[17px] text-[#f4ead2] leading-tight">{tt(it.name)}</span>
        <span className="text-[12px] text-[var(--text-2)] flex-1">{tt(it.desc)}</span>
        <div className="flex items-center gap-2 mt-2">
          <span className="num text-[16px] text-[var(--gold)]" data-testid={`cosmetic-price-${it.id}`}>${it.usd.toFixed(2)}</span>
          {it.full_usd && <span className="num text-[12px] text-[var(--muted)] line-through">${it.full_usd.toFixed(2)}</span>}
          <button className="btn btn-sm ml-auto" disabled={!canBuy} onClick={() => onGift(it)} data-testid={`cosmetic-gift-${it.id}`}>{tt("Gift")}</button>
          {!owned && <button className="btn btn-gold btn-sm" disabled={!canBuy} onClick={() => onBuy(it)} data-testid={`cosmetic-buy-${it.id}`}>{tt("Buy")}</button>}
        </div>
      </div>
    </div>
  );
}

export function CosmeticShop() {
  const { user, setUser } = useGame();
  const [d, setD] = useState(null);
  const [gift, setGift] = useState(null);
  const load = () => api.get("/shop/cosmetics").then((r) => setD(r.data)).catch(() => setD({ items: [], giftable: [] }));
  useEffect(() => { load(); }, []);
  const verify = async () => {
    try { const r = await api.post("/shop/cosmetics/verify"); if (r.data.fulfilled) { setUser(r.data.user); load(); toast.success(tt("Payment confirmed!")); } } catch { /* webhook will catch up */ }
  };
  const buy = async (it, giftTo) => {
    try {
      const r = await api.post("/shop/cosmetics/checkout", { item: it.id, gift_to: giftTo || null });
      setGift(null);
      if (r.data.ident && (await loadTebexJs())) {
        window.Tebex.checkout.init({ ident: r.data.ident, theme: "dark", colors: [{ name: "primary", color: "#d9682e" }, { name: "secondary", color: "#1d160a" }] });
        window.Tebex.checkout.on("payment:complete", () => { toast.success(tt("Payment received. Confirming with the harbour…")); setTimeout(verify, 1500); setTimeout(verify, 6000); });
        window.Tebex.checkout.on("close", () => load());
        window.Tebex.checkout.launch();
        return;
      }
      window.__leaving = true;
      window.location.assign(r.data.url);
    } catch (e) { toast.error(errMsg(e)); }
  };
  if (!d) return <Panel icon="pearl" title={tt("Cosmetics")}><Empty>{tt("Loading…")}</Empty></Panel>;
  return (
    <Panel icon="pearl" title={tt("Cosmetics")} right={<span className="text-[11.5px]">{tt("Looks only, never stats · yours forever")}</span>} testId="cosmetic-shop">
      {d.items.length === 0 ? <Empty>{tt("You own every cosmetic on sale. More are coming!")}</Empty> : (
        <div className="grid sm:grid-cols-2 xl:grid-cols-4 gap-3">
          {d.items.map((it) => <Card key={it.id} it={it} me={user} canBuy={d.can_buy} onBuy={(x) => buy(x)} onGift={setGift} />)}
        </div>
      )}
      {d.giftable?.length > 0 && (
        <details className="mt-4" data-testid="cosmetic-giftable">
          <summary className="label cursor-pointer select-none">{tt("Gift something you already own")} ({d.giftable.length})</summary>
          <div className="grid sm:grid-cols-2 xl:grid-cols-4 gap-3 mt-3">
            {d.giftable.map((it) => <Card key={it.id} it={it} me={user} canBuy={d.can_buy} owned onGift={setGift} />)}
          </div>
        </details>
      )}
      {gift && <GiftDialog it={gift} onClose={() => setGift(null)} onSend={(to) => buy(gift, to)} />}
      {!d.can_buy && <div className="text-[12px] text-[#f0a5a3] mt-2">{tt("Claim your guest account first so purchases can be credited to you.")}</div>}
    </Panel>
  );
}
