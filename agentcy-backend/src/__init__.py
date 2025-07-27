import os
from flask import Flask
from flask_cors import CORS
from src.models import db
from src.routes.user import user_bp
from src.routes.agent import agent_bp  # ✅ updated to match your actual file structure

def create_app(config_class=None):
    app = Flask(__name__, static_folder=os.path.join(os.path.dirname(__file__), 'static'))

    # Load configuration from config.py or passed config_class
    if config_class:
        app.config.from_object(config_class)
    else:
        from config import ProdConfig
        app.config.from_object(ProdConfig)

    # Ensure upload folder exists
    os.makedirs(app.config['UPLOAD_FOLDER'], exist_ok=True)

    # Enable CORS
    CORS(app)

    # Initialize extensions
    db.init_app(app)

    # Register blueprints with URL prefixes
    app.register_blueprint(user_bp, url_prefix='/api')
    app.register_blueprint(agent_bp, url_prefix='/api')

    # Create database tables if not exist
    with app.app_context():
        db.create_all()

    return app
