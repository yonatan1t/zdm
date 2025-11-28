# Zephyr Device Manager (ZDM) - Architecture Document

## Overview
ZDM is a web-based serial terminal application designed for Zephyr RTOS development and debugging. It provides real-time serial communication, Zephyr shell support, command parsing, and extensible backend support for various communication protocols.

## Tech Stack

### Backend
- **Framework**: FastAPI (Python 3.10+)
  - Modern, fast, async-capable
  - Built-in WebSocket support
  - Auto-generated API documentation
  - Type hints for better maintainability
- **Serial Communication**: pyserial
  - Industry standard for serial port access
  - Cross-platform support
- **Database**: SQLite
  - Lightweight, file-based
  - No separate server required
  - SQLAlchemy ORM for database operations
- **WebSocket**: FastAPI WebSocket (built-in)
  - Real-time bidirectional communication
  - Low latency for serial data streaming
- **Command Parsing**: Custom Python modules
  - Tab completion parsing
  - --help parsing for auto-generating commands
  - Regex-based pattern matching

### Frontend
- **Framework**: Alpine.js
  - Ultra-lightweight (~15KB)
  - Declarative reactivity without build step
  - Can be used via CDN (no build tools required)
  - Simple syntax, easy for embedded teams
  - Works with vanilla JavaScript
- **Terminal**: xterm.js
  - Industry standard for web-based terminals
  - No framework dependencies
  - Direct DOM integration
- **Styling**: TailwindCSS (via CDN) or vanilla CSS
  - Utility-first CSS framework
  - Optional: can use plain CSS for maximum simplicity
- **State Management**: Alpine.js reactive data
  - Built-in reactivity system
  - No external state management needed
- **WebSocket Client**: Native WebSocket API
  - Direct communication with backend
- **No Build Step**: Pure HTML/CSS/JS
  - Can be served directly by FastAPI
  - No npm/webpack/vite complexity
  - Easy to modify and maintain

### Development Tools
- **Backend**: 
  - pytest for testing
  - black for code formatting
  - mypy for type checking
- **Frontend**:
  - No build tools required
  - Optional: Prettier for HTML/CSS/JS formatting
  - Browser DevTools for debugging
- **Package Management**:
  - Backend: pip + requirements.txt or poetry
  - Frontend: CDN links (Alpine.js, xterm.js, TailwindCSS)

## Architecture Overview

```
┌─────────────────────────────────────────────────────────────┐
│                         Frontend                             │
│  ┌──────────────┐  ┌──────────────┐  ┌──────────────────┐  │
│  │   Terminal   │  │ Command      │  │ Settings/Config  │  │
│  │   UI (xterm) │  │ History      │  │                  │  │
│  └──────┬───────┘  └──────┬───────┘  └────────┬─────────┘  │
│         │                  │                   │            │
│         └──────────────────┴───────────────────┘            │
│                            │                                 │
│                   ┌────────▼────────┐                        │
│                   │  WebSocket      │                        │
│                   │  Client         │                        │
│                   └────────┬────────┘                        │
└────────────────────────────┼─────────────────────────────────┘
                             │
                    HTTP/WebSocket
                             │
┌────────────────────────────▼─────────────────────────────────┐
│                         Backend (FastAPI)                     │
│  ┌────────────────────────────────────────────────────────┐  │
│  │              API Routes & WebSocket Handler            │  │
│  └────────────────────┬───────────────────────────────────┘  │
│                       │                                        │
│  ┌────────────────────▼───────────────────────────────────┐  │
│  │              Serial Manager                             │  │
│  │  - Port management                                      │  │
│  │  - Connection handling                                  │  │
│  │  - Data streaming                                       │  │
│  └────────────────────┬───────────────────────────────────┘  │
│                       │                                        │
│  ┌────────────────────▼───────────────────────────────────┐  │
│  │              Shell Parser                               │  │
│  │  - Command parsing                                      │  │
│  │  - Tab completion handling                              │  │
│  │  - --help parsing                                       │  │
│  │  - Command auto-generation                              │  │
│  └────────────────────┬───────────────────────────────────┘  │
│                       │                                        │
│  ┌────────────────────▼───────────────────────────────────┐  │
│  │              Command Manager                            │  │
│  │  - Command history storage                              │  │
│  │  - Command suggestions                                  │  │
│  │  - Command templates                                    │  │
│  └────────────────────┬───────────────────────────────────┘  │
│                       │                                        │
│  ┌────────────────────▼───────────────────────────────────┐  │
│  │              Database Layer (SQLite)                    │  │
│  │  - Command history                                      │  │
│  │  - User preferences                                     │  │
│  │  - Connection settings                                  │  │
│  └────────────────────────────────────────────────────────┘  │
│                       │                                        │
│  ┌────────────────────▼───────────────────────────────────┐  │
│  │              Backend Abstraction Layer                  │  │
│  │  - Serial backend (current)                             │  │
│  │  - Telnet backend (future)                              │  │
│  │  - RTT backend (future)                                 │  │
│  │  - MQTT backend (future)                                │  │
│  └────────────────────────────────────────────────────────┘  │
└───────────────────────────────────────────────────────────────┘
                             │
                    Serial/USB/Network
                             │
┌────────────────────────────▼─────────────────────────────────┐
│                    Zephyr Device                              │
│              (Serial Port / Network)                          │
└───────────────────────────────────────────────────────────────┘
```

## Core Components

### 1. Backend Components

#### 1.1 Serial Manager
- **Purpose**: Manages serial port connections
- **Responsibilities**:
  - Port discovery and listing
  - Connection establishment/teardown
  - Data reading/writing
  - Baud rate and port configuration
- **Technology**: pyserial

#### 1.2 Shell Parser
- **Purpose**: Parses Zephyr shell commands and responses
- **Responsibilities**:
  - Parse tab completion responses
  - Extract commands from --help output
  - Generate command tree structure
  - Match command patterns
- **Technology**: Custom Python modules with regex

#### 1.3 Command Manager
- **Purpose**: Manages command history and suggestions
- **Responsibilities**:
  - Store command history in database
  - Provide command autocomplete suggestions
  - Manage command templates
  - Search command history
- **Technology**: SQLAlchemy + SQLite

#### 1.4 Backend Abstraction Layer
- **Purpose**: Abstract communication backend interface
- **Responsibilities**:
  - Define common interface for all backends
  - Implement serial backend
  - Prepare for future backends (telnet, RTT, MQTT)
- **Design Pattern**: Strategy pattern

#### 1.5 WebSocket Handler
- **Purpose**: Real-time communication with frontend
- **Responsibilities**:
  - Handle WebSocket connections
  - Stream serial data to frontend
  - Receive commands from frontend
  - Manage multiple client connections
- **Technology**: FastAPI WebSocket

### 2. Frontend Components

#### 2.1 Terminal Component
- **Purpose**: Display terminal output and handle input
- **Responsibilities**:
  - Render terminal UI
  - Handle user keyboard input
  - Display serial data
  - Support terminal features (scrolling, selection, etc.)
- **Technology**: xterm.js

#### 2.2 WebSocket Client
- **Purpose**: Communicate with backend
- **Responsibilities**:
  - Establish WebSocket connection
  - Send commands to backend
  - Receive serial data from backend
  - Handle connection errors
- **Technology**: Native WebSocket API

#### 2.3 Command History Component
- **Purpose**: Display and manage command history
- **Responsibilities**:
  - Show command history list
  - Allow command selection
  - Search/filter commands
  - Save frequently used commands
- **Technology**: Alpine.js + vanilla JavaScript + HTML

#### 2.4 Settings Component
- **Purpose**: Configure application settings
- **Responsibilities**:
  - Serial port configuration
  - Terminal appearance settings
  - Connection preferences
  - Backend selection (when multiple backends available)
- **Technology**: Alpine.js + vanilla JavaScript + HTML + Fetch API

## Data Flow

### Serial Data Flow
1. Zephyr device sends data over serial port
2. Serial Manager reads data from port
3. Data is forwarded to WebSocket Handler
4. WebSocket Handler sends data to connected frontend clients
5. Terminal component displays data in UI

### Command Flow
1. User types command in terminal UI
2. Command is sent via WebSocket to backend
3. Backend receives command and forwards to Serial Manager
4. Serial Manager writes command to serial port
5. Command is executed on Zephyr device
6. Response follows Serial Data Flow back to UI

### Command Parsing Flow
1. User presses TAB for autocomplete
2. Backend sends TAB character to serial port
3. Zephyr device responds with available commands
4. Shell Parser extracts command list
5. Command Manager stores/updates command tree
6. Suggestions sent to frontend
7. Frontend displays autocomplete options

## Database Schema

### Tables

#### commands
- `id`: Primary key
- `command`: Command string
- `description`: Command description (from --help)
- `category`: Command category/namespace
- `usage_count`: Number of times used
- `last_used`: Timestamp of last use
- `created_at`: Timestamp of creation

#### command_history
- `id`: Primary key
- `command`: Full command string
- `timestamp`: When command was executed
- `device_id`: Optional device identifier

#### connection_settings
- `id`: Primary key
- `name`: Connection profile name
- `port`: Serial port name
- `baud_rate`: Baud rate
- `backend_type`: Type of backend (serial, telnet, etc.)
- `settings`: JSON blob for backend-specific settings

## Future Extensions

### Phase 2: Additional Backends
- **Telnet Backend**: Network-based communication
- **RTT Backend**: Segger RTT support
- **MQTT Backend**: MQTT protocol support
- **Implementation**: New backend classes implementing common interface

### Phase 3: MCUMGR Support
- **MCUMGR Client**: Python mcumgr library integration
- **MCUMGR UI**: Alpine.js components for mcumgr operations
- **Features**: Image management, stats, file system operations

### Phase 4: FOTA Support
- **FOTA Manager**: Firmware Over-The-Air update management
- **Image Management**: Store and manage firmware images
- **Update Scheduling**: Schedule and execute firmware updates
- **Progress Tracking**: Real-time update progress monitoring

## Deployment

### Development
- Backend: `uvicorn main:app --reload`
- Frontend: Static HTML files served by FastAPI (no separate dev server needed)
- Database: SQLite file (auto-created)

### Production
- Backend: Gunicorn + uvicorn workers
- Frontend: Static HTML/CSS/JS files served by FastAPI
- Database: SQLite (or migrate to PostgreSQL if needed)
- No frontend build step required

## File Structure

```
zdm/
├── backend/
│   ├── app/
│   │   ├── __init__.py
│   │   ├── main.py                 # FastAPI application
│   │   ├── models/                 # Database models
│   │   ├── schemas/                # Pydantic schemas
│   │   ├── api/                    # API routes
│   │   │   ├── websocket.py        # WebSocket handler
│   │   │   └── routes.py           # REST API routes
│   │   ├── services/
│   │   │   ├── serial_manager.py   # Serial port management
│   │   │   ├── shell_parser.py     # Shell command parsing
│   │   │   ├── command_manager.py  # Command history management
│   │   │   └── backend_factory.py  # Backend abstraction
│   │   └── backends/
│   │       ├── base.py             # Base backend interface
│   │       ├── serial_backend.py   # Serial implementation
│   │       ├── telnet_backend.py   # Telnet (future)
│   │       ├── rtt_backend.py      # RTT (future)
│   │       └── mqtt_backend.py     # MQTT (future)
│   ├── tests/                      # Backend tests
│   ├── requirements.txt            # Python dependencies
│   └── README.md
├── frontend/
│   ├── index.html                  # Main HTML file
│   ├── css/
│   │   └── style.css               # Custom styles (if not using TailwindCDN)
│   ├── js/
│   │   ├── app.js                  # Main application logic
│   │   ├── websocket.js            # WebSocket client
│   │   ├── terminal.js             # xterm.js integration
│   │   ├── command-history.js      # Command history management
│   │   └── api.js                  # API client (fetch calls)
│   └── assets/                     # Static assets (if any)
├── architecture.md                 # This file
└── README.md                       # Project README
```

## Key Design Decisions

1. **FastAPI over Flask**: Better async support, WebSocket built-in, automatic API docs
2. **SQLite over PostgreSQL**: Simpler deployment, sufficient for single-user/local use
3. **Alpine.js over React/Vue**: Ultra-lightweight (~15KB), no build step, simpler for embedded teams
   - Declarative syntax similar to Vue but much simpler
   - No JSX, no virtual DOM, no build tools
   - Can be learned in minutes by developers familiar with HTML/JS
   - Perfect for embedded teams who may not be frontend experts
4. **No build tools for frontend**: Pure HTML/CSS/JS, served directly, easier maintenance
   - No webpack, vite, or npm complexity
   - Files can be edited directly and refreshed in browser
   - No transpilation, no source maps needed
   - Easy to debug with browser DevTools
5. **WebSocket over Server-Sent Events**: Bidirectional communication needed
6. **Backend abstraction layer**: Easy to add new communication backends
7. **xterm.js**: Industry standard for web-based terminals, works with vanilla JS
8. **CDN for libraries**: No npm/node complexity, just include script tags
9. **Vanilla JavaScript**: Simple, no transpilation, easy to debug and understand

## Security Considerations

- Input validation on all API endpoints
- Serial port access restrictions (OS-level)
- WebSocket authentication (future)
- Command injection prevention
- Rate limiting on API endpoints (future)

## Performance Considerations

- Async I/O for serial communication (non-blocking)
- WebSocket connection pooling
- Database indexing on frequently queried fields
- Frontend virtualization for large command history lists
- Debouncing for command autocomplete

## Maintenance Guidelines

- Keep backend and frontend separate (clear API contract)
- Use type hints throughout Python code
- Write unit tests for critical components
- Document API endpoints with FastAPI auto-docs
- Follow PEP 8 for Python code style
- Use consistent JavaScript coding style (no linter required, but follow ES6+ best practices)
- Keep frontend files simple and well-commented
- Use browser DevTools for debugging (no source maps needed)

