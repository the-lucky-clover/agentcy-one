import os
from flask import Flask
from flask_cors import CORS
from src.models import db
from src.agent import agent_bp  # example blueprint

def create_app():
    app = Flask(__name__)
    
    # Set your database URL config early
    database_url = os.environ.get('DATABASE_URL')
    if database_url:
        app.config['SQLALCHEMY_DATABASE_URI'] = database_url
    else:
        app.config['SQLALCHEMY_DATABASE_URI'] = f"sqlite:///{os.path.join(os.path.dirname(__file__), 'database', 'app.db')}"
    app.config['SQLALCHEMY_TRACK_MODIFICATIONS'] = False
    
    app.config['UPLOAD_FOLDER'] = os.path.join(os.path.dirname(__file__), 'uploads')
    os.makedirs(app.config['UPLOAD_FOLDER'], exist_ok=True)
    
    CORS(app)
    
    db.init_app(app)  # Initialize SQLAlchemy with app here
    
    # Register blueprints
    app.register_blueprint(agent_bp)
    
    with app.app_context():
        db.create_all()  # Create tables if needed
    
    return app
