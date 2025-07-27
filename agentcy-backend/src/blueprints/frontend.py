import os
from flask import Blueprint, send_from_directory, current_app

frontend_bp = Blueprint('frontend', __name__, static_folder='static')

@frontend_bp.route('/', defaults={'path': ''})
@frontend_bp.route('/<path:path>')
def serve_frontend(path):
    static_dir = os.path.join(current_app.root_path, 'static')
    file_path = os.path.join(static_dir, path)

    if path != "" and os.path.exists(file_path):
        return send_from_directory(static_dir, path)
    else:
        return send_from_directory(static_dir, 'index.html')
