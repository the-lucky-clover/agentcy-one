import os
from flask import Flask
from flask_cors import CORS
from src.models import db
from src.agent import agent_bp
from src.routes.user import user_bp

def create_app():
    app = Flask(__name__)

    # Database configuration
    database_url = os.environ.get('DATABASE_URL')
    if database_url:
        app.config['SQLALCHEMY_DATABASE_URI'] = database_url
    else:
        db_path = os.path.join(os.path.dirname(__file__), 'database', 'app.db')
        os.makedirs(os.path.dirname(db_path), exist_ok=True)
        app.config['SQLALCHEMY_DATABASE_URI'] = f"sqlite:///{db_path}"

    app.config['SQLALCHEMY_TRACK_MODIFICATIONS'] = False

    # Uploads configuration
    upload_dir = os.path.join(os.path.dirname(__file__), 'uploads')
    os.makedirs(upload_dir, exist_ok=True)
    app.config['UPLOAD_FOLDER'] = upload_dir
    app.config['MAX_CONTENT_LENGTH'] = 50 * 1024 * 1024  # 50MB

    # Enable CORS
    CORS(app)

    # Initialize extensions
    db.init_app(app)

    # Register blueprints
    app.register_blueprint(agent_bp, url_prefix='/api')
    app.register_blueprint(user_bp, url_prefix='/api')

    # Create database tables
    with app.app_context():
        db.create_all()

    return app
