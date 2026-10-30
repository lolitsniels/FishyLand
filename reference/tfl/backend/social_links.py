"""Social media links (Discord, TikTok, YouTube, Instagram, Facebook, X, Reddit) shown in the game header; set and toggled from the Admin panel."""
from typing import Dict

from fastapi import Depends, HTTPException
from pydantic import BaseModel, Field

from server import api, db, require_admin

NETWORKS = ("discord", "tiktok", "youtube", "instagram", "facebook", "x", "reddit")
EMPTY = {n: {"url": "", "on": False} for n in NETWORKS}
LABEL = {"discord": "Discord", "tiktok": "TikTok", "youtube": "YouTube", "instagram": "Instagram", "facebook": "Facebook", "x": "X", "reddit": "Reddit"}
EMPTY["discord"] = {"url": "https://discord.gg/FHCVrbj4kJ", "on": True}  # the server players already use


async def social_links():
    doc = await db.meta.find_one({"key": "social_links"}) or {}
    return {n: {**EMPTY[n], **(doc.get("links") or {}).get(n, {})} for n in NETWORKS}


@api.get("/site/social")
async def public_social():
    return {n: v["url"] for n, v in (await social_links()).items() if v["on"] and v["url"]}


@api.get("/admin/social")
async def admin_social(admin=Depends(require_admin)):
    return await social_links()


class LinkIn(BaseModel):
    url: str = Field("", max_length=300)
    on: bool = False


@api.put("/admin/social")
async def save_social(body: Dict[str, LinkIn], admin=Depends(require_admin)):
    links = await social_links()
    for n in NETWORKS:
        v = body.get(n)
        if v is None: continue
        url = v.url.strip()
        if url and not url.startswith("https://"): raise HTTPException(400, f"The {LABEL[n]} link must start with https://")
        if v.on and not url: raise HTTPException(400, f"Add a {LABEL[n]} link before turning it on")
        links[n] = {"url": url, "on": v.on}
    await db.meta.update_one({"key": "social_links"}, {"$set": {"links": links}}, upsert=True)
    return links
