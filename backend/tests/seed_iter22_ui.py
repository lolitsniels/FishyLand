# Seed helper for iter22 UI: crew 'TEST Vault UI' with Niels leader + TestAngler2 member, bank 30000. Pass "cleanup" to remove.
import os, sys, json, requests
from bson import ObjectId
from pymongo import MongoClient

API = os.environ["REACT_APP_BACKEND_URL"].rstrip("/") + "/api"
env = dict(l.strip().split("=", 1) for l in open("/app/backend/.env") if "=" in l)
db = MongoClient(env["MONGO_URL"].strip('"'))[env["DB_NAME"].strip('"')]


def login(u, p):
    return requests.post(f"{API}/auth/login", json={"username": u, "password": p}).json()["token"]


tn, t2 = login("Niels", "Niels112233!"), login("TestAngler2", "Angler#2026")
H = lambda t: {"Authorization": f"Bearer {t}"}
for t in (t2, tn):
    me = requests.get(f"{API}/auth/me", headers=H(t)).json()
    c = me.get("user", me).get("crew")
    if c: requests.post(f"{API}/crews/{c['id']}/leave", headers=H(t))
if len(sys.argv) > 1 and sys.argv[1] == "cleanup":
    print("cleaned"); sys.exit()
db.users.update_one({"username": "TestAngler2"}, {"$max": {"gold": 50000}})
c = requests.post(f"{API}/crews", headers=H(tn), json={"name": "TEST Vault UI", "tag": "TVU", "desc": "t", "open": True}).json()
requests.post(f"{API}/crews/{c['id']}/join", headers=H(t2))
db.crews.update_one({"_id": ObjectId(c["id"])}, {"$set": {"bank": 30000}})
print(json.dumps({"crew": c["id"], "niels": tn, "ta2": t2}))
