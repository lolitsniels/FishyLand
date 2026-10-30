/*
 * FishyLand, Copyright © 2026. All rights reserved.
 * This source code is proprietary and confidential. Unauthorized copying, reproduction,
 * modification, distribution or use of this file, in whole or in part, via any medium,
 * is strictly prohibited without prior written permission from the owner.
 */
// Tiny, safe markdown → React (no HTML passthrough). Supports # headings, **bold**, *italic*, [text](url), ![alt](url), - lists, > quotes, paragraphs.
const API = process.env.REACT_APP_BACKEND_URL;
const src = (u) => (u.startsWith("/api/") ? API + u : u);
const safeHref = (u) => (/^(https?:\/\/|\/)/i.test(u) ? u : "#");

function inline(text, key = 0) {
  const out = [];
  const re = /(!\[([^\]]*)\]\(([^)\s]+)\))|(\[([^\]]+)\]\(([^)\s]+)\))|(\*\*([^*]+)\*\*)|(\*([^*]+)\*)/g;
  let last = 0, m, i = 0;
  while ((m = re.exec(text))) {
    if (m.index > last) out.push(text.slice(last, m.index));
    if (m[1]) out.push(<img key={`${key}-${i++}`} src={src(m[3])} alt={m[2]} className="md-img" loading="lazy" />);
    else if (m[4]) out.push(<a key={`${key}-${i++}`} href={safeHref(m[6])} target={m[6].startsWith("/") ? undefined : "_blank"} rel="noreferrer" className="underline text-[var(--gold)]">{m[5]}</a>);
    else if (m[7]) out.push(<strong key={`${key}-${i++}`}>{m[8]}</strong>);
    else if (m[9]) out.push(<em key={`${key}-${i++}`}>{m[10]}</em>);
    last = m.index + m[0].length;
  }
  if (last < text.length) out.push(text.slice(last));
  return out;
}

export function Markdown({ text = "", className = "" }) {
  const blocks = [];
  const lines = text.replace(/\r/g, "").split("\n");
  let i = 0, k = 0;
  while (i < lines.length) {
    const l = lines[i];
    if (!l.trim()) { i++; continue; }
    const h = /^(#{1,3})\s+(.*)$/.exec(l);
    if (h) { const Tag = `h${h[1].length + 1}`; blocks.push(<Tag key={k++} className={`md-h md-h${h[1].length}`}>{inline(h[2], k)}</Tag>); i++; continue; }
    if (/^\s*[-*]\s+/.test(l)) {
      const items = [];
      while (i < lines.length && /^\s*[-*]\s+/.test(lines[i])) items.push(<li key={items.length}>{inline(lines[i].replace(/^\s*[-*]\s+/, ""), k)}</li>), i++;
      blocks.push(<ul key={k++} className="md-ul">{items}</ul>); continue;
    }
    if (/^>\s?/.test(l)) {
      const q = [];
      while (i < lines.length && /^>\s?/.test(lines[i])) q.push(lines[i].replace(/^>\s?/, "")), i++;
      blocks.push(<blockquote key={k++} className="md-quote">{inline(q.join(" "), k)}</blockquote>); continue;
    }
    const para = [];
    while (i < lines.length && lines[i].trim() && !/^(#{1,3})\s|^\s*[-*]\s+|^>\s?/.test(lines[i])) para.push(lines[i]), i++;
    blocks.push(<p key={k++} className="md-p">{para.flatMap((pl, j) => (j ? [<br key={`b${j}`} />, ...inline(pl, k + j)] : inline(pl, k)))}</p>);
  }
  return <div className={`md ${className}`}>{blocks}</div>;
}
