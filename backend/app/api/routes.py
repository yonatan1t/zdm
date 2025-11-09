"""REST API routes."""
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
async def disconnect():
    """Disconnect from serial port."""
    await serial_manager.disconnect()
    return {"status": "disconnected"}


@router.get("/status")
async def get_status():
    """Get connection status."""
    return {
        "connected": serial_manager.is_connected(),
        "port": serial_manager.backend.serial_port.port if serial_manager.backend and serial_manager.backend.serial_port else None
    }


# Export serial_manager for WebSocket handler
def get_serial_manager() -> SerialManager:
    """Get serial manager instance."""
    return serial_manager

