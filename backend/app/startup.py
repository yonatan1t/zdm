"""Startup script that opens browser and starts server."""
import webbrowser
import threading
import time
import sys
from pathlib import Path

# Add parent directory to path if needed
backend_dir = Path(__file__).parent.parent
if str(backend_dir) not in sys.path:
    sys.path.insert(0, str(backend_dir))


def open_browser():
    """Open browser after server is ready."""
    time.sleep(2)
    print("Opening browser...")
    webbrowser.open("http://localhost:8000")


def start():
    """Start the application with browser auto-open."""
    import uvicorn
    from app.main import app
    
    # Start browser in separate thread
    threading.Thread(target=open_browser, daemon=True).start()
    
    # Start server
    print("Starting Zephyr Device Manager...")
    print("Server will be available at http://localhost:8000")
    uvicorn.run(app, host="0.0.0.0", port=8000)


if __name__ == "__main__":
    start()
