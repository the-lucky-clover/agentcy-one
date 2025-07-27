from src import create_app
from config import ProdConfig

app = create_app(ProdConfig)

# Gunicorn looks for `app`
