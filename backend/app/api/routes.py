from typing import Optional
from fastapi import APIRouter
from pydantic import BaseModel
from app.services.connection_manager import ConnectionManager
from app.backends.serial_backend import SerialBackend

router = APIRouter()
connection_manager = ConnectionManager()


class ConnectionRequest(BaseModel):
    port: str
    baudrate: int = 115200
    connection_type: str = "serial"


@router.get("/ports")
async def list_ports():
    """List available serial ports."""
    ports = ConnectionManager.list_ports()
    return {"ports": ports}


@router.post("/connect")
async def connect(request: ConnectionRequest):
    """Connect to serial port or telnet host."""
    success = await connection_manager.connect(
        port=request.port,
        baudrate=request.baudrate,
        connection_type=request.connection_type
    )
    if success:
        return {"status": "connected", "port": request.port}
    else:
        return {"status": "error", "message": "Failed to connect"}


@router.post("/disconnect")
async def disconnect(request: Optional[ConnectionRequest] = None):
    """Disconnect from a specific serial port or all if none specified."""
    port = request.port if request else None
    await connection_manager.disconnect(port)
    return {"status": "disconnected", "port": port}


@router.get("/status")
async def get_status():
    """Get status of all active serial connections."""
    active_sessions = []
    for port, backend in connection_manager.backends.items():
        if backend.is_connected():
            baudrate = getattr(backend, 'serial_port', None)
            baudrate = baudrate.baudrate if baudrate else getattr(backend, 'baudrate', None)
            
            # If still None (Telnet), maybe just skip or use default
            
            active_sessions.append({
                "port": port,
                "baudrate": baudrate,
                "connected": True
            })
    
    return {
        "sessions": active_sessions,
        "any_connected": len(active_sessions) > 0
    }


# Export connection_manager for WebSocket handler
def get_connection_manager() -> ConnectionManager:
    """Get connection manager instance."""
    return connection_manager

