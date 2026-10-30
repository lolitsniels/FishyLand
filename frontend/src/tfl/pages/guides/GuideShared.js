/*
 * Fishing Realms, Copyright © 2026. All rights reserved.
 * This source code is proprietary and confidential. Unauthorized copying, reproduction,
 * modification, distribution or use of this file, in whole or in part, via any medium,
 * is strictly prohibited without prior written permission from the owner.
 */
import { Link } from "react-router-dom";
import { useEffect } from "react";
import Seo, { SITE_URL } from "../../components/Seo";
import MarketingShell, { GUIDES, GuideNav } from "../../components/MarketingShell";
import { api } from "../../lib/api";

// Remembers the last guide read, so a later sign-up is credited to it; counts one view per guide per session.
function useGuideView(slug) {
  useEffect(() => {
    localStorage.setItem("owo_guide", slug);
    const k = `owo_gv_${slug}`;
    if (sessionStorage.getItem(k)) return;
    sessionStorage.setItem(k, "1");
    api.post("/track/guide", { slug }).catch(() => {});
  }, [slug]);
}

export function GuidesIndex() {
  const jsonLd = {
    "@context": "https://schema.org",
    "@type": "CollectionPage",
    name: "Fishing Game Guides",
    url: SITE_URL + "/guides",
    description: "Honest, hand-written guides comparing the best fishing games, browser MMOs, and Fishao-style collection games.",
    hasPart: GUIDES.map((g) => ({ "@type": "Article", name: g.title, url: `${SITE_URL}/guides/${g.slug}` })),
  };
  return (
    <MarketingShell active="index">
      <Seo
        title="Fishing Game Guides"
        description="Honest guides comparing the best fishing games: browser MMOs, Fishao alternatives, sims and cozy multiplayer picks, updated by anglers, not marketers."
        path="/guides"
        type="website"
        jsonLd={jsonLd}
      />
      <section className="max-w-4xl mx-auto px-6 py-12">
        <p className="label label-gold mb-3">Guides</p>
        <h1 className="font-display text-3xl md:text-4xl text-[#f4ead2]">Fishing game guides</h1>
        <p className="mt-4 text-[14px] text-[var(--text-2)]">
          Short, opinionated write-ups on the best fishing games worth your time: the browser MMOs, the cozy 2D
          collectors, and the deep simulators. We built <Link to="/" className="text-[var(--gold)] hover:underline">Fishing Realms</Link>,
          but these pages are here to help you find whichever fishing game actually fits how you want to play, not to sell you ours.
        </p>
        <ul className="mt-8 grid md:grid-cols-2 gap-3" data-testid="guide-index-list">
          {GUIDES.map((g) => (
            <li key={g.slug} className="panel p-4">
              <Link to={`/guides/${g.slug}`} className="font-display text-[15px] text-[var(--gold)] hover:underline">{g.title}</Link>
              <p className="text-[12.5px] text-[var(--text-2)] mt-1">{g.blurb}</p>
            </li>
          ))}
        </ul>
      </section>
    </MarketingShell>
  );
}

/**
 * Shared layout for individual guide articles. Keeps the visual voice
 * consistent with the game (classic MMO panels, gold accents) and the two-column
 * reading + sidebar structure that internally links every guide to the others.
 */
export function GuideLayout({ slug, title, description, updated, children, jsonLd }) {
  useGuideView(slug);
  const canonical = `/guides/${slug}`;
  const article = {
    "@context": "https://schema.org",
    "@type": "Article",
    headline: title,
    description,
    url: SITE_URL + canonical,
    dateModified: updated,
    author: { "@type": "Organization", name: "Fishing Realms" },
    publisher: { "@type": "Organization", name: "Fishing Realms", logo: { "@type": "ImageObject", url: SITE_URL + "/icon-512.png" } },
    mainEntityOfPage: SITE_URL + canonical,
  };
  const breadcrumb = {
    "@context": "https://schema.org",
    "@type": "BreadcrumbList",
    itemListElement: [
      { "@type": "ListItem", position: 1, name: "Home", item: SITE_URL + "/" },
      { "@type": "ListItem", position: 2, name: "Guides", item: SITE_URL + "/guides" },
      { "@type": "ListItem", position: 3, name: title, item: SITE_URL + canonical },
    ],
  };
  return (
    <MarketingShell active={slug}>
      <Seo title={title} description={description} path={canonical} jsonLd={jsonLd ? [article, breadcrumb, jsonLd] : [article, breadcrumb]} />
      <div className="max-w-6xl mx-auto px-6 py-10 grid lg:grid-cols-[1fr_260px] gap-8">
        <article className="min-w-0" data-testid={`guide-${slug}`}>
          <nav aria-label="Breadcrumb" className="text-[11.5px] text-[var(--muted)] mb-3">
            <Link to="/" className="hover:text-[var(--gold)]">Home</Link>
            <span className="mx-1">›</span>
            <Link to="/guides" className="hover:text-[var(--gold)]">Guides</Link>
            <span className="mx-1">›</span>
            <span className="text-[var(--text-2)]">{title}</span>
          </nav>
          <h1 className="font-display text-3xl md:text-4xl text-[#f4ead2]">{title}</h1>
          <p className="text-[11.5px] text-[var(--muted)] mt-1">Updated {new Date(updated).toLocaleDateString("en-GB", { year: "numeric", month: "long" })} · by the crew at Fishing Realms</p>
          {HERO[slug] && (
            <figure className="mt-5" data-testid={`guide-hero-${slug}`}>
              <img src={HERO[slug][0]} alt={HERO[slug][1]} width="1440" height="900" fetchpriority="high" className="w-full h-auto max-h-[340px] object-cover object-top border border-[var(--border)]" />
              <figcaption className="text-[11px] text-[var(--muted)] mt-1">{HERO[slug][1]}</figcaption>
            </figure>
          )}
          <div className="prose-mmo mt-6 space-y-5 text-[14px] text-[#ddd5cc] leading-relaxed">{children}</div>
          <p className="text-[10.5px] text-[var(--muted)] mt-6">Game images are store artwork of their respective owners, used with permission. All trademarks belong to their owners.</p>
          <aside className="mt-10 panel panel-gold p-4">
            <div className="font-display text-[13px] text-[var(--gold)] uppercase tracking-widest">Try Fishing Realms</div>
            <p className="text-[12.5px] text-[var(--text-2)] mt-1">Free, no install, no launcher. Cast at Millbrook Pond in under a minute, your gold, journal and gear persist forever.</p>
            <Link to="/" className="btn btn-gold btn-sm mt-3 inline-block" data-testid={`guide-cta-${slug}`}>Create your angler</Link>
          </aside>
        </article>
        <div className="space-y-3">
          <GuideNav current={slug} />
        </div>
      </div>
    </MarketingShell>
  );
}

const S = "/art/screens/";
const HERO = {
  "fishao-alternatives": [S + "journal.jpg", "The Fish Journal in Fishing Realms: 340+ species to collect, a lot like the old Fishao book"],
  "games-like-fishao": [S + "harbor.jpg", "The Harbour in Fishing Realms, a free pixel art fishing MMO in your browser"],
  "best-browser-fishing-games": [S + "fishing_anim.webp", "Landing a fish in Fishing Realms, playing right in a browser tab"],
  "fishing-mmo": [S + "rankings.jpg", "Shared rankings in Fishing Realms fishing MMO"],
  "online-fishing-games": [S + "waters.jpg", "The waters of Fishing Realms, from starter ponds to the deep sea"],
  "games-like-fishing-planet": [S + "waters.jpg", "Twelve waters to unlock in Fishing Realms, a free alternative to Fishing Planet"],
  "russian-fishing-4-alternatives": [S + "fishing_anim.webp", "The tension-bar fight in Fishing Realms: easy to learn, hard to master"],
  "call-of-the-wild-the-angler-alternatives": [S + "shop.jpg", "Rods, reels and lines in Fishing Realms Tackle Shop"],
};

// Store art (Steam capsules) used with the developers' permission; matched by the card's game name.
const G = "/art/guides/games/";
const GAME_ART = [
  [/^Fishing Realms/, S + "fishing_anim.webp", "Fishing Realms: landing a fish in the tension-bar fight"],
  [/^Webfishing/, G + "webfishing.webp", "Webfishing"], [/^Fishing Planet/, G + "fishing-planet.webp", "Fishing Planet"],
  [/^Call of the Wild: The Angler/, G + "cotw-angler.webp", "Call of the Wild: The Angler"], [/^Ultimate Fishing Simulator 2/, G + "ufs2.webp", "Ultimate Fishing Simulator 2"],
  [/^Stardew Valley/, G + "stardew-valley.webp", "Stardew Valley"], [/^Russian Fishing 4/, G + "russian-fishing-4.webp", "Russian Fishing 4"],
  [/Old School RuneScape/, G + "osrs.webp", "Old School RuneScape"], [/^Fishing Sim World/, G + "fishing-sim-world.webp", "Fishing Sim World: Pro Tour"],
  [/^Cat Goes Fishing/, G + "cat-goes-fishing.webp", "Cat Goes Fishing"], [/^theHunter/, G + "thehunter-cotw.webp", "theHunter: Call of the Wild"],
  [/^Sea of Thieves/, G + "sea-of-thieves.webp", "Sea of Thieves"], [/^Final Fantasy XIV/, G + "ffxiv.webp", "Final Fantasy XIV Online"],
];
const gameArt = (name) => GAME_ART.find(([re]) => re.test(name));

export function H2({ children, id }) { return <h2 id={id} className="font-display text-lg md:text-xl text-[var(--gold)] uppercase tracking-widest mt-8">{children}</h2>; }
export function H3({ children }) { return <h3 className="font-display text-[15px] text-[#f4ead2] mt-4">{children}</h3>; }
export function GameCard({ name, tag, verdict, children }) {
  const art = gameArt(name);
  return (
    <div className="panel p-3">
      {art && <img src={art[1]} alt={`${art[2]} key art`} width="460" height="215" loading="lazy" className="w-full aspect-[460/215] object-cover border border-[var(--border)] mb-2" data-testid={`guide-game-img-${art[2].toLowerCase().replace(/[^a-z0-9]+/g, "-")}`} />}
      <div className="flex items-baseline justify-between gap-2 flex-wrap">
        <div className="font-display text-[14.5px] text-[#f4ead2]">{name}</div>
        {tag && <span className="tag text-[10px] text-[var(--gold-dim)]">{tag}</span>}
      </div>
      <div className="text-[13.5px] text-[var(--text-2)] mt-1">{children}</div>
      {verdict && <div className="text-[12px] text-[var(--gold-dim)] mt-2 italic">Best for: {verdict}</div>}
    </div>
  );
}

export function Compare({ them, rows, testId }) {
  return (
    <div className="overflow-x-auto not-prose my-3" data-testid={testId}>
      <table className="table min-w-[520px] text-[12.5px]">
        <thead><tr><th></th><th>{them}</th><th>Fishing Realms</th></tr></thead>
        <tbody>{rows.map(([k, a, b]) => <tr key={k}><td className="text-[var(--muted)] whitespace-nowrap">{k}</td><td>{a}</td><td>{b}</td></tr>)}</tbody>
      </table>
    </div>
  );
}

export const faqLd = (qa) => ({ "@context": "https://schema.org", "@type": "FAQPage", mainEntity: qa.map(([q, a]) => ({ "@type": "Question", name: q, acceptedAnswer: { "@type": "Answer", text: a } })) });

export function Faq({ qa }) {
  return <dl className="space-y-3">{qa.map(([q, a]) => <div key={q}><dt className="font-display text-[14px] text-[#f4ead2]">{q}</dt><dd className="text-[13.5px] text-[var(--text-2)] mt-0.5">{a}</dd></div>)}</dl>;
}
