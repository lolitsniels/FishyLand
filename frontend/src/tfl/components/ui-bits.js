/*
 * FishyLand. Copyright © 2026. All rights reserved.
 * This source code is proprietary and confidential. Unauthorized copying, reproduction,
 * modification, distribution or use of this file, in whole or in part, via any medium,
 * is strictly prohibited without prior written permission from the owner.
 */
import { ShieldCheck, Heart } from "lucide-react";
import { fmt } from "../lib/api";
import { PixelIcon } from "./PixelIcon";
import { t as tt } from "../i18n";

export const Panel = ({ title, right, children, className = "", bodyClass = "", testId, icon = "shop" }) => (
  <section className={`panel ${className}`} data-testid={testId}>
    {title && (
      <header className={`panel-head ${icon ? "has-icon" : ""}`}>
        {icon && <PixelIcon name={icon} className="panel-head-icon" />}<span>{title}</span>
        {right && <span className="font-sans normal-case tracking-normal text-[12px] text-[var(--text-2)]">{right}</span>}
      </header>
    )}
    <div className={`panel-body ${bodyClass}`}>{children}</div>
  </section>
);

export const Rarity = ({ r, tag = false, className = "" }) =>
  tag ? <span className={`tag rar-${r} ${className}`}>{r}</span> : <span className={`rar-${r} ${className}`}>{r}</span>;

export const Gold = ({ n, className = "", "data-testid": testId }) => (
  <span data-testid={testId} className={`num inline-flex items-center gap-1 text-[#ffcfa8] ${className}`}>
    <img src="/art/hud/gold.webp" alt="" aria-hidden className="w-[15px] h-[15px] object-contain" />{fmt(n)}
  </span>
);

export const PearlIcon = ({ size = 11, className = "" }) => (
  <img src="/art/hud/pearl.webp" alt="" aria-hidden className={`inline-block shrink-0 object-contain ${className}`} style={{ width: size + 4, height: size + 4 }} />
);

export const Pearls = ({ n, className = "", "data-testid": testId }) => (
  <span data-testid={testId} title={tt("Pearls: rare currency for portraits and name changes")} className={`num inline-flex items-center gap-1 text-[#e9dcf5] ${className}`}>
    <PearlIcon />{fmt(n)}
  </span>
);

export const AdminBadge = ({ className = "", "data-testid": testId = "admin-badge" }) => (
  <span data-testid={testId} title={tt("Game administrator")} className={`inline-flex items-center align-middle text-[#ffb3b0] ${className}`}>
    <ShieldCheck size={12} />
  </span>
);

export const ModBadge = ({ className = "", "data-testid": testId = "mod-badge" }) => (
  <span data-testid={testId} title={tt("Moderator")} className={`inline-flex items-center align-middle text-[#7fd6b8] ${className}`}>
    <PixelIcon name="mod" size={12} />
  </span>
);

export const PassIcon = ({ size = 14, className = "" }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" className={className} aria-hidden="true">
    <path d="M3 8a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2v2a2 2 0 0 0 0 4v2a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-2a2 2 0 0 0 0-4Z" />
    <path d="M7.5 12c1.4-2 3.2-3 5.2-3 1.6 0 3 .8 4.3 3-1.3 2.2-2.7 3-4.3 3-2 0-3.8-1-5.2-3Z" fill="currentColor" fillOpacity=".25" />
    <path d="M17 12l2.5-2v4Z" fill="currentColor" fillOpacity=".25" />
    <circle cx="10.2" cy="11.4" r=".6" fill="currentColor" stroke="none" />
  </svg>
);

export const PremiumBadge = ({ className = "", size = 11, "data-testid": testId = "premium-badge" }) => (
  <span data-testid={testId} title={tt("Angler Pass: 150 energy, no market fee, the Almanac")} className={`inline-flex items-center align-middle text-[#f08a45] ${className}`}>
    <PassIcon size={size} />
  </span>
);

export const SupporterBadge = ({ className = "", size = 11, "data-testid": testId = "supporter-badge" }) => (
  <span data-testid={testId} title={tt("Supporter: bought a server-wide booster for everyone")} className={`inline-flex items-center align-middle text-[#e8647a] ${className}`}>
    <Heart size={size} fill="currentColor" />
  </span>
);

export const Bar = ({ value, max, color, className = "" }) => (
  <div className={`bar ${className}`}><div style={{ width: `${Math.min(100, (value / max) * 100)}%`, background: color }} /></div>
);

export const Empty = ({ children }) => <div className="text-[var(--muted)] text-sm italic py-4 text-center">{children}</div>;

export const Stat = ({ label, value, className = "" }) => (
  <div className={className}>
    <div className="label">{label}</div>
    <div className="num text-[15px]">{value}</div>
  </div>
);

export const RecaptchaNote = ({ className = "" }) => (
  <p className={`rc-note ${className}`} data-testid="recaptcha-note">{tt("This site is protected by reCAPTCHA and the Google")} <span>{tt("Privacy Policy")}</span> {tt("and")} <span>{tt("Terms of Service")}</span> {tt("apply.")}</p>
);
