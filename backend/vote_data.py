"""Toplist sites anglers can vote on, admin-managed in db.vote_sites. Each toplist passes our one-shot token differently."""
from urllib.parse import urlparse

TICKET_TTL_MIN = 60
DEFAULT_SITES = [
    {"key": "top100arena", "name": "Top100Arena", "url": "https://www.top100arena.com/listing/101050/vote", "cooldown_h": 12, "gold": 400, "pearls": 1},
    {"key": "mmohub", "name": "MMOHUB", "url": "https://mmohub.com/site/1210/vote", "cooldown_h": 12, "gold": 400, "pearls": 1},
    {"key": "gtop100", "name": "Gtop100", "url": "https://gtop100.com/MMORPG-And-MPOG/server-91935", "cooldown_h": 24, "gold": 400, "pearls": 1},
    {"key": "bbogd", "name": "BBOGD", "url": "http://bbogd.com/vote/thefishinglands", "cooldown_h": 24, "gold": 400, "pearls": 1},
    {"key": "browsermmorpg", "name": "BrowserMMORPG", "url": "https://browsermmorpg.com/vote.php?id=1501", "cooldown_h": 24, "gold": 400, "pearls": 1},
    {"key": "xtremetop100", "name": "XtremeTop100", "url": "https://www.xtremetop100.com/in.php?site=1132379611", "cooldown_h": 12, "gold": 400, "pearls": 1},
    {"key": "arenatop100", "name": "Arena-Top100", "url": "https://www.arena-top100.com/index.php?a=in&u=lolitsniels", "cooldown_h": 24, "gold": 400, "pearls": 1},
    {"key": "gametop", "name": "GameTop", "url": "https://gametop.gg/vote/the-fishing-lands", "cooldown_h": 24, "gold": 400, "pearls": 1},
    {"key": "topg", "name": "TopG", "url": "https://topg.org/games-mmorpg/game-685982#vote", "cooldown_h": 24, "gold": 400, "pearls": 1},
    {"key": "browsergamestop", "name": "BrowserGamesTop", "url": "https://browsergamestop.com/vote/the-fishing-lands", "cooldown_h": 24, "gold": 400, "pearls": 1},
]


def site_kind(url):
    host = urlparse(url).netloc.lower()
    if "mmohub" in host: return "mmohub"
    if "gtop100" in host: return "gtop100"
    if "arena-top100" in host: return "arenatop100"
    if "top100arena" in host: return "top100arena"
    if "bbogd" in host: return "bbogd"
    if "browsermmorpg" in host: return "browsermmorpg"
    if "xtremetop100" in host: return "xtremetop100"
    if "gametop" in host: return "gametop"
    if "topg.org" in host: return "topg"
    if "browsergamestop" in host: return "browsergamestop"
    return "generic"


def site_out(s):
    return {"key": s["key"], "name": s["name"], "url": s["url"], "cooldown_h": s["cooldown_h"], "gold": s["gold"], "pearls": s["pearls"],
            "kind": site_kind(s["url"]), "postback_suffix": "?postback=" if site_kind(s["url"]) == "top100arena" else ""}


def vote_url(site, token):
    u = site["url"]
    if "{token}" in u: return u.replace("{token}", token)
    kind = site_kind(u)
    if kind in ("mmohub", "bbogd"): return f"{u.rstrip('/')}/{token}"
    if kind == "gtop100": return f"{u}{'&' if '?' in u else '?'}vote=1&pingUsername={token}"
    if kind == "browsermmorpg": return f"{u}{'&' if '?' in u else '?'}userid={token}"
    if kind == "xtremetop100": return f"{u}{'&' if '?' in u else '?'}postback={token}"
    if kind == "arenatop100": return f"{u}{'&' if '?' in u else '?'}postback={token}"
    if kind in ("gametop", "browsergamestop"): return f"{u}{'&' if '?' in u else '?'}{'username' if kind == 'gametop' else 'userid'}={token}"
    if kind == "topg":  # https://topg.org/CATEGORY/game-SITEID-PARAMETER#vote, token rides in the path, TopG returns it as p_resp
        base, _, frag = u.partition("#")
        return f"{base.rstrip('/')}-{token}" + (f"#{frag}" if frag else "")
    return f"{u}{'&' if '?' in u else '?'}incentive={token}"
