import logging
import os

from fastapi import FastAPI
from starlette.middleware.cors import CORSMiddleware

from db import db, client
import auth
import game

app = FastAPI(title="Fishing Realm")
app.include_router(auth.router)
app.include_router(game.router)

app.add_middleware(
    CORSMiddleware,
    allow_credentials=False,
    allow_origins=os.environ["CORS_ORIGINS"].split(","),
    allow_methods=["*"],
    allow_headers=["*"],
)

logging.basicConfig(level=logging.INFO, format="%(asctime)s - %(name)s - %(levelname)s - %(message)s")


@app.get("/api/")
async def root():
    return {"message": "Fishing Realm API"}


@app.on_event("startup")
async def startup():
    await db.users.create_index("email", unique=True, partialFilterExpression={"email": {"$type": "string"}})
    await db.users.create_index("username_lower", unique=True)
    await db.login_attempts.create_index("identifier")
    await db.encounters.create_index([("user_id", 1), ("used", 1)])
    await db.fish_inventory.create_index([("user_id", 1), ("caught_at", -1)])
    await db.fishdex.create_index([("user_id", 1), ("species_id", 1)], unique=True)
    await db.catch_log.create_index("user_id")
    await db.world_feed.create_index("created_at", expireAfterSeconds=172800)
    await auth.seed_admin()


@app.on_event("shutdown")
async def shutdown():
    client.close()
