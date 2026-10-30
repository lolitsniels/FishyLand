/*
 * The Fishing Lands. Copyright © 2026. All rights reserved.
 * This source code is proprietary and confidential. Unauthorized copying, reproduction,
 * modification, distribution or use of this file, in whole or in part, via any medium,
 * is strictly prohibited without prior written permission from the owner.
 */
import { useState } from "react";
import { toast } from "sonner";
import { Copy, Download } from "lucide-react";
import { Panel } from "../ui-bits";

// Promo art that ships with the site (frontend/public/art). Add new files here to list them.
const GROUPS = [
  ["Toplist GIF banners", [
    ["ad/gif/tfl_reddit_1080.gif", "Reddit square, 1080x1080"], ["ad/gif/tfl_reddit_540.gif", "Reddit square, 540x540 (smaller file)"],
    ["ad/gif/tfl_reddit_mmo_1080.gif", "Reddit 'MMO', 1080x1080"], ["ad/gif/tfl_reddit_multiplayer_1080.gif", "Reddit 'Online Multiplayer', 1080x1080"],
    ["ad/gif/tfl_reddit_playfree_1080.gif", "Reddit 'Play free in browser', 1080x1080"], ["ad/gif/tfl_reddit_nodownload_1080.gif", "Reddit 'No download', 1080x1080"],
    ["ad/gif/tfl_leap_864x384.gif", "Leaping fish, 864x384"], ["ad/gif/tfl_fight_864x384.gif", "Tension fight, 864x384"],
    ["ad/gif/tfl_leap_240x100.gif", "Leaping fish, 240x100"], ["ad/gif/tfl_fight_240x100.gif", "Tension fight, 240x100"],
    ["ad/gif/tfl_leap_180x75.gif", "Leaping fish, 180x75"], ["ad/gif/tfl_fight_180x75.gif", "Tension fight, 180x75"],
  ]],
  ["browsermmorpg.com slots", [
    ["ad/browsermmorpg/tfl_970x250.gif", "Billboard 970x250 (H1, H2, V1, C2)"], ["ad/browsermmorpg/tfl_970x250_last.png", "Billboard last frame"],
    ["ad/browsermmorpg/tfl_510x310.gif", "Wide panel 510x310 with chat (V2)"], ["ad/browsermmorpg/tfl_510x310_last.png", "Wide panel last frame"],
    ["ad/browsermmorpg/tfl_315x420.gif", "Tall panel 315x420 with chat (H3, C1)"], ["ad/browsermmorpg/tfl_315x420_last.png", "Tall panel last frame"],
  ]],
  ["Facebook ads (1200x628)", [["ad/fb_ad_shark_1200x628.jpg", "Cinder King"], ["ad/fb_ad_jade_1200x628.jpg", "Jade fish"], ["ad/fb_ad_kraken_1200x628.jpg", "Kraken team fight"]]],
  ["Tall ads (240x400)", [["ad/ad_240x400_jade.png", "Jade fish"], ["ad/ad_240x400_boss.png", "Cinder King"]]],
  ["Square ads (ChatGPT)", [["ad/chatgpt_ad_mmo_gold.jpg", "Gold MMO"], ["ad/chatgpt_ad_multiplayer_cyan.jpg", "Cyan Multiplayer"], ["ad/chatgpt_ad_boss_cinder_king.jpg", "Cinder King"], ["ad/chatgpt_ad_boss_old_grandfather.jpg", "Old Grandfather"], ["ad/chatgpt_ad_boss_harbour_kraken.jpg", "Harbour Kraken"]]],
  ["Gameplay", [["screens/fishing_anim.gif", "Real catch recording (GIF)"], ["screens/fishing_anim.webp", "Real catch recording (WebP)"]]],
  ["Discord", [["discord/discord_icon_fish.png", "Server icon, glowing fish"], ["discord/discord_icon_fl.png", "Server icon, FL letters"]]],
  ["Older banners", [["banners/banner_728x90_anim.gif", "728x90 animated"], ["banners/banner_300x250_anim.gif", "300x250 animated"], ["banners/banner_728x90.png", "728x90"], ["banners/banner_468x60.png", "468x60"], ["banners/banner_300x250.png", "300x250"], ["banners/banner_1200x630.jpg", "1200x630 share image"]]],
];

const slug = (p) => p.replace(/[^a-z0-9]+/gi, "-");

function Asset({ path, label }) {
  const [dim, setDim] = useState(null);
  const url = `${window.location.origin}/art/${path}`;
  const copy = () => navigator.clipboard.writeText(url).then(() => toast.success("Link copied")).catch(() => toast.error("Couldn't copy"));
  return (
    <div className="panel p-2 flex flex-col gap-1.5 min-w-0" data-testid={`media-${slug(path)}`}>
      <a href={url} target="_blank" rel="noreferrer" className="flex items-center justify-center bg-[#0c0a09] min-h-[110px] p-1">
        <img src={`/art/${path}`} alt={label} loading="lazy" className="max-w-full max-h-[200px] object-contain [image-rendering:pixelated]" onLoad={(e) => setDim(`${e.target.naturalWidth}x${e.target.naturalHeight}`)} />
      </a>
      <div className="text-[12px] text-[var(--text)] truncate">{label}</div>
      <div className="text-[10.5px] text-[var(--muted)] num truncate">{dim || "…"} · {path.split(".").pop().toUpperCase()}</div>
      <div className="flex gap-1.5">
        <button type="button" className="btn btn-sm flex-1 justify-center" onClick={copy} data-testid={`media-copy-${slug(path)}`}><Copy size={12} /> Link</button>
        <a href={`/art/${path}`} download className="btn btn-sm flex-1 justify-center" data-testid={`media-download-${slug(path)}`}><Download size={12} /> Save</a>
      </div>
    </div>
  );
}

export function MediaLibrary() {
  return (
    <div className="space-y-3" data-testid="admin-media">
      {GROUPS.map(([title, items]) => (
        <Panel key={title} title={title}>
          <div className="grid grid-cols-2 md:grid-cols-3 xl:grid-cols-4 gap-2">{items.map(([p, l]) => <Asset key={p} path={p} label={l} />)}</div>
        </Panel>
      ))}
    </div>
  );
}
