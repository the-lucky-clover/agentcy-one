from datetime import datetime
from src.models import db

class File(db.Model):
    __tablename__ = 'files'

    id = db.Column(db.Integer, primary_key=True)
    conversation_id = db.Column(db.String(100), db.ForeignKey('conversations.conversation_id'), nullable=False, index=True)
    filename = db.Column(db.String(255), nullable=False)
    filepath = db.Column(db.String(500), nullable=False)
    uploaded_at = db.Column(db.DateTime, default=datetime.utcnow, nullable=False)

    def to_dict(self):
        return {
            "id": self.id,
            "conversation_id": self.conversation_id,
            "filename": self.filename,
            "filepath": self.filepath,
            "uploaded_at": self.uploaded_at.isoformat() if self.uploaded_at else None
        }

    def __repr__(self):
        return f'<File {self.id} - {self.filename}>'
