import PyInstaller.__main__
import os
import shutil
from pathlib import Path

# Get backend dir
backend_dir = Path(__file__).parent.resolve()
frontend_dir = backend_dir.parent / "frontend"

# Ensure dist directory exists and is clean
dist_dir = backend_dir / "dist"
if dist_dir.exists():
    shutil.rmtree(dist_dir)

print(f"Building from: {backend_dir}")
print(f"Frontend dir: {frontend_dir}")

PyInstaller.__main__.run([
    'app/startup.py',
    '--name=ZephyrDeviceManager',
    '--onefile',
    '--clean',
    f'--add-data={frontend_dir}{os.pathsep}frontend',
    '--hidden-import=uvicorn.lifespan.on',
    '--hidden-import=uvicorn.logging',
    '--hidden-import=app.api.routes',
    '--hidden-import=app.api.websocket',
    
    # Optimize exclusions
    '--exclude-module=tkinter',
    '--exclude-module=pytest',
])
