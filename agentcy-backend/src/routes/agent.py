from flask import Blueprint, jsonify, request
from src.models.task import Task
from src.models import db
from src.models.conversation import Conversation
from datetime import datetime
from src.ai.gemini import get_ai_response, generate_image, plan_task, route_tool
import uuid

agent_bp = Blueprint('agent', __name__)

AGENT_CAPABILITIES = {
    "text_generation": True,
    "image_generation": True,
    "task_planning": True,
    "tool_routing": True
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

@agent_bp.route('/agent/tasks', methods=['GET'])
def get_tasks():
    tasks = Task.query.all()
    return jsonify([task.to_dict() for task in tasks])

@agent_bp.route('/agent/tasks', methods=['POST'])
def create_task():
    data = request.json or {}
    task = Task(
        title=data.get('title', ''),
        description=data.get('description', ''),
        status='pending',
        created_at=datetime.utcnow()
    )
    db.session.add(task)
    db.session.commit()
    return jsonify(task.to_dict()), 201

@agent_bp.route('/agent/tasks/plan', methods=['POST'])
def plan_task_route():
    data = request.json or {}
    prompt = data.get("prompt", "").strip()

    if not prompt:
        return jsonify({"error": "Prompt is required for task planning"}), 400

    try:
        steps = plan_task(prompt)
        return jsonify({"plan": steps, "status": "success"})
    except Exception as e:
        return jsonify({"error": str(e)}), 500

@agent_bp.route('/agent/image', methods=['POST'])
def generate_image_route():
    data = request.json or {}
    prompt = data.get("prompt", "").strip()

    if not prompt:
        return jsonify({"error": "Prompt is required"}), 400

    try:
        image_url = generate_image(prompt)
        return jsonify({"image_url": image_url})
    except Exception as e:
        return jsonify({"error": f"Image generation failed: {str(e)}"}), 500

@agent_bp.route('/agent/conversations', methods=['GET'])
def get_conversations():
    conversations = Conversation.query.order_by(Conversation.timestamp.desc()).limit(50).all()
    return jsonify([conv.to_dict() for conv in conversations])

@agent_bp.route('/agent/conversations/<conversation_id>', methods=['GET'])
def get_conversation(conversation_id):
    conversations = Conversation.query.filter_by(conversation_id=conversation_id).order_by(Conversation.timestamp.asc()).all()
    return jsonify([conv.to_dict() for conv in conversations])

@agent_bp.route('/agent/health', methods=['GET'])
def health_check():
    return jsonify({
        "status": "healthy",
        "timestamp": datetime.utcnow().isoformat(),
        "version": "1.1.0",
        "service": "Agentcy.one AI Agent"
    })
