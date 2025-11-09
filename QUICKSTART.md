# Quick Start Guide

## Prerequisites

- Python 3.10 or higher
- pip (Python package manager)
- A serial port device (USB-to-serial adapter or built-in serial port)

## Installation

1. **Create and activate a Python virtual environment:**

**Windows:**
```bash
cd backend
python -m venv venv
venv\Scripts\activate
```

**Linux/Mac:**
```bash
cd backend
python3 -m venv venv
source venv/bin/activate
```

2. **Install backend dependencies:**
```bash
pip install -r requirements.txt
```

## Running the Application

1. **Activate the virtual environment** (if not already activated):

**Windows:**
```bash
cd backend
venv\Scripts\activate
```

**Linux/Mac:**
```bash
cd backend
source venv/bin/activate
```

2. **Start the backend server:**

### Option 1: Using Python directly
```bash
python -m app.main
```

### Option 2: Using uvicorn
```bash
uvicorn app.main:app --reload --host 0.0.0.0 --port 8000
```

### Option 3: Using startup script

**Windows:**
```bash
start.bat
```

**Linux/Mac:**
```bash
chmod +x start.sh
./start.sh
```

**Note:** The startup scripts automatically create and activate the virtual environment if it doesn't exist.

## Using the Application

1. **Start the backend server** (see above)

2. **Open your web browser** and navigate to:
   ```
   http://localhost:8000
   ```

3. **Configure the serial connection:**
   - Click the "Settings" button
   - Select your serial port from the dropdown
   - Select the baud rate (default: 115200)
   - Click "Refresh" if your port doesn't appear
   - Click "Connect"

4. **Use the terminal:**
   - Type commands in the terminal
   - Commands are sent to your Zephyr device
   - Device output appears in real-time

## Testing Without a Device

If you don't have a Zephyr device connected, you can test the application by:

1. Using a serial port loopback (connect TX to RX)
2. Using a virtual serial port tool (like com0com on Windows or socat on Linux)
3. The application will still start and show available ports

## Troubleshooting

### Virtual Environment Issues
- Make sure you're in the `backend` directory when creating the virtual environment
- If `python -m venv` doesn't work, try `python3 -m venv venv` on Linux/Mac
- On Windows, if activation fails, try `.\venv\Scripts\Activate.ps1` (PowerShell) or ensure you're using Command Prompt
- Make sure the virtual environment is activated (you should see `(venv)` in your terminal prompt)

### Port Not Found
- Make sure your device is connected
- Check Device Manager (Windows) or `ls /dev/tty*` (Linux)
- Click "Refresh" in settings

### Connection Failed
- Verify the port name is correct
- Check if another application is using the port
- Verify baud rate matches device configuration
- On Linux, make sure you have permission to access the port (may need to add user to dialout group)

### WebSocket Errors
- Make sure the backend server is running
- Check browser console for errors
- Verify firewall settings
- Make sure the virtual environment is activated and dependencies are installed

## Next Steps

- See `architecture.md` for detailed architecture
- See `README.md` for more information
- Check `examples/` for Alpine.js examples

