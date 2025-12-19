from typing import Optional
from fastapi import APIRouter
from pydantic import BaseModel
from app.services.serial_manager import SerialManager

router = APIRouter()
serial_manager = SerialManager()


class ConnectionRequest(BaseModel):
    port: str
    baudrate: int = 115200


@router.get("/ports")
async def list_ports():
    """List available serial ports."""
    ports = SerialManager.list_ports()
    return {"ports": ports}


@router.post("/connect")
async def connect(request: ConnectionRequest):
    """Connect to serial port."""
    success = await serial_manager.connect(
        port=request.port,
        baudrate=request.baudrate
    )
    if success:
        return {"status": "connected", "port": request.port}
    else:
        return {"status": "error", "message": "Failed to connect"}


@router.post("/disconnect")
async def disconnect(request: Optional[ConnectionRequest] = None):
    """Disconnect from a specific serial port or all if none specified."""
    port = request.port if request else None
    await serial_manager.disconnect(port)
    return {"status": "disconnected", "port": port}


@router.get("/status")
async def get_status():
    """Get status of all active serial connections."""
    active_sessions = []
    for port, backend in serial_manager.backends.items():
        if backend.is_connected():
            active_sessions.append({
                "port": port,
                "baudrate": backend.serial_port.baudrate if backend.serial_port else None,
                "connected": True
            })
    
    return {
        "sessions": active_sessions,
        "any_connected": len(active_sessions) > 0
    }


# Export serial_manager for WebSocket handler
def get_serial_manager() -> SerialManager:
    """Get serial manager instance."""
    return serial_manager

