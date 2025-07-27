from datetime import datetime
from src.models import db

class Conversation(db.Model):
    __tablename__ = 'conversations'

    id = db.Column(db.Integer, primary_key=True)
    conversation_id = db.Column(db.String(100), nullable=False, index=True)
    user_message = db.Column(db.Text, nullable=False)
    agent_response = db.Column(db.Text, nullable=False)
    timestamp = db.Column(db.DateTime, nullable=False, default=datetime.utcnow)

    def to_dict(self):
        return {
            "id": self.id,
            "conversation_id": self.conversation_id,
            "user_message": self.user_message,
            "agent_response": self.agent_response,
            # ✅ Truncate microseconds and add 'Z' for ISO 8601 UTC compatibility
            "timestamp": self.timestamp.replace(microsecond=0).isoformat() + 'Z' if self.timestamp else None
        }

    def __repr__(self):
        return f"<Conversation id={self.id} conversation_id='{self.conversation_id}'>"
