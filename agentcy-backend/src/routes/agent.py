import os
from flask import Blueprint, jsonify, request, current_app
from werkzeug.utils import secure_filename
from src.models.task import Task
from src.models import db
from src.models.conversation import Conversation
from src.models.file import File  # You need to create this model
from datetime import datetime
from src.ai.gemini import get_ai_response, generate_image, plan_task, route_tool
import uuid

agent_bp = Blueprint('agent', __name__)

# Allowed extensions for uploads (adjust as needed)
ALLOWED_EXTENSIONS = {'pdf', 'png', 'jpg', 'jpeg', 'gif'}

def allowed_file(filename):
    return '.' in filename and filename.rsplit('.', 1)[1].lower() in ALLOWED_EXTENSIONS

AGENT_CAPABILITIES = {
    "text_generation": True,
    "image_generation": True,
    "task_planning": True,
    "tool_routing": True,
    "file_upload": True
}

# ... keep your existing routes ...

@agent_bp.route('/agent/upload', methods=['POST'])
def upload_file():
    if 'file' not in request.files:
        return jsonify({"error": "No file part in the request"}), 400
    
    file = request.files['file']
    conversation_id = request.form.get('conversation_id') or str(uuid.uuid4())
    
    if file.filename == '':
        return jsonify({"error": "No selected file"}), 400
    
    if file and allowed_file(file.filename):
        filename = secure_filename(file.filename)
        upload_folder = current_app.config.get('UPLOAD_FOLDER', 'uploads')
        os.makedirs(upload_folder, exist_ok=True)
        filepath = os.path.join(upload_folder, filename)
        
        # Save file to disk
        file.save(filepath)

        # Save file record linked to conversation
        try:
            file_record = File(
                conversation_id=conversation_id,
                filename=filename,
                filepath=filepath,
                uploaded_at=datetime.utcnow()
            )
            db.session.add(file_record)
            db.session.commit()
        except Exception as e:
            db.session.rollback()
            return jsonify({"error": f"Database error saving file: {str(e)}"}), 500

        return jsonify({
            "message": "File uploaded successfully",
            "conversation_id": conversation_id,
            "file": {
                "id": file_record.id,
                "filename": filename,
                "filepath": filepath
            }
        })
    else:
        return jsonify({"error": "File type not allowed"}), 400

@agent_bp.route('/agent/conversations/<conversation_id>/files', methods=['GET'])
def get_conversation_files(conversation_id):
    files = File.query.filter_by(conversation_id=conversation_id).order_by(File.uploaded_at.desc()).all()
    files_list = [{
        "id": f.id,
        "filename": f.filename,
        "filepath": f.filepath,
        "uploaded_at": f.uploaded_at.isoformat()
    } for f in files]
    return jsonify(files_list)

# ... keep your existing routes like /agent/chat, /agent/tasks, etc. ...
