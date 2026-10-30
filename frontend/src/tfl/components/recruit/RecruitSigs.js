import { t as tt } from "../../i18n";
import { CopyField, useCopy } from "./shared";

const ORIGIN = window.location.origin;  // same host serves /api, so shared images point at the live domain

function Item({ id, title, desc, img, w, h, link, copied, copy }) {
  const html = `<a href="${link}" target="_blank"><img src="${img}" width="${w}" height="${h}" alt="My angler in The Fishing Lands" style="border:0"></a>`;
  const bb = `[url=${link}][img]${img}[/img][/url]`;
  return (
    <section className="space-y-2" data-testid={`recruit-${id}`}>
      <div className="label">{title} <span className="num normal-case tracking-normal text-[var(--muted)]">· {w}×{h}</span></div>
      <div className="overflow-x-auto"><img src={img} width={w} height={h} alt={title} className="max-w-none pixelated" data-testid={`recruit-${id}-img`} /></div>
      <div className="text-[11.5px] text-[var(--muted)]">{desc}</div>
      <CopyField id={`${id}-bb`} value={bb} label="BBCode" copied={copied} copy={copy} testId={`recruit-${id}-bb`} />
      <CopyField id={`${id}-html`} value={html} label="HTML" copied={copied} copy={copy} testId={`recruit-${id}-html`} />
    </section>
  );
}

export default function RecruitSigs({ link, user }) {
  const [copied, copy] = useCopy();
  const name = encodeURIComponent(user.username);
  return (
    <div className="space-y-5 text-[12.5px]" data-testid="recruit-sigs-tab">
      <p className="text-[var(--text-2)]">{tt("Your signature and userbar update themselves with your level, fish caught, best catch and crew (refreshed every 10 minutes). Put one in your forum signature, Steam or Discord profile, and every post you make becomes a recruit link.")}</p>
      <Item id="signature" title={tt("Forum signature")} desc={tt("Fits most forum signature limits (max 468×100).")} img={`${ORIGIN}/api/sig/${name}.png`} w={468} h={100} link={link} copied={copied} copy={copy} />
      <Item id="userbar" title={tt("Userbar")} desc={tt("The classic thin forum bar, great next to other userbars.")} img={`${ORIGIN}/api/userbar/${name}.png`} w={350} h={19} link={link} copied={copied} copy={copy} />
    </div>
  );
}
