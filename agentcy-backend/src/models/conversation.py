from datetime import datetime
from src.models import db  # Shared instance
from src.models.file import File  # Import File model from its module

class Conversation(db.Model):
    __tablename__ = 'conversations'

    id = db.Column(db.Integer, primary_key=True)
    conversation_id = db.Column(db.String(100), nullable=False, index=True)
    user_message = db.Column(db.Text, nullable=False)
    agent_response = db.Column(db.Text, nullable=False)
    timestamp = db.Column(db.DateTime, default=datetime.utcnow)

    # Relationship to associated uploaded files
    files = db.relationship('File', backref='conversation', lazy=True, cascade="all, delete-orphan")

    def to_dict(self):
        return {
            'id': self.id,
            'conversation_id': self.conversation_id,
            'user_message': self.user_message,
            'agent_response': self.agent_response,
            'timestamp': self.timestamp.isoformat() if self.timestamp else None,
            'files': [file.to_dict() for file in self.files]
        }

    def __repr__(self):
        return f'<Conversation {self.id}: {self.conversation_id}>'
