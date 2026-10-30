import os
import uuid
import pytest
import requests

ROOT = os.environ.get("REACT_APP_BACKEND_URL", "").rstrip("/")
if not ROOT:
    for line in open("/app/frontend/.env"):
        if line.startswith("REACT_APP_BACKEND_URL="):
            ROOT = line.split("=", 1)[1].strip().rstrip("/")
BASE = f"{ROOT}/api"


# Name profanity filter (register)
@pytest.mark.parametrize("name", ["fuckboy1", "F_u_c_k"])
def test_register_profane_name_rejected(name):
    r = requests.post(f"{BASE}/auth/register", json={"username": name, "email": f"test_{uuid.uuid4().hex[:6]}@example.com", "password": "secret123"})
    assert r.status_code == 400
    assert r.json()["detail"] == "Please choose a different hero name"


def test_register_clean_name_ok():
    tag = uuid.uuid4().hex[:6]
    r = requests.post(f"{BASE}/auth/register", json={"username": f"Hero{tag}", "email": f"test_ok_{tag}@example.com", "password": "secret123"})
    assert r.status_code == 200
    assert r.json()["player"]["username"] == f"Hero{tag}"


# Static art served (root) and under /play (web-mode route uses relative 'art/...' URLs)
def test_art_root_is_image():
    r = requests.get(f"{ROOT}/art/wings.png")
    assert r.status_code == 200 and r.headers["content-type"].startswith("image/")


def test_art_relative_under_play_route_is_image():
    # Web mode resolves 'art/wings.png' against /play -> /play/art/wings.png. Currently SPA html (BUG).
    r = requests.get(f"{ROOT}/play/art/wings.png")
    assert r.headers["content-type"].startswith("image/"), f"got {r.headers['content-type']}"
