"""FastAPI application entry point."""
from fastapi import FastAPI, WebSocket
from fastapi.staticfiles import StaticFiles
from fastapi.responses import FileResponse
from pathlib import Path
import os
import sys

from app.api import routes
from app.api.websocket import websocket_endpoint

app = FastAPI(title="Zephyr Device Manager", version="0.1.0")

# Include API routes
app.include_router(routes.router, prefix="/api")

# WebSocket endpoint
@app.websocket("/ws")
async def websocket(websocket: WebSocket):
    """WebSocket endpoint for serial communication."""
    await websocket_endpoint(websocket)

# Determine frontend path (handle PyInstaller bundled app)
if getattr(sys, 'frozen', False):
    # Running as compiled executable
    base_path = Path(sys._MEIPASS)
    frontend_path = base_path / "frontend"
else:
    # Running as script
    frontend_path = Path(__file__).parent.parent.parent / "frontend"
if frontend_path.exists():
    # Serve JS files
    js_path = frontend_path / "js"
    if js_path.exists():
        app.mount("/js", StaticFiles(directory=js_path), name="js")
    
    # Serve CSS files
    css_path = frontend_path / "css"
    if css_path.exists():
        app.mount("/css", StaticFiles(directory=css_path), name="css")
    
    # Serve other static assets
    assets_path = frontend_path / "assets"
    if assets_path.exists():
        app.mount("/assets", StaticFiles(directory=assets_path), name="assets")
    
    @app.get("/")
    async def read_root():
        """Serve frontend index page."""
        index_path = frontend_path / "index.html"
        if index_path.exists():
            return FileResponse(index_path)
        return {"message": "Frontend not found"}

@app.get("/health")
async def health():
    """Health check endpoint."""
    return {"status": "ok"}

if __name__ == "__main__":
    import uvicorn
    uvicorn.run(app, host="0.0.0.0", port=8000)

