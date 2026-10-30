import { fmt } from "../lib/api";

// Shared shop layout: folder tabs, main column (feature banner + item grid), side column, wallet bar.
export function ShopFrame({ tabs, value, onChange, side, wallet, action, children, testid }) {
  return (
    <div className="sf" data-testid={testid}>
      <div className="sf-tabs" role="tablist">
        {tabs.map(([id, label]) => (
          <button key={id} type="button" role="tab" aria-selected={value === id} className={`sf-tab ${value === id ? "on" : ""}`} onClick={() => onChange(id)} data-testid={`${testid}-tab-${id}`}>{label}</button>
        ))}
      </div>
      <div className={`sf-body ${side ? "has-side" : ""}`}>
        <div className="sf-main min-w-0">{children}</div>
        {side && <aside className="sf-side" data-testid={`${testid}-side`}>{side}</aside>}
      </div>
      <div className="sf-wallet" data-testid={`${testid}-wallet`}>
        {wallet.gold != null && <Purse icon={<img src="/art/hud/gold.webp" alt="" className="w-5 h-5" />} label="Gold" n={wallet.gold} testid={`${testid}-gold`} />}
        {wallet.pearls != null && <Purse icon={<img src="/art/hud/pearl.webp" alt="" className="w-5 h-5" />} label="Pearls" n={wallet.pearls} testid={`${testid}-pearls`} />}
        <div className="ml-auto">{action}</div>
      </div>
    </div>
  );
}

const Purse = ({ icon, label, n, testid }) => (
  <div className="sf-purse"><span className="sf-purse-ic">{icon}</span><span className="sf-purse-l">{label}</span><b className="num" data-testid={testid}>{fmt(n || 0)}</b></div>
);

export function ShopBanner({ img, bg, kicker, title, sub, children, testid }) {
  return (
    <div className="sf-banner" style={bg ? { backgroundImage: `linear-gradient(90deg, rgba(6,5,4,.92) 30%, rgba(6,5,4,.35)), url(${bg})` } : undefined} data-testid={testid}>
      <div className="min-w-0 flex-1">
        {kicker && <div className="sf-kicker">{kicker}</div>}
        <div className="sf-banner-t">{title}</div>
        {sub && <div className="sf-banner-s">{sub}</div>}
        <div className="mt-3 flex items-center gap-3 flex-wrap">{children}</div>
      </div>
      {img && <img src={img} alt="" className="sf-banner-img" />}
    </div>
  );
}

export function ShopItem({ img, rarity = "common", name, tag, sub, price, badge, onArt, children, testid }) {
  return (
    <div className={`sf-item rc-${rarity}`} data-testid={testid}>
      <button type="button" className="sf-item-art" onClick={onArt} disabled={!onArt}>{img && <img src={img} alt="" loading="lazy" />}{badge && <span className="sf-item-badge">{badge}</span>}</button>
      <div className="min-w-0 flex-1 flex flex-col">
        <div className="sf-item-n" title={name}>{name}{tag && <span className="sf-item-tag">{tag}</span>}</div>
        {sub && <div className="sf-item-sub">{sub}</div>}
        <div className="flex items-center justify-between gap-2 mt-auto pt-1.5">{price}<span className="flex items-center gap-1.5">{children}</span></div>
      </div>
    </div>
  );
}

export function SideDeal({ img, name, sub, children, testid }) {
  return (
    <div className="sf-deal" data-testid={testid}>
      {img && <img src={img} alt="" />}
      <div className="min-w-0 flex-1"><div className="sf-item-n">{name}</div>{sub && <div className="sf-item-sub">{sub}</div>}</div>
      <div className="shrink-0">{children}</div>
    </div>
  );
}
