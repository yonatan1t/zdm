"""Serial port manager service."""
from typing import Optional
from app.backends.serial_backend import SerialBackend


class SerialManager:
    """Manages multiple serial port connections."""
    
    def __init__(self):
        # Map port names to SerialBackend instances
        self.backends: dict[str, SerialBackend] = {}
    
    async def connect(self, port: str, baudrate: int = 115200, **kwargs) -> bool:
        """Connect to a specific serial port.
        
        Args:
            port: Serial port name
            baudrate: Baud rate
            **kwargs: Additional serial port parameters
            
        Returns:
            True if connection successful, False otherwise
        """
        if port in self.backends:
            if self.backends[port].is_connected():
                return True
            # If not connected but exists, clean up
            await self.backends[port].disconnect()
            
        backend = SerialBackend()
        success = await backend.connect(port=port, baudrate=baudrate, **kwargs)
        
        if success:
            self.backends[port] = backend
            return True
        return False
    
    async def disconnect(self, port: Optional[str] = None) -> None:
        """Disconnect from one or all serial ports.
        
        Args:
            port: Specific port to disconnect, or None for all
        """
        if port:
            if port in self.backends:
                await self.backends[port].disconnect()
                del self.backends[port]
        else:
            # Disconnect all
            for p in list(self.backends.keys()):
                await self.backends[p].disconnect()
            self.backends.clear()
    
    async def send(self, port: str, data: bytes) -> None:
        """Send data to a specific serial port.
        
        Args:
            port: Target port name
            data: Data to send
        """
        if port not in self.backends or not self.backends[port].is_connected():
            raise RuntimeError(f"Serial port {port} not connected")
        
        await self.backends[port].send(data)
    
    def is_connected(self, port: Optional[str] = None) -> bool:
        """Check if a specific port or any port is connected.
        
        Args:
            port: Specific port to check, or None for 'any'
            
        Returns:
            True if connected, False otherwise
        """
        if port:
            return port in self.backends and self.backends[port].is_connected()
        return any(b.is_connected() for b in self.backends.values())
    
    def get_backend(self, port: str) -> Optional[SerialBackend]:
        """Retrieve the backend instance for a port.
        
        Args:
            port: Port name
            
        Returns:
            SerialBackend instance or None
        """
        return self.backends.get(port)
    
    @staticmethod
    def list_ports() -> list[dict]:
        """List available serial ports.
        
        Returns:
            List of available serial ports
        """
        return SerialBackend.list_ports()

