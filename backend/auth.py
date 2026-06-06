import os
import logging
from datetime import datetime, timezone, timedelta
from functools import wraps
import jwt
from flask import Blueprint, request, jsonify
from database import db_find_user, db_create_user, hash_password, verify_password
log = logging.getLogger("PodcastGen")
JWT_SECRET = os.environ.get("JWT_SECRET", "dev-secret-change-in-production-32chars")
auth_bp = Blueprint("auth", __name__)
def create_token(user_id: str, email: str, name: str) -> str:
    now = datetime.now(timezone.utc)
    payload = {
        "sub":   user_id,
        "email": email,
        "name":  name,
        "iat":   int(now.timestamp()),
        "exp":   int((now + timedelta(days=30)).timestamp()),
    }
    return jwt.encode(payload, JWT_SECRET, algorithm="HS256")


def decode_token(token: str) -> dict:
    return jwt.decode(token, JWT_SECRET, algorithms=["HS256"])

def require_auth(f):
    """Decorator: extracts and validates JWT from Authorization header."""
    @wraps(f)
    def decorated(*args, **kwargs):
        auth = request.headers.get("Authorization", "")
        if not auth.startswith("Bearer "):
            return jsonify({"error": "Authentication required."}), 401
        token = auth.split(" ", 1)[1]
        try:
            request.user = decode_token(token)
        except jwt.ExpiredSignatureError:
            return jsonify({"error": "Session expired. Please log in again."}), 401
        except jwt.InvalidTokenError:
            return jsonify({"error": "Invalid token."}), 401
        return f(*args, **kwargs)
    return decorated
@auth_bp.route("/api/auth/signup", methods=["POST"])
def signup():
    data     = request.get_json() or {}
    name     = (data.get("name")     or "").strip()
    email    = (data.get("email")    or "").strip().lower()
    password = (data.get("password") or "")
    if not name or not email or not password:
        return jsonify({"error": "Name, email and password are required."}), 400
    if len(password) < 8:
        return jsonify({"error": "Password must be at least 8 characters."}), 400
    if db_find_user(email):
        return jsonify({"error": "An account with this email already exists."}), 409
    try:
        uid = db_create_user(email, name, password)
    except ValueError as e:
        return jsonify({"error": str(e)}), 409
    except Exception as e:
        log.exception("Signup DB error: %s", e)
        return jsonify({"error": "Failed to create account. Please try again."}), 500
    token = create_token(uid, email, name)
    return jsonify({"token": token, "user": {"id": uid, "email": email, "name": name}}), 201
@auth_bp.route("/api/auth/login", methods=["POST"])
def login():
    data     = request.get_json() or {}
    email    = (data.get("email")    or "").strip().lower()
    password = (data.get("password") or "")
    user = db_find_user(email)
    if not user or not verify_password(password, user["password"]):
        return jsonify({"error": "Invalid email or password."}), 401
    uid   = str(user["_id"])
    token = create_token(uid, email, user["name"])
    return jsonify({"token": token, "user": {"id": uid, "email": email, "name": user["name"]}}), 200

@auth_bp.route("/api/auth/me", methods=["GET"])
@require_auth
def me():
    return jsonify({
        "user": {
            "id":    request.user["sub"],
            "email": request.user["email"],
            "name":  request.user["name"],
        }
    }), 200