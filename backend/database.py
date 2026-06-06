import os
import uuid
import logging
import bcrypt
from datetime import datetime
from pymongo.errors import DuplicateKeyError

log = logging.getLogger("PodcastGen")

MONGO_URI = os.environ.get("MONGO_URI", "")
db = None
users_col = None
podcasts_col = None

if MONGO_URI:
    try:
        from pymongo import MongoClient
        from pymongo.server_api import ServerApi
        client = MongoClient(MONGO_URI, server_api=ServerApi("1"), serverSelectionTimeoutMS=5000)
        client.admin.command("ping")
        db = client["podcastai"]
        users_col    = db["users"]
        podcasts_col = db["podcasts"]
        users_col.create_index("email", unique=True)
        podcasts_col.create_index("user_id")
        podcasts_col.create_index("share_id", unique=True, sparse=True)
        print("✅  MongoDB connected.")
    except Exception as e:
        print(f"⚠️   MongoDB unavailable ({e}). Using in-memory storage.")
        db = None
else:
    print("⚠️   MONGO_URI not set. Using in-memory storage (data lost on restart).")
_mem_users: dict    = {}   
_mem_podcasts: list = []   
def hash_password(password: str) -> str:
    return bcrypt.hashpw(password.encode("utf-8"), bcrypt.gensalt()).decode("utf-8")

def verify_password(password: str, hashed: str) -> bool:
    return bcrypt.checkpw(password.encode("utf-8"), hashed.encode("utf-8"))

# User operations 
def db_find_user(email: str):
    if db is not None:
        return users_col.find_one({"email": email})
    return _mem_users.get(email)

def db_create_user(email: str, name: str, password: str) -> str:
    uid = str(uuid.uuid4())
    user = {
        "_id":        uid,
        "email":      email,
        "name":       name,
        "password":   hash_password(password),
        "created_at": datetime.utcnow().isoformat(),
    }
    if db is not None:
        try:
            users_col.insert_one(user)
        except DuplicateKeyError:
            raise ValueError("An account with this email already exists.")
    else:
        if email in _mem_users:
            raise ValueError("An account with this email already exists.")
        _mem_users[email] = user
    return uid

# Podcast operations
def db_get_user_podcasts(user_id: str) -> list:
    if db is not None:
        return list(
            podcasts_col.find({"user_id": user_id}, {"_id": 0})
            .sort("created_at", -1)
            .limit(100)
        )
    return [p for p in _mem_podcasts if p.get("user_id") == user_id]

def db_save_podcast(entry: dict):
    if db is not None:
        podcasts_col.insert_one(entry)
    else:
        _mem_podcasts.insert(0, entry)

def db_delete_podcast(podcast_id: str, user_id: str):
    if db is not None:
        podcasts_col.delete_one({"podcast_id": podcast_id, "user_id": user_id})
    else:
        global _mem_podcasts
        _mem_podcasts = [
            p for p in _mem_podcasts
            if not (p["podcast_id"] == podcast_id and p["user_id"] == user_id)
        ]

def db_find_by_share_id(share_id: str):
    if db is not None:
        return podcasts_col.find_one({"share_id": share_id}, {"_id": 0})
    return next((p for p in _mem_podcasts if p.get("share_id") == share_id), None)

def db_rename_podcast(podcast_id: str, user_id: str, new_title: str):
    if db is not None:
        podcasts_col.update_one(
            {"podcast_id": podcast_id, "user_id": user_id},
            {"$set": {"title": new_title}},
        )
    else:
        for p in _mem_podcasts:
            if p["podcast_id"] == podcast_id and p["user_id"] == user_id:
                p["title"] = new_title
                break