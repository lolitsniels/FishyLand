/*
 * FishyLand, Copyright © 2026. All rights reserved.
 * This source code is proprietary and confidential. Unauthorized copying, reproduction,
 * modification, distribution or use of this file, in whole or in part, via any medium,
 * is strictly prohibited without prior written permission from the owner.
 */
import { Link } from "react-router-dom";
import Seo, { SITE_URL } from "../../components/Seo";
import MarketingShell from "../../components/MarketingShell";

export const CONTACT_EMAIL = "Support@TheFishingLands.com";
export const DISCORD_URL = "https://discord.gg/FHCVrbj4kJ";

export const LEGAL_PAGES = [
  { slug: "about", title: "About" },
  { slug: "contact", title: "Contact" },
  { slug: "privacy", title: "Privacy Policy" },
  { slug: "terms", title: "Terms of Service" },
];

export function LegalLayout({ slug, title, description, updated, children, jsonLd, type = "WebPage" }) {
  const path = `/${slug}`;
  const page = {
    "@context": "https://schema.org",
    "@type": type,
    name: title,
    description,
    url: SITE_URL + path,
    dateModified: updated,
    isPartOf: { "@type": "WebSite", name: "FishyLand", url: SITE_URL },
    publisher: { "@type": "Organization", name: "FishyLand", url: SITE_URL, logo: { "@type": "ImageObject", url: SITE_URL + "/icon-512.png" } },
  };
  return (
    <MarketingShell active={slug}>
      <Seo title={title} description={description} path={path} type="website" jsonLd={jsonLd ? [page, jsonLd] : page} />
      <div className="max-w-6xl mx-auto px-6 py-10 grid lg:grid-cols-[1fr_240px] gap-8">
        <article className="min-w-0" data-testid={`legal-${slug}`}>
          <nav aria-label="Breadcrumb" className="text-[11.5px] text-[var(--muted)] mb-3">
            <Link to="/" className="hover:text-[var(--gold)]">Home</Link>
            <span className="mx-1">›</span>
            <span className="text-[var(--text-2)]">{title}</span>
          </nav>
          <h1 className="font-display text-3xl md:text-4xl text-[#f4ead2]">{title}</h1>
          {updated && <p className="text-[11.5px] text-[var(--muted)] mt-1">Last updated {new Date(updated).toLocaleDateString("en-GB", { year: "numeric", month: "long", day: "numeric" })}</p>}
          <div className="prose-mmo mt-6 space-y-4 text-[14px] text-[#ddd5cc] leading-relaxed">{children}</div>
        </article>
        <aside className="space-y-3">
          <nav aria-label="Site information" className="panel p-3 text-[12.5px]" data-testid="legal-nav">
            <div className="label mb-2">Site information</div>
            <ul className="space-y-1">
              {LEGAL_PAGES.filter((p) => p.slug !== slug).map((p) => (
                <li key={p.slug}><Link to={`/${p.slug}`} className="text-[#c8bfb5] hover:text-[var(--gold)] hover:underline">{p.title}</Link></li>
              ))}
              <li><Link to="/wiki" className="text-[#c8bfb5] hover:text-[var(--gold)] hover:underline">Game Wiki</Link></li>
              <li><Link to="/guides" className="text-[#c8bfb5] hover:text-[var(--gold)] hover:underline">Fishing game guides</Link></li>
            </ul>
            <div className="mt-3 pt-3 border-t border-[var(--border)]">
              <Link to="/" className="btn btn-gold btn-sm w-full text-center" data-testid="legal-nav-play">Play FishyLand free</Link>
            </div>
          </nav>
        </aside>
      </div>
    </MarketingShell>
  );
}

export const H2 = ({ children, id }) => <h2 id={id} className="font-display text-lg md:text-xl text-[var(--gold)] uppercase tracking-widest mt-8">{children}</h2>;
export const H3 = ({ children }) => <h3 className="font-display text-[15px] text-[#f4ead2] mt-4">{children}</h3>;
export const UL = ({ children }) => <ul className="list-disc pl-5 space-y-1">{children}</ul>;
export const Mail = ({ className = "text-[var(--gold)] hover:underline" }) => <a href={`mailto:${CONTACT_EMAIL}`} className={className} data-testid="contact-email-link">{CONTACT_EMAIL}</a>;
