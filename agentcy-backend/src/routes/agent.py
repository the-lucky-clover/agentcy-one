import os
from flask import Blueprint, jsonify, request, current_app, send_from_directory, abort
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

@agent_bp.route('/agent/capabilities', methods=['GET'])
def get_capabilities():
    return jsonify({
        "capabilities": AGENT_CAPABILITIES,
        "version": "1.1.0",
        "name": "Agentcy.one AI Agent"
    })

@agent_bp.route('/agent/chat', methods=['POST'])
def chat_with_agent():
    data = request.json or {}
    user_message = data.get('message', '').strip()
    conversation_id = data.get('conversation_id') or str(uuid.uuid4())

    if not user_message:
        return jsonify({"error": "Message cannot be empty"}), 400

    try:
        routed_result = route_tool(user_message)
        response_text = routed_result.get("message")
        tools_used = routed_result.get("tools_used", [])
    except Exception as e:
        return jsonify({"error": f"AI routing error: {str(e)}"}), 500

    response_payload = {
        "message": response_text,
        "conversation_id": conversation_id,
        "timestamp": datetime.utcnow().isoformat(),
        "tools_used": tools_used,
        "status": "completed"
    }

    try:
        conversation = Conversation(
            conversation_id=conversation_id,
            user_message=user_message,
            agent_response=response_text,
            timestamp=datetime.utcnow()
        )
        db.session.add(conversation)
        db.session.commit()
    except Exception as e:
        db.session.rollback()
        return jsonify({"error": f"Database error: {str(e)}"}), 500

    return jsonify(response_payload)

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

        # To avoid collisions, you can prepend UUID to filename
        unique_filename = f"{uuid.uuid4()}_{filename}"
        filepath = os.path.join(upload_folder, unique_filename)
        
        # Save file to disk
        file.save(filepath)

        # Save file record linked to conversation
        try:
            file_record = File(
                conversation_id=conversation_id,
                filename=unique_filename,
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
                "filename": unique_filename,
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

@agent_bp.route('/agent/files/<int:file_id>/download', methods=['GET'])
def download_file(file_id):
    file_record = File.query.get_or_404(file_id)

    directory = os.path.dirname(file_record.filepath)
    filename = os.path.basename(file_record.filepath)

    upload_folder = os.path.abspath(current_app.config.get('UPLOAD_FOLDER', 'uploads'))
    abs_directory = os.path.abspath(directory)

    # Prevent path traversal attacks
    if not abs_directory.startswith(upload_folder):
        abort(403, description="Access to this file is forbidden.")

    try:
        return send_from_directory(directory=directory, path=filename, as_attachment=True)
    except FileNotFoundError:
        abort(404, description="File not found on server.")

# ... keep your other existing routes here, e.g., /agent/tasks, /agent/image, etc.
