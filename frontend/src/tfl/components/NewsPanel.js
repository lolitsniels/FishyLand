/*
 * FishyLand. Copyright © 2026. All rights reserved.
 * This source code is proprietary and confidential. Unauthorized copying, reproduction,
 * modification, distribution or use of this file, in whole or in part, via any medium,
 * is strictly prohibited without prior written permission from the owner.
 */
import { useCallback, useEffect, useRef, useState } from "react";
import { toast } from "sonner";
import { Bold, Italic, Heading2, List, Link as LinkIcon, Image as ImageIcon, Eye, Pin, Pencil, Trash2, Plus } from "lucide-react";
import { api, errMsg } from "../lib/api";
import { Markdown } from "../lib/markdown";
import { Panel, Empty } from "./ui-bits";
import { t as tt } from "../i18n";

// Harbour Notices: admin-published news / patch notes (markdown + images via /news/upload).
export function NewsPanel() {
  const [d, setD] = useState(null);
  const [editing, setEditing] = useState(null); // null | {} (new) | article
  const load = useCallback(() => api.get("/news").then((r) => setD(r.data)).catch(() => setD({ items: [], can_post: false })), []);
  useEffect(() => { load(); }, [load]);
  const remove = (n) => { if (!window.confirm(tt("Delete this notice?"))) return; api.delete(`/news/${n.id}`).then(load).catch((e) => toast.error(errMsg(e))); };
  return (
    <Panel icon="bell" title={tt("Harbour Notices")} testId="news-panel"
      right={d?.can_post && !editing ? <button className="btn btn-sm btn-gold inline-flex items-center gap-1" onClick={() => setEditing({})} data-testid="news-new-button"><Plus size={12} /> {tt("New notice")}</button> : null}>
      {editing && <NewsEditor article={editing} onDone={() => { setEditing(null); load(); }} onCancel={() => setEditing(null)} />}
      {!d ? <Empty>{tt("Loading…")}</Empty> : !d.items.length ? <Empty>{tt("No notices yet. The Harbourmaster will post patch notes and news here.")}</Empty> : (
        <div className="space-y-3 max-h-[560px] overflow-y-auto pr-1" data-testid="news-list">
          {d.items.map((n) => <Article key={n.id} n={n} admin={d.can_post} onEdit={() => setEditing(n)} onDelete={() => remove(n)} />)}
        </div>)}
    </Panel>
  );
}

function Article({ n, admin, onEdit, onDelete }) {
  const [open, setOpen] = useState(false);
  const long = n.body.length > 420;
  const body = open || !long ? n.body : n.body.slice(0, 420).replace(/\s+\S*$/, "") + "…";
  return (
    <article className="border border-[var(--border)] p-3 news-article" data-testid={`news-${n.id}`}>
      <header className="flex items-start gap-2">
        <div className="min-w-0 flex-1">
          <div className="font-display text-lg leading-tight text-[var(--gold)] inline-flex items-center gap-1.5">{n.pinned && <Pin size={12} className="text-[var(--gold-dim)]" />}{n.title}</div>
          <div className="text-[10.5px] uppercase tracking-widest text-[var(--muted)]">{n.author} · {new Date(n.created_at).toLocaleDateString([], { day: "numeric", month: "short", year: "numeric" })}{n.updated_at && <span> · {tt("edited")}</span>}</div>
        </div>
        {admin && <span className="inline-flex gap-1 shrink-0"><button className="btn btn-sm !px-1.5" onClick={onEdit} title={tt("Edit")} data-testid="news-edit"><Pencil size={12} /></button><button className="btn btn-sm !px-1.5" onClick={onDelete} title={tt("Delete")} data-testid="news-delete"><Trash2 size={12} /></button></span>}
      </header>
      {n.image && <img src={n.image.startsWith("/api/") ? process.env.REACT_APP_BACKEND_URL + n.image : n.image} alt="" className="md-img mt-2" loading="lazy" />}
      <Markdown text={body} className="mt-2 text-[12.5px]" />
      {long && <button className="text-[11.5px] underline text-[var(--text-2)] mt-1" onClick={() => setOpen((v) => !v)} data-testid="news-read-more">{open ? tt("Show less") : tt("Read more")}</button>}
    </article>
  );
}

function NewsEditor({ article, onDone, onCancel }) {
  const [title, setTitle] = useState(article.title || "");
  const [body, setBody] = useState(article.body || "");
  const [image, setImage] = useState(article.image || null);
  const [pinned, setPinned] = useState(!!article.pinned);
  const [discord, setDiscord] = useState(!article.id);
  const [preview, setPreview] = useState(false);
  const [busy, setBusy] = useState(false);
  const ta = useRef(null); const file = useRef(null);
  const wrap = (before, after = before, placeholder = "text") => {
    const el = ta.current; const s = el.selectionStart, e = el.selectionEnd; const sel = body.slice(s, e) || placeholder;
    const next = body.slice(0, s) + before + sel + after + body.slice(e); setBody(next);
    requestAnimationFrame(() => { el.focus(); el.setSelectionRange(s + before.length, s + before.length + sel.length); });
  };
  const linePrefix = (prefix) => { const el = ta.current; const s = body.lastIndexOf("\n", el.selectionStart - 1) + 1; setBody(body.slice(0, s) + prefix + body.slice(s)); };
  const upload = async (f, asCover) => {
    if (!f) return; setBusy(true);
    const fd = new FormData(); fd.append("file", f);
    try { const r = await api.post("/news/upload", fd, { headers: { "Content-Type": "multipart/form-data" } }); if (asCover) setImage(r.data.url); else setBody((b) => `${b}${b && !b.endsWith("\n") ? "\n" : ""}![${f.name}](${r.data.url})\n`); toast.success(tt("Image uploaded")); }
    catch (e) { toast.error(errMsg(e)); } finally { setBusy(false); }
  };
  const save = () => {
    setBusy(true);
    const req = article.id ? api.put(`/news/${article.id}`, { title, body, image, pinned }) : api.post("/news", { title, body, image, pinned, discord });
    req.then(() => { toast.success(tt("Notice published")); onDone(); }).catch((e) => toast.error(errMsg(e))).finally(() => setBusy(false));
  };
  const Tb = ({ onClick, title: t, children, testId }) => <button type="button" className="btn btn-sm !px-2" onClick={onClick} title={t} data-testid={testId}>{children}</button>;
  return (
    <div className="border border-[var(--gold-dim)] p-3 mb-3 space-y-2 text-[12.5px]" data-testid="news-editor">
      <input className="input w-full" placeholder={tt("Title")} value={title} onChange={(e) => setTitle(e.target.value)} maxLength={120} data-testid="news-title-input" />
      <div className="flex flex-wrap gap-1 items-center">
        <Tb onClick={() => wrap("**")} title={tt("Bold")} testId="news-tb-bold"><Bold size={13} /></Tb>
        <Tb onClick={() => wrap("*")} title={tt("Italic")} testId="news-tb-italic"><Italic size={13} /></Tb>
        <Tb onClick={() => linePrefix("## ")} title={tt("Heading")} testId="news-tb-heading"><Heading2 size={13} /></Tb>
        <Tb onClick={() => linePrefix("- ")} title={tt("Bullet list")} testId="news-tb-list"><List size={13} /></Tb>
        <Tb onClick={() => wrap("[", "](https://)", tt("link text"))} title={tt("Link")} testId="news-tb-link"><LinkIcon size={13} /></Tb>
        <Tb onClick={() => file.current?.click()} title={tt("Insert image")} testId="news-tb-image"><ImageIcon size={13} /></Tb>
        <input ref={file} type="file" accept="image/png,image/jpeg,image/gif,image/webp" className="hidden" onChange={(e) => { upload(e.target.files?.[0], false); e.target.value = ""; }} data-testid="news-image-file" />
        <label className="btn btn-sm cursor-pointer">{image ? tt("Change cover image") : tt("Cover image")}<input type="file" accept="image/*" className="hidden" onChange={(e) => { upload(e.target.files?.[0], true); e.target.value = ""; }} data-testid="news-cover-file" /></label>
        {image && <button type="button" className="text-[11px] underline text-[var(--muted)]" onClick={() => setImage(null)}>{tt("remove cover")}</button>}
        {!article.id && <label className="inline-flex items-center gap-1 text-[11.5px] text-[var(--text-2)] ml-auto"><input type="checkbox" checked={discord} onChange={(e) => setDiscord(e.target.checked)} data-testid="news-discord" /> {tt("Post to Discord")}</label>}<label className="inline-flex items-center gap-1 text-[11.5px] text-[var(--text-2)] "><input type="checkbox" checked={pinned} onChange={(e) => setPinned(e.target.checked)} data-testid="news-pinned" /> <Pin size={11} /> {tt("Pin to top")}</label>
        <Tb onClick={() => setPreview((v) => !v)} title={tt("Preview")} testId="news-tb-preview"><Eye size={13} /></Tb>
      </div>
      {preview ? <div className="border border-[var(--border)] p-2 min-h-[140px]" data-testid="news-preview">{image && <img src={image.startsWith("/api/") ? process.env.REACT_APP_BACKEND_URL + image : image} alt="" className="md-img" />}<Markdown text={body} /></div>
        : <textarea ref={ta} className="input w-full min-h-[180px] font-mono text-[12px]" placeholder={tt("Write here. **bold**, *italic*, ## heading, - list, [link](https://…). Use the image button to upload pictures.")} value={body} onChange={(e) => setBody(e.target.value)} data-testid="news-body-input" />}
      <div className="flex gap-2 justify-end">
        <button className="btn btn-sm" onClick={onCancel} data-testid="news-cancel">{tt("Cancel")}</button>
        <button className="btn btn-sm btn-gold" disabled={busy || title.trim().length < 2 || !body.trim()} onClick={save} data-testid="news-save">{article.id ? tt("Save changes") : tt("Publish")}</button>
      </div>
    </div>
  );
}
