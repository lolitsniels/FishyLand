"""Paint every FishyLand species (art/fish_v2/<id>.webp), rarest first. Safe to re-run: finished fish are skipped."""
import asyncio, base64, io, os, sys
from dotenv import load_dotenv
from PIL import Image
from rembg import remove, new_session
from emergentintegrations.llm.chat import LlmChat, UserMessage

sys.path.insert(0, "/app/backend")
load_dotenv("/app/backend/.env")
import game_data as g  # noqa: E402

OUT = "/app/frontend/public/art/fish_v2/"
os.makedirs(OUT, exist_ok=True)
KEY = os.environ["EMERGENT_LLM_KEY"]
SESSION = new_session("isnet-general-use")
ORDER = ["mythic", "legendary", "epic", "rare", "uncommon", "common"]
LOOK = {
    "common": "a natural, true-to-life look with clean shapes and friendly colours",
    "uncommon": "a natural look with brighter, richer colours and a little sparkle on the scales",
    "rare": "vivid shimmering scales, striking patterns and a soft magical sheen",
    "epic": "glowing fin edges, ornate flowing fins, jewel-bright colours and a faint magical aura",
    "legendary": "a majestic heroic look, gleaming golden highlights, radiant aura and dramatic flowing fins",
    "mythic": "a colossal, awe-inspiring monster of a fish shown huge and powerful, dramatic dynamic pose, glowing energy veins or runes, fierce eyes, epic boss-creature presence filling the whole frame",
}
WATER = {"millbrook": "a freshwater pond", "temple": "a jungle temple lake", "frozen": "an icy northern lake", "sunken": "the deep ocean",
         "coral": "a tropical coral reef", "cinder": "a volcanic lake", "ghostlight": "a misty haunted bay", "blackwater": "a dark swamp"}


def prompt(f):
    return (f"Game art of a single fish called '{f['name']}'. {f['blurb']} It lives in {WATER.get(f['water'], 'the ' + f['water'] + ' waters')}. "
            f"Rarity {f['rarity']}: {LOOK[f['rarity']]}. Full body side view facing right, whole fish visible with a little margin, "
            "painted stylized mobile game illustration for kids, bold clean outlines, appealing and fun, high detail, "
            "isolated on a plain flat pure white background, no water, no text, no border, no shadow on the ground.")


async def paint(f, sem):
    dst = f"{OUT}{f['id']}.webp"
    if os.path.exists(dst):
        return
    async with sem:
        for attempt in range(3):
            try:
                chat = LlmChat(api_key=KEY, session_id=f"fish-{f['id']}-{attempt}", system_message="You paint game art.")
                chat.with_model("gemini", "gemini-3.1-flash-image-preview").with_params(modalities=["image", "text"])
                _, imgs = await chat.send_message_multimodal_response(UserMessage(text=prompt(f)))
                if not imgs:
                    continue
                img = Image.open(io.BytesIO(base64.b64decode(imgs[0]["data"]))).convert("RGB")
                cut = await asyncio.to_thread(remove, img, session=SESSION, post_process_mask=True)
                cut = cut.crop(cut.getbbox())
                cut.thumbnail((720 if f["rarity"] in ("mythic", "legendary") else 560, 560), Image.LANCZOS)
                cut.save(dst, quality=88)
                print("ok", f["id"], f["rarity"], f["name"], flush=True)
                return
            except Exception as e:  # keep going; the run can be repeated
                print("err", f["id"], str(e)[:120], flush=True)
                await asyncio.sleep(3)


async def main():
    fish = sorted(g.FISH, key=lambda f: (ORDER.index(f["rarity"]), f["id"]))
    sem = asyncio.Semaphore(4)
    await asyncio.gather(*(paint(f, sem) for f in fish))
    print("done", len(os.listdir(OUT)), flush=True)

asyncio.run(main())
