import os
import sys

from flask import Flask, send_from_directory
from src import create_app

# Ensure absolute project root is in the Python path
sys.path.insert(0, os.path.abspath(os.path.join(os.path.dirname(__file__), '..')))

# Create app using factory pattern
app = create_app()

# Static file handler (React/Vite build or SPA)
@app.route('/', defaults={'path': ''})
@app.route('/<path:path>')
def serve(path):
    static_folder = app.static_folder or os.path.join(os.path.dirname(__file__), 'static')
    requested_path = os.path.join(static_folder, path)

    # Serve file directly if it exists
    if path and os.path.exists(requested_path) and not os.path.isdir(requested_path):
        return send_from_directory(static_folder, path)

    # Serve index.html fallback (for React/Vite routing)
    index_file = os.path.join(static_folder, 'index.html')
    if os.path.exists(index_file):
        return send_from_directory(static_folder, 'index.html')

    return "index.html not found", 404

# Run app
if __name__ == '__main__':
    port = int(os.environ.get('PORT', 5001))
    app.run(host='0.0.0.0', port=port, debug=False)
