# Technology Stack

## Backend

- **Framework**: FastAPI (Python 3.10+)
- **Serial Communication**: pyserial
- **WebSocket**: FastAPI built-in WebSocket support
- **Configuration**: Pydantic Settings with environment variable support
- **Async**: Python asyncio for non-blocking I/O

## Frontend

- **Framework**: Alpine.js (lightweight, no build step)
- **Terminal**: xterm.js with fit addon
- **Styling**: TailwindCSS via CDN
- **WebSocket**: Native browser WebSocket API
- **State**: Alpine.js reactive data (no external state management)

## Development Philosophy

- **No Build Step**: Frontend uses CDN libraries, served directly by FastAPI
- **Simple Deployment**: Single Python backend serves both API and static files
- **Type Safety**: Python type hints throughout backend code
- **Async First**: Non-blocking I/O for serial and WebSocket communication

## Common Commands

### Backend Setup

```bash
# Windows
cd backend
python -m venv venv
venv\Scripts\activate
pip install -r requirements.txt

# Linux/Mac
cd backend
python3 -m venv venv
source venv/bin/activate
pip install -r requirements.txt
```

### Running the Application

```bash
# From backend directory with venv activated
python -m app.main

# Or using uvicorn directly
uvicorn app.main:app --reload --host 0.0.0.0 --port 8000

# Or using startup scripts
start.bat  # Windows
./start.sh # Linux/Mac
```

### Testing

```bash
# Run backend tests (when implemented)
pytest

# Manual testing
# Open browser to http://localhost:8000
```

## Configuration

- Environment variables prefixed with `ZDM_` override defaults
- Configuration defined in `backend/app/config.py`
- Example: `ZDM_PORT=8080` changes server port
- `.env` file supported for local development

## Code Style

### Python
- Follow PEP 8
- Use type hints for all function signatures
- Async/await for I/O operations
- Pydantic models for request/response validation

### JavaScript
- ES6+ syntax
- Alpine.js conventions for reactive components
- Descriptive variable names
- Comments for complex logic

### HTML
- Semantic HTML5 elements
- TailwindCSS utility classes for styling
- Alpine.js directives for interactivity
