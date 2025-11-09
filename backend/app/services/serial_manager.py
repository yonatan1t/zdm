"""Serial port manager service."""
from typing import Optional
from app.backends.serial_backend import SerialBackend


class SerialManager:
    """Manages serial port connections."""
    
    def __init__(self):
        self.backend: Optional[SerialBackend] = None
        self.data_callback: Optional[callable] = None
    
    async def connect(self, port: str, baudrate: int = 115200, **kwargs) -> bool:
        """Connect to serial port.
        
        Args:
            port: Serial port name
            baudrate: Baud rate
            **kwargs: Additional serial port parameters
            
        Returns:
            True if connection successful, False otherwise
        """
        self.backend = SerialBackend()
        
        if self.data_callback:
            self.backend.set_data_callback(self.data_callback)
        
        return await self.backend.connect(port=port, baudrate=baudrate, **kwargs)
    
    async def disconnect(self) -> None:
        """Disconnect from serial port."""
        if self.backend:
            await self.backend.disconnect()
            self.backend = None
    
    async def send(self, data: bytes) -> None:
        """Send data to serial port.
        
        Args:
            data: Data to send
        """
        if not self.backend or not self.backend.is_connected():
            raise RuntimeError("Serial port not connected")
        
        await self.backend.send(data)
    
    def is_connected(self) -> bool:
        """Check if serial port is connected.
        
        Returns:
            True if connected, False otherwise
        """
        return self.backend is not None and self.backend.is_connected()
    
    def set_data_callback(self, callback: callable) -> None:
        """Set callback for received data.
        
        Args:
            callback: Function to call when data is received
        """
        self.data_callback = callback
        if self.backend:
            self.backend.set_data_callback(callback)
    
    @staticmethod
    def list_ports() -> list[dict]:
        """List available serial ports.
        
        Returns:
            List of available serial ports
        """
        return SerialBackend.list_ports()

