"""Telnet/TCP backend implementation."""
import asyncio
from typing import Optional, Callable
from collections import deque
from .base import BaseBackend


class TelnetBackend(BaseBackend):
    """Telnet (Raw TCP) communication backend."""
    
    def __init__(self):
        self.reader: Optional[asyncio.StreamReader] = None
        self.writer: Optional[asyncio.StreamWriter] = None
        self.data_callback: Optional[Callable[[bytes], None]] = None
        self.read_task: Optional[asyncio.Task] = None
        self._connected = False
        self.history_buffer = deque(maxlen=1024 * 100)  # Store last 100KB
    
    async def connect(self, host: str, port: int, **kwargs) -> bool:
        """Connect to TCP server.
        
        Args:
            host: Hostname or IP address
            port: Port number
            **kwargs: Additional parameters (ignored)
            
        Returns:
            True if connection successful, False otherwise
        """
        try:
            if self._connected:
                await self.disconnect()
            
            print(f"Connecting to {host}:{port}...")
            self.reader, self.writer = await asyncio.open_connection(host, port)
            
            self._connected = True
            print(f"Connected to {host}:{port}")
            
            # Start reading task
            self.read_task = asyncio.create_task(self._read_loop())
            
            return True
        except Exception as e:
            print(f"Error connecting to {host}:{port}: {e}")
            self._connected = False
            return False
    
    async def disconnect(self) -> None:
        """Close TCP connection."""
        self._connected = False
        
        if self.read_task:
            self.read_task.cancel()
            try:
                await self.read_task
            except asyncio.CancelledError:
                pass
            self.read_task = None
        
        if self.writer:
            try:
                self.writer.close()
                await self.writer.wait_closed()
            except Exception as e:
                print(f"Error closing writer: {e}")
        
        self.reader = None
        self.writer = None
    
    async def send(self, data: bytes) -> None:
        """Send data to TCP connection.
        
        Args:
            data: Data to send
        """
        if not self.writer or not self._connected:
            raise RuntimeError("Not connected")
        
        self.writer.write(data)
        await self.writer.drain()
    
    def is_connected(self) -> bool:
        """Check if backend is connected.
        
        Returns:
            True if connected, False otherwise
        """
        return self._connected and self.writer is not None and not self.writer.is_closing()
    
    def set_data_callback(self, callback: Callable[[bytes], None]) -> None:
        """Set callback function for received data.
        
        Args:
            callback: Function to call when data is received
        """
        self.data_callback = callback
        
    def get_history(self) -> bytes:
        """Get the current history buffer content.
        
        Returns:
            The raw bytes currently stored in the history buffer.
        """
        return bytes(self.history_buffer)
        
    async def _read_loop(self) -> None:
        """Background task to read data from connection."""
        print("Read loop started")
        
        while self._connected:
            try:
                if not self.reader:
                    break
                    
                data = await self.reader.read(4096)
                
                if not data:
                    print("Connection closed by server")
                    self._connected = False
                    break
                    
                # Append to history
                self.history_buffer.extend(data)
                
                if self.data_callback:
                    self.data_callback(data)
                        
            except asyncio.CancelledError:
                print("Read loop cancelled")
                break
            except Exception as e:
                print(f"Error in read loop: {e}")
                self._connected = False
                break
