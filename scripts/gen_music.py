import os, sys, time, urllib.request
import requests
from concurrent.futures import ThreadPoolExecutor

KEY = os.environ["EMERGENT_LLM_KEY"]
# Fal Universal Key supports queue inference through Emergent proxy, not Platform APIs.
BASE = os.environ.get("INTEGRATION_PROXY_URL", "https://integrations.emergentagent.com").rstrip("/") + "/api/v1/fal"
EP = "fal-ai/elevenlabs/music"
OUT = "/app/frontend/public/audio/"
H = {"Authorization": f"Bearer {KEY}", "Content-Type": "application/json"}
LOOP = " Instrumental game background music loop, gentle and unobtrusive, no vocals, consistent energy start to end so it loops seamlessly, no big intro or ending."
TRACKS = {
    "harbour": "Cheerful seaside harbour town theme for a cozy fishing game: accordion, ukulele, light acoustic guitar, soft glockenspiel, distant shanty feel, 100 bpm.",
    "millbrook": "Peaceful village pond morning: plucked acoustic guitar, flute, soft strings, birdsong-like woodwinds, relaxed pastoral, 85 bpm.",
    "willow": "Lazy lowland river afternoon: fingerpicked guitar, warm clarinet, light brushed percussion, folk, flowing and calm, 90 bpm.",
    "greyfell": "Cold misty glacial highland lake: solo celtic tin whistle and harp, low cello drone, sparse and atmospheric, slow 70 bpm.",
    "saltmarsh": "Brackish estuary at dusk: soft marimba, muted trumpet, bluesy slide guitar, gentle lapping rhythm, mellow, 80 bpm.",
    "harrow": "Wind-beaten rocky sea cliffs: bold sea-shanty fiddle and concertina, deep drums like breakers, adventurous, 110 bpm.",
    "coral": "Sunny tropical coral reef: steel drums, marimba, light bossa nova guitar, shaker, bright and breezy, 105 bpm.",
    "blackwater": "Humid dark mangrove swamp: low marimba, kalimba, frog-like woodblocks, mysterious bass, tribal hand drums, slow groove 80 bpm.",
    "frozen": "Arctic ice fishing under the aurora: twinkling celesta and music box, soft choir pads, airy synth shimmer, serene, 70 bpm.",
    "sunken": "Open ocean at night far from land: deep warm synth pads, slow piano, sonar-like pings, vast and calm, 65 bpm.",
    "ghostlight": "Glowing underground crystal cavern: ethereal harp arpeggios, glass harmonica, distant water drips, eerie but beautiful, 72 bpm.",
    "temple": "Ancient jungle temple lake: bamboo flute, koto, gentle tribal percussion, mysterious and serene, 88 bpm.",
    "cinder": "Volcanic deep-sea trench: deep taiko drums, low brass, rumbling synth bass, tense and epic but restrained, 95 bpm.",
    "duel_pier": "Friendly competitive fishing contest: upbeat brass and snare, playful pizzicato strings, energetic sports-game feel, 125 bpm.",
    "fight": "Thrilling fishing battle music for a kids fishing game: driving fast percussion and taiko, pulsing staccato strings, heroic brass stabs, rising tension and excitement, adventurous and fun not scary, 140 bpm.",
    "crew_island": "Relaxed private island hangout: ukulele, soft steel guitar, light hand percussion, warm and happy, 95 bpm.",
}


def _get(url):
    for i in range(5):
        try:
            return requests.get(url, headers=H, timeout=60)
        except (requests.ConnectTimeout, requests.ReadTimeout, requests.ConnectionError):
            time.sleep(2 ** i)
    raise RuntimeError("poll failed")


def gen(name, prompt):
    if os.path.exists(OUT + name + ".mp3"):
        return name, "exists"
    r = requests.post(f"{BASE}/proxy", headers={**H, "X-Fal-Target-Url": f"https://queue.fal.run/{EP}"},
                      json={"prompt": prompt + LOOP, "music_length_ms": 90000, "force_instrumental": True, "output_format": "mp3_44100_128"}, timeout=60)
    r.raise_for_status()
    sub = r.json()
    end = time.time() + 900
    while time.time() < end:
        s = _get(sub["status_url"]).json()
        st = (s.get("status") or "").upper()
        if st in ("COMPLETED", "OK"):
            res = _get(sub["response_url"]).json()
            urllib.request.urlretrieve(res["audio"]["url"], OUT + name + ".mp3")
            return name, "ok"
        if st in ("FAILED", "ERROR", "CANCELLED", "CANCELED"):
            return name, f"failed {s}"
        time.sleep(4)
    return name, "timeout"


if __name__ == "__main__":
    os.makedirs(OUT, exist_ok=True)
    names = sys.argv[1:] or list(TRACKS)
    with ThreadPoolExecutor(5) as ex:
        for res in ex.map(lambda n: gen(n, TRACKS[n]), names):
            print(*res, flush=True)
