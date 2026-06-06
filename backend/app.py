import os
import uuid
import logging
from datetime import datetime
from flask import Flask, request, jsonify, send_from_directory
from flask_cors import CORS
from dotenv import load_dotenv
from auth import auth_bp, require_auth
from database import (
    db,
    db_get_user_podcasts,
    db_save_podcast,
    db_delete_podcast,
    db_find_by_share_id,
    db_rename_podcast,
)
from podcast_engine import run_pipeline, OCR_AVAILABLE
load_dotenv()
logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s  [%(levelname)s]  %(message)s",
    datefmt="%H:%M:%S",
)
log = logging.getLogger("PodcastGen")

BASE_DIR     = os.path.dirname(os.path.abspath(__file__))   
FRONTEND_DIR = os.path.join(BASE_DIR, "..", "frontend")     
FRONTEND_DIR = os.path.abspath(FRONTEND_DIR)
app = Flask(
    __name__,
    static_folder=FRONTEND_DIR,
    static_url_path="",       
)
app.secret_key = os.environ.get("FLASK_SECRET_KEY", "dev-flask-secret")
app.register_blueprint(auth_bp)
CORS(app, supports_credentials=True, resources={r"/api/*": {"origins": "*"}})
ALLOWED_EXTENSIONS = {"pdf", "txt", "docx", "doc", "ppt", "pptx"}
def allowed_file(filename: str) -> bool:
    return "." in filename and filename.rsplit(".", 1)[1].lower() in ALLOWED_EXTENSIONS
@app.route("/api/podcasts", methods=["GET"])
@require_auth
def get_podcasts():
    items = db_get_user_podcasts(request.user["sub"])
    result = [
        {
            "podcast_id":     p.get("podcast_id"),
            "title":          p.get("title") or p.get("filename", "Untitled"),
            "filename":       p.get("filename"),
            "created_at":     p.get("created_at"),
            "share_id":       p.get("share_id"),
            "script_preview": (p.get("script") or "")[:200],
        }
        for p in items
    ]
    return jsonify({"podcasts": result}), 200
@app.route("/api/podcasts/<podcast_id>", methods=["GET"])
@require_auth
def get_podcast(podcast_id):
    items = db_get_user_podcasts(request.user["sub"])
    p = next((x for x in items if x.get("podcast_id") == podcast_id), None)
    if not p:
        return jsonify({"error": "Not found."}), 404
    return jsonify({"podcast": {k: v for k, v in p.items() if k != "_id"}}), 200
@app.route("/api/podcasts/<podcast_id>", methods=["DELETE"])
@require_auth
def delete_podcast(podcast_id):
    db_delete_podcast(podcast_id, request.user["sub"])
    return jsonify({"ok": True}), 200

@app.route("/api/podcasts/<podcast_id>/rename", methods=["PATCH"])
@require_auth
def rename_podcast(podcast_id):
    data      = request.get_json() or {}
    new_title = (data.get("title") or "").strip()
    if not new_title:
        return jsonify({"error": "Title is required."}), 400
    db_rename_podcast(podcast_id, request.user["sub"], new_title)
    return jsonify({"ok": True}), 200

@app.route("/api/share/<share_id>", methods=["GET"])
def get_shared(share_id):
    """Public endpoint — no auth required."""
    p = db_find_by_share_id(share_id)
    if not p:
        return jsonify({"error": "Shared podcast not found."}), 404
    return jsonify({
        "title":      p.get("title") or p.get("filename", "Podcast"),
        "script":     p.get("script", ""),
        "audio":      p.get("audio", ""),
        "filename":   p.get("filename", ""),
        "created_at": p.get("created_at", ""),
    }), 200

@app.route("/api/generate-podcast", methods=["POST"])
@require_auth
def generate_podcast():
    if "file" not in request.files:
        return jsonify({"error": "No file in request."}), 400
    f = request.files["file"]
    if not f.filename or not allowed_file(f.filename):
        return jsonify({"error": "Unsupported file type. Use PDF, TXT, DOCX, or PPTX."}), 400
    file_bytes = f.read()
    if not file_bytes:
        return jsonify({"error": "Empty file."}), 400
    if len(file_bytes) > 10 * 1024 * 1024:
        return jsonify({"error": "File exceeds 10 MB limit."}), 413
    log.info("File: %s (%.1f KB) — user: %s",
             f.filename, len(file_bytes) / 1024, request.user["email"])
    try:
        result = run_pipeline(file_bytes, f.filename)
    except ValueError as e:
        return jsonify({"error": str(e)}), 422
    except RuntimeError as e:
        return jsonify({"error": str(e)}), 502
    except Exception as e:
        log.exception("Pipeline error: %s", e)
        return jsonify({"error": "Internal server error."}), 500
    share_id   = str(uuid.uuid4()).replace("-", "")[:16]
    podcast_id = str(uuid.uuid4())
    entry = {
        "podcast_id":  podcast_id,
        "user_id":     request.user["sub"],
        "filename":    f.filename,
        "title":       f.filename.rsplit(".", 1)[0],
        "script":      result["script"],
        "audio":       result["audio"],
        "created_at":  datetime.utcnow().isoformat(),
        "share_id":    share_id,
    }
    db_save_podcast(entry)
    log.info("Saved podcast %s (share: %s)", podcast_id, share_id)
    return jsonify({
        "podcast_id": podcast_id,
        "script":     result["script"],
        "audio":      result["audio"],
        "share_id":   share_id,
    }), 200
@app.route("/api/status", methods=["GET"])
def status():
    return jsonify({
        "status":      "online",
        "service":     "AI Podcast Generator",
        "ocr_support": OCR_AVAILABLE,
        "db":          "mongodb" if db is not None else "memory",
    })

@app.route("/", defaults={"path": ""})
@app.route("/<path:path>")
def serve_frontend(path):
    
    target = os.path.join(FRONTEND_DIR, path)
    if path and os.path.isfile(target):
        return send_from_directory(FRONTEND_DIR, path)
    
    return send_from_directory(FRONTEND_DIR, "index.html")
if __name__ == "__main__":
    port = int(os.environ.get("PORT", 5000))
    print("\n" + "=" * 55)
    print("  🎙  AI PODCAST GENERATOR")
    print(f"  🌐  http://localhost:{port}")
    print(f"  🗄   DB: {'MongoDB Atlas' if db is not None else 'In-memory (set MONGO_URI for persistence)'}")
    print(f"  🔍  OCR: {'Enabled' if OCR_AVAILABLE else 'Disabled (install tesseract)'}")
    print("  ✅  API keys loaded from .env")
    print("=" * 55 + "\n")
    app.run(
        host="0.0.0.0",
        port=port,
        debug=os.environ.get("FLASK_ENV") == "development",
    )