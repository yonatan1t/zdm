# Project Structure

## Directory Layout

```
zdm/
├── backend/              # Python FastAPI backend
│   ├── app/
│   │   ├── main.py      # FastAPI application entry point
│   │   ├── config.py    # Pydantic settings and configuration
│   │   ├── api/         # API routes and WebSocket handlers
│   │   │   ├── routes.py       # REST API endpoints
│   │   │   └── websocket.py    # WebSocket handler
│   │   ├── services/    # Business logic layer
│   │   │   └── serial_manager.py
│   │   └── backends/    # Communication backend implementations
│   │       ├── base.py          # Abstract base class
│   │       └── serial_backend.py # Serial port implementation
│   ├── requirements.txt # Python dependencies
│   ├── start.bat       # Windows startup script
│   └── start.sh        # Linux/Mac startup script
├── frontend/           # Static web frontend (no build step)
│   ├── index.html     # Main application page
│   ├── js/
│   │   └── app.js     # Alpine.js application logic
│   └── css/           # Custom styles (if needed)
├── doc/               # Documentation
│   ├── architecture.md
│   └── *.md          # Various documentation files
└── examples/          # Example files and demos
```

## Architecture Patterns

### Backend

- **Layered Architecture**: API → Services → Backends
- **Strategy Pattern**: Backend abstraction allows multiple communication types
- **Dependency Injection**: Services injected into API routes
- **Async I/O**: All I/O operations use async/await

### Frontend

- **Component-Based**: Alpine.js components for UI sections
- **Reactive State**: Alpine.js reactive data binding
- **WebSocket Communication**: Real-time bidirectional data flow
- **Local Storage**: Command cache and settings persistence

## Key Files

### Backend Entry Points
- `backend/app/main.py` - FastAPI app initialization, route mounting, static file serving
- `backend/app/config.py` - Centralized configuration with validation

### API Layer
- `backend/app/api/routes.py` - REST endpoints for port listing, connection management
- `backend/app/api/websocket.py` - WebSocket handler for real-time serial communication

### Service Layer
- `backend/app/services/serial_manager.py` - Serial port connection management

### Backend Abstraction
- `backend/app/backends/base.py` - Abstract interface for all backends
- `backend/app/backends/serial_backend.py` - Serial port implementation

### Frontend
- `frontend/index.html` - Single-page application with Alpine.js
- `frontend/js/app.js` - Application logic, WebSocket client, command discovery

## Conventions

### File Naming
- Python: `snake_case.py`
- JavaScript: `kebab-case.js` or `camelCase.js`
- HTML: `kebab-case.html`

### Module Organization
- Each backend service implements `BaseBackend` interface
- API routes use FastAPI router pattern
- Services are stateful singletons (serial_manager)
- Frontend uses single Alpine.js component in `terminalApp()`

### Import Patterns
- Absolute imports from `app` package root
- Type hints imported from `typing` module
- Pydantic models for data validation

## Adding New Features

### New Backend Type
1. Create new file in `backend/app/backends/`
2. Implement `BaseBackend` interface
3. Add backend selection logic in service layer

### New API Endpoint
1. Add route to `backend/app/api/routes.py`
2. Use Pydantic models for request/response
3. Call service layer methods

### New Frontend Feature
1. Add state variables to Alpine.js component
2. Add methods for business logic
3. Update HTML template with Alpine.js directives
4. Use WebSocket or fetch API for backend communication
