# src/models/embedding.py
from datetime import datetime
from src.models import db

class Embedding(db.Model):
    __tablename__ = 'embeddings'

    id = db.Column(db.Integer, primary_key=True)
    conversation_id = db.Column(db.String(100), nullable=False, index=True)
    file_id = db.Column(db.Integer, db.ForeignKey('files.id'), nullable=True)
    text_chunk = db.Column(db.Text, nullable=False)
    embedding_vector = db.Column(db.PickleType, nullable=False)  # Store list/array
    created_at = db.Column(db.DateTime, default=datetime.utcnow)

    def to_dict(self):
        return {
            "id": self.id,
            "conversation_id": self.conversation_id,
            "file_id": self.file_id,
            "text_chunk": self.text_chunk,
            "embedding_vector": self.embedding_vector,  # You may omit or reduce size in JSON
            "created_at": self.created_at.isoformat()
        }
