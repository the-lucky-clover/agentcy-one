import os
from flask import Flask
from flask_sqlalchemy import SQLAlchemy
from flask_cors import CORS

# Initialize SQLAlchemy without app (for later binding)
db = SQLAlchemy()

def create_app():
    app = Flask(__name__)

    # Configure upload folder - relative to this file's directory + 'uploads'
    app.config['UPLOAD_FOLDER'] = os.path.join(os.path.dirname(__file__), 'uploads')
    app.config['MAX_CONTENT_LENGTH'] = 50 * 1024 * 1024  # max 50MB upload

    # Create upload folder if it doesn't exist
    os.makedirs(app.config['UPLOAD_FOLDER'], exist_ok=True)

    # Enable CORS
    CORS(app)

    # Initialize db with app
    db.init_app(app)

    # Import and register blueprints here, for example:
    from src.agent import agent_bp
    app.register_blueprint(agent_bp)

    # You can import other blueprints similarly

    return app
