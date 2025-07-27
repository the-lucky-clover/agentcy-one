from flask_sqlalchemy import SQLAlchemy
db = SQLAlchemy()
import os
from flask import Flask
from flask_sqlalchemy import SQLAlchemy
from flask_cors import CORS

app = Flask(__name__)
app.config['UPLOAD_FOLDER'] = os.path.join(os.path.dirname(__file__), 'uploads')
app.config['MAX_CONTENT_LENGTH'] = 50 * 1024 * 1024  # max 50MB upload

os.makedirs(app.config['UPLOAD_FOLDER'], exist_ok=True)

CORS(app)
db = SQLAlchemy(app)
