"""Recruit an Angler: rewards every 10 levels a recruit gains."""

MENTOR_TITLE = "Dockside Mentor"
APPLY_WINDOW_HOURS = 48        # existing accounts may still enter a code this long after creation
APPLY_MAX_CATCHES = 50         # ...as long as they have barely started



TITLE_LEVEL = 20               # recruit level that also earns the recruiter the Dockside Mentor title
LEVEL_STEP = 10                 # every 10 levels a recruit gains pays the recruiter again (forever)
RECRUIT_LEVEL_PEARLS = 3       # ...and the recruit gets this little bonus


def level_milestone(ms):
    """Recruiter reward for a recruit reaching level ms (10, 20, 30, ...): grows to Gold crate + 15 Pearls from Lv 30 on."""
    n = ms // LEVEL_STEP
    return {"crate": ["crate_bronze", "crate_silver", "crate_gold"][min(n, 3) - 1], "pearls": min(15, 5 * n)}


def reward_text(r):
    bits = []
    if r.get("gold"): bits.append(f"{r['gold']:,} gold")
    if r.get("pearls"): bits.append(f"{r['pearls']} Pearl{'s' if r['pearls'] != 1 else ''}")
    if r.get("title"): bits.append(f'the title "{r["title"]}"')
    return " + ".join(bits)
