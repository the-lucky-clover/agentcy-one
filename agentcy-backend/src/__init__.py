import os
from flask import Flask
from flask_cors import CORS
from src.models import db
from src.agent import agent_bp  # Import your blueprints here
from src.routes.user import user_bp  # Example user blueprint if any

def create_app():
    app = Flask(__name__)

    # Set config before init db
    database_url = os.environ.get('DATABASE_URL')
    if database_url:
        app.config['SQLALCHEMY_DATABASE_URI'] = database_url
    else:
        # Use sqlite database path relative to this file
        app.config['SQLALCHEMY_DATABASE_URI'] = f"sqlite:///{os.path.join(os.path.dirname(__file__), 'database', 'app.db')}"

    app.config['SQLALCHEMY_TRACK_MODIFICATIONS'] = False

    # Upload config
    app.config['UPLOAD_FOLDER'] = os.path.join(os.path.dirname(__file__), 'uploads')
    os.makedirs(app.config['UPLOAD_FOLDER'], exist_ok=True)
    app.config['MAX_CONTENT_LENGTH'] = 50 * 1024 * 1024  # 50MB max upload

    CORS(app)

    # Initialize extensions with app
    db.init_app(app)

    # Register blueprints
    app.register_blueprint(agent_bp, url_prefix='/api')
    app.register_blueprint(user_bp, url_prefix='/api')

    # Create tables (make sure you have models imported somewhere so they register)
    with app.app_context():
        db.create_all()

    return app
