# Building ZDM Executable

This guide explains how to build Zephyr Device Manager into a standalone executable using PyInstaller.

## Prerequisites

- Python 3.10+
- Virtual environment with dependencies installed
- PyInstaller (will be installed automatically by build script)

## Build Instructions

### Windows

```bash
cd backend
build.bat
```

### Linux/Mac

```bash
cd backend
chmod +x build.sh
./build.sh
```

## Output

The executable will be created in `backend/dist/`:
- **Windows**: `dist/zdm.exe`
- **Linux/Mac**: `dist/zdm`

## Running the Executable

Simply run the executable:

```bash
# Windows
dist\zdm.exe

# Linux/Mac
./dist/zdm
```

The application will:
1. Start the FastAPI server on `http://localhost:8000`
2. Serve the web interface
3. Open your browser to access the terminal

## What's Included

The executable bundles:
- Python runtime
- FastAPI and Uvicorn
- PySerial for serial communication
- All backend code
- Frontend files (HTML, JS, CSS)
- All dependencies

## Troubleshooting

### Build fails with missing modules

Add the missing module to `hiddenimports` in `zdm.spec`:

```python
hiddenimports=[
    'your.missing.module',
    # ... existing imports
]
```

### Frontend files not found

Ensure the frontend path in `zdm.spec` is correct relative to the spec file location.

### Serial port access issues

On Linux, you may need to add your user to the `dialout` group:

```bash
sudo usermod -a -G dialout $USER
```

Then log out and back in.

## Customization

Edit `zdm.spec` to customize:
- Executable name
- Icon (add `icon='path/to/icon.ico'` in EXE section)
- Console window (set `console=False` for GUI mode)
- UPX compression (set `upx=False` to disable)

## File Size

The executable will be approximately 40-60 MB due to bundled Python runtime and dependencies.
