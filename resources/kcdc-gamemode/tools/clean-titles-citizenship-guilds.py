"""Clears everybody's titles (nobility included), citizenship and guild, and nothing else (2026-10-31, the user: "vamos tirar todo título do momento, inclusive nobreza e etc, além da
cidadania e guilda de todo mundo, mas mantemos nível e item e tudo, só limpar essas coisas para a próxima atualização").

    python3 clean-titles-citizenship-guilds.py <server folder> [--apply]

Run it with the server STOPPED (the modules hold their files in memory and write them back). Without --apply it only counts. With it, every file it changes is first copied to
`playerdata/before-cleanup-<stamp>/` beside the others. What it does, file by file of `playerdata/`:

  titles.json            every holder's grants and the title they wear are dropped (the holders' names stay, so a name is never lost)
  social.json            socialStatus -> plebeius and guildId -> null for every record; the faction, the showcase and the rest stay (a noble's standing came from the titles)
  citizenship.json       citizens -> {}; the towns closed by their lords and the lands already handed over stay
  guild-grants.json      grants -> {} (who handed which guild to whom)
  guild-learned.json     learned -> [] (so everybody's first trade from a vendor is free again)

Levels, items, chests, properties, horses, families, factions, the lords of the regions (`regions.json`), the wars and the vendors' shops are not touched.
"""

import json
import os
import shutil
import sys
import time

root = sys.argv[1]
apply = "--apply" in sys.argv
data = os.path.join(root, "playerdata")
stamp = time.strftime("%Y%m%d-%H%M%S", time.gmtime())
backup = os.path.join(data, f"before-cleanup-{stamp}")


def load(name):
    path = os.path.join(data, name)
    if not os.path.exists(path):
        print(f"{name}: not there, nothing to do")
        return None, path
    with open(path, encoding="utf-8") as handle:
        return json.load(handle), path


def save(path, value):
    if not apply:
        return
    os.makedirs(backup, exist_ok=True)
    shutil.copy2(path, os.path.join(backup, os.path.basename(path)))
    with open(path, "w", encoding="utf-8") as handle:
        json.dump(value, handle, indent=2, ensure_ascii=False)
        handle.write("\n")


titles, path = load("titles.json")
if titles is not None:
    holders = titles.get("holders", {})
    grants = sum(len(h.get("grants", [])) for h in holders.values())
    for holder in holders.values():
        holder["grants"] = []
        holder.pop("shown", None)
    print(f"titles.json: {grants} title(s) of {len(holders)} holder(s) cleared")
    save(path, titles)

social, path = load("social.json")
if social is not None:
    nobles = sum(1 for r in social.values() if r.get("socialStatus") != "plebeius")
    guilded = sum(1 for r in social.values() if r.get("guildId"))
    for record in social.values():
        record["socialStatus"] = "plebeius"
        record["guildId"] = None
    print(f"social.json: {nobles} noble(s) back to plebeius, {guilded} guild(s) cleared, of {len(social)} record(s)")
    save(path, social)

citizens, path = load("citizenship.json")
if citizens is not None:
    count = len(citizens.get("citizens", {}))
    citizens["citizens"] = {}
    print(f"citizenship.json: {count} citizenship(s) cleared")
    save(path, citizens)

grants, path = load("guild-grants.json")
if grants is not None:
    count = len(grants.get("grants", {}))
    grants["grants"] = {}
    print(f"guild-grants.json: {count} grant(s) cleared")
    save(path, grants)

learned, path = load("guild-learned.json")
if learned is not None:
    count = len(learned.get("learned", []))
    learned["learned"] = []
    print(f"guild-learned.json: {count} learned trade(s) cleared")
    save(path, learned)

print("applied; the originals are in " + backup if apply else "dry run: nothing written (add --apply)")
