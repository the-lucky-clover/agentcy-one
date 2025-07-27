import os
import sys

# Add root to Python path
sys.path.insert(0, os.path.dirname(os.path.dirname(__file__)))

from flask import send_from_directory
from src import create_app

app = create_app()  # Use factory pattern

# Serve frontend (if needed)
@app.route('/', defaults={'path': ''})
@app.route('/<path:path>')
def serve(path):
    static_folder_path = app.static_folder or os.path.join(os.path.dirname(__file__), 'static')

    requested_path = os.path.join(static_folder_path, path)
    if path and os.path.exists(requested_path):
        return send_from_directory(static_folder_path, path)
    
    index_path = os.path.join(static_folder_path, 'index.html')
    if os.path.exists(index_path):
        return send_from_directory(static_folder_path, 'index.html')

    return "index.html not found", 404

if __name__ == '__main__':
    port = int(os.environ.get('PORT', 5001))
    app.run(host='0.0.0.0', port=port, debug=False)
