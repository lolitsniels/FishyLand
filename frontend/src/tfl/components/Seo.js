/*
 * FishyLand, Copyright © 2026. All rights reserved.
 * This source code is proprietary and confidential. Unauthorized copying, reproduction,
 * modification, distribution or use of this file, in whole or in part, via any medium,
 * is strictly prohibited without prior written permission from the owner.
 */
import { useEffect } from "react";

const SITE_NAME = "FishyLand";
const SITE_URL = window.location.origin;
const OG_IMAGE = SITE_URL + "/art/og.jpg";

function setMeta(selector, attrs) {
  let el = document.head.querySelector(selector);
  if (!el) {
    el = document.createElement("meta");
    const [k, v] = Object.entries(attrs)[0];
    el.setAttribute(k, v);
    document.head.appendChild(el);
  }
  for (const [k, v] of Object.entries(attrs)) el.setAttribute(k, v);
  return el;
}

function setLink(rel, href) {
  let el = document.head.querySelector(`link[rel="${rel}"]`);
  if (!el) {
    el = document.createElement("link");
    el.setAttribute("rel", rel);
    document.head.appendChild(el);
  }
  el.setAttribute("href", href);
  return el;
}

function setJsonLd(id, data) {
  let el = document.head.querySelector(`script[data-seo="${id}"]`);
  if (!el) {
    el = document.createElement("script");
    el.setAttribute("type", "application/ld+json");
    el.setAttribute("data-seo", id);
    document.head.appendChild(el);
  }
  el.textContent = JSON.stringify(data);
  return el;
}

/**
 * Lightweight SEO helper. Sets <title>, description, canonical, OpenGraph and
 * optional JSON-LD schema for the current route. Cleans up JSON-LD on unmount so
 * different pages don't stack conflicting structured data.
 */
export default function Seo({ title, description, path = "/", image = OG_IMAGE, type = "article", jsonLd, alternates }) {
  useEffect(() => {
    document.querySelectorAll('link[rel="alternate"][hreflang]').forEach((l) => l.remove());
    (alternates || []).forEach(([lang, p]) => { const l = document.createElement("link"); l.rel = "alternate"; l.hreflang = lang; l.href = SITE_URL + p; document.head.appendChild(l); });
    const url = SITE_URL + path;
    const fullTitle = title.includes(SITE_NAME) ? title : `${title} | ${SITE_NAME}`;
    document.title = fullTitle;
    setMeta('meta[name="description"]', { name: "description", content: description });
    setMeta('meta[name="robots"]', { name: "robots", content: "index,follow,max-image-preview:large" });
    setLink("canonical", url);
    setMeta('meta[property="og:site_name"]', { property: "og:site_name", content: SITE_NAME });
    setMeta('meta[property="og:type"]', { property: "og:type", content: type });
    setMeta('meta[property="og:title"]', { property: "og:title", content: fullTitle });
    setMeta('meta[property="og:description"]', { property: "og:description", content: description });
    setMeta('meta[property="og:url"]', { property: "og:url", content: url });
    setMeta('meta[property="og:image"]', { property: "og:image", content: image });
    setMeta('meta[property="og:image:secure_url"]', { property: "og:image:secure_url", content: image });
    setMeta('meta[property="og:image:width"]', { property: "og:image:width", content: "1200" });
    setMeta('meta[property="og:image:height"]', { property: "og:image:height", content: "630" });
    setMeta('meta[name="twitter:card"]', { name: "twitter:card", content: "summary_large_image" });
    setMeta('meta[name="twitter:title"]', { name: "twitter:title", content: fullTitle });
    setMeta('meta[name="twitter:description"]', { name: "twitter:description", content: description });
    setMeta('meta[name="twitter:image"]', { name: "twitter:image", content: image });

    const created = [];
    if (jsonLd) {
      const arr = Array.isArray(jsonLd) ? jsonLd : [jsonLd];
      arr.forEach((d, i) => {
        const id = `page-${i}`;
        setJsonLd(id, d);
        created.push(id);
      });
    }
    return () => {
      created.forEach((id) => {
        const el = document.head.querySelector(`script[data-seo="${id}"]`);
        if (el) el.remove();
      });
    };
  }, [title, description, path, image, type, jsonLd]);
  return null;
}

export { SITE_NAME, SITE_URL };
