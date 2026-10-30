import { useEffect, useState } from "react";
import { createPortal } from "react-dom";
import { X } from "lucide-react";
import { api } from "../../lib/api";
import { Markdown } from "../../lib/markdown";

const day = (iso) => new Date(iso).toLocaleDateString("en-GB", { day: "numeric", month: "short", year: "numeric" });
const img = (src) => (src?.startsWith("/api/") ? process.env.REACT_APP_BACKEND_URL + src : src);

function NewsModal({ n, onClose }) {
  useEffect(() => {
    const esc = (e) => e.key === "Escape" && onClose();
    document.addEventListener("keydown", esc); return () => document.removeEventListener("keydown", esc);
  }, [onClose]);
  return createPortal(
    <div className="lp-news-modal" onClick={onClose} data-testid="lp-news-modal">
      <article onClick={(e) => e.stopPropagation()} role="dialog" aria-modal="true" aria-label={n.title}>
        <button type="button" className="lp-news-close" onClick={onClose} aria-label="Close" data-testid="lp-news-modal-close"><X size={16} /></button>
        {n.image && <img src={img(n.image)} alt="" className="lp-notice-img" />}
        <div className="lp-notice-date">{day(n.created_at)} · {n.author}</div>
        <h3 className="lp-notice-title">{n.title}</h3>
        <Markdown text={n.body} className="lp-notice-body" />
      </article>
    </div>, document.body);
}

function Notice({ n, onOpen }) {
  const long = n.body.length > 200;
  const body = long ? n.body.slice(0, 200).replace(/\s+\S*$/, "") + "..." : n.body;
  return (
    <article className="lp-notice" data-testid={`lp-news-${n.id}`}>
      <span className="lp-tack" aria-hidden="true" />
      {n.image && <img src={img(n.image)} alt="" loading="lazy" className="lp-notice-img" />}
      <div className="lp-notice-date">{day(n.created_at)} · {n.author}</div>
      <h3 className="lp-notice-title">{n.title}</h3>
      <Markdown text={body} className="lp-notice-body" />
      {long && <button type="button" className="lp-link" onClick={() => onOpen(n)} data-testid={`lp-news-more-${n.id}`}>Read the rest</button>}
    </article>
  );
}

export function NewsBoard() {
  const [items, setItems] = useState(null);
  const [open, setOpen] = useState(null);
  useEffect(() => { api.get("/news/public?limit=3").then((r) => setItems(r.data.items)).catch(() => setItems([])); }, []);
  if (!items?.length) return null;
  return (
    <section className="lp-news" data-testid="lp-news">
      <h2 className="lp-h2">Game news</h2>
      <div className="lp-news-grid">{items.map((n) => <Notice key={n.id} n={n} onOpen={setOpen} />)}</div>
      {open && <NewsModal n={open} onClose={() => setOpen(null)} />}
    </section>
  );
}
