import { t as tt } from "../../i18n";
import { CopyField, useCopy } from "./shared";

const GROUPS = [
  ["Leaderboards & wide spots", [["728x90", 728, 90], ["970x250", 970, 250, "bmm"]]],
  ["Sidebars & posts", [["300x250", 300, 250], ["510x310", 510, 310, "bmm"], ["315x420", 315, 420, "bmm"]]],
  ["Small & tall", [["468x60", 468, 60], ["160x600", 160, 600]]],
];
const src = (size, bmm, anim) => bmm ? `/art/ad/browsermmorpg/tfl_${size}${anim ? ".gif" : "_last.png"}` : `/art/banners/v2/tfl_${size}.${anim ? "gif" : "png"}`;
const html = (link, file, w, h) => `<a href="${link}" target="_blank"><img src="${window.location.origin}${file}" width="${w}" height="${h}" alt="The Fishing Lands, free fishing MMO in your browser" style="border:0"></a>`;
const bb = (link, file) => `[url=${link}][img]${window.location.origin}${file}[/img][/url]`;

function Banner({ link, size, w, h, bmm, copied, copy }) {
  const show = Math.min(w, 728);
  return (
    <div className="space-y-1.5 pb-3 border-b border-[var(--border)] last:border-0" data-testid={`recruit-banner-${size}`}>
      <div className="flex items-center gap-2"><span className="tag num">{w}×{h}</span>{["510x310", "315x420"].includes(size) && <span className="text-[11px] text-[var(--muted)]">{tt("animated version shows players cheering in chat")}</span>}</div>
      <div className="flex flex-wrap gap-3 items-start">
        {[true, false].map((anim) => (
          <figure key={String(anim)} className="space-y-1 max-w-full">
            <div className="overflow-x-auto max-w-full"><img src={src(size, bmm, anim)} width={show} height={Math.round(h * show / w)} alt={`The Fishing Lands ${size}`} className="max-w-none border border-[var(--border-2)] pixelated" loading="lazy" /></div>
            <figcaption className="text-[10.5px] uppercase tracking-wider text-[var(--muted)]">{anim ? tt("Animated GIF") : tt("Static PNG")}</figcaption>
            <div className="flex flex-wrap gap-1">
              <button className="btn btn-sm" onClick={() => copy(`h-${size}-${anim}`, html(link, src(size, bmm, anim), w, h), "HTML")} data-testid={`recruit-banner-html-${size}-${anim ? "anim" : "static"}`}>{copied === `h-${size}-${anim}` ? tt("Copied") : tt("Copy HTML")}</button>
              <button className="btn btn-sm" onClick={() => copy(`b-${size}-${anim}`, bb(link, src(size, bmm, anim)), "BBCode")} data-testid={`recruit-banner-bb-${size}-${anim ? "anim" : "static"}`}>{copied === `b-${size}-${anim}` ? tt("Copied") : tt("Copy BBCode")}</button>
              <a className="btn btn-sm" href={src(size, bmm, anim)} download data-testid={`recruit-banner-dl-${size}-${anim ? "anim" : "static"}`}>{tt("Download")}</a>
            </div>
          </figure>
        ))}
      </div>
    </div>
  );
}

export default function RecruitBanners({ link }) {
  const [copied, copy] = useCopy();
  return (
    <div className="space-y-4 text-[12.5px]" data-testid="recruit-banners-tab">
      <p className="text-[var(--text-2)]">{tt("Every banner comes as a calm animated GIF and a static PNG. Copy the HTML (websites, blogs) or BBCode (forums): your recruit link is already built in, so anyone who clicks is recruited by you. Downloading the image? Post your link with it.")}</p>
      <CopyField id="link" value={link} label={tt("link")} copied={copied} copy={copy} testId="recruit-banners-link" gold />
      {GROUPS.map(([title, list]) => (
        <section key={title} className="space-y-3" data-testid={`recruit-banner-group-${title.split(" ")[0].toLowerCase()}`}>
          <div className="label">{tt(title)}</div>
          {list.map(([size, w, h, bmm]) => <Banner key={size} link={link} size={size} w={w} h={h} bmm={!!bmm} copied={copied} copy={copy} />)}
        </section>
      ))}
    </div>
  );
}
