import os

basedir = os.path.abspath(os.path.dirname(__file__))

class BaseConfig:
    SQLALCHEMY_TRACK_MODIFICATIONS = False
    UPLOAD_FOLDER = os.path.join(basedir, 'src', 'uploads')
    MAX_CONTENT_LENGTH = 50 * 1024 * 1024  # 50 MB

class DevConfig(BaseConfig):
    DEBUG = True
    SQLALCHEMY_DATABASE_URI = f"sqlite:///{os.path.join(basedir, 'src', 'database', 'dev.db')}"

class ProdConfig(BaseConfig):
    SECRET_KEY = os.environ.get('SECRET_KEY', 'super-secret')
    SQLALCHEMY_DATABASE_URI = os.environ.get('DATABASE_URL', f"sqlite:///{os.path.join(basedir, 'src', 'database', 'prod.db')}")

