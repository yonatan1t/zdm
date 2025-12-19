"""Serial port backend implementation."""
import asyncio
import serial
import serial.tools.list_ports
import os
import glob
from typing import Optional, Callable
from .base import BaseBackend
import select
from collections import deque


class SerialBackend(BaseBackend):
    """Serial port communication backend."""
    
    def __init__(self):
        self.serial_port: Optional[serial.Serial] = None
        self.data_callback: Optional[Callable[[bytes], None]] = None
        self.read_task: Optional[asyncio.Task] = None
        self._connected = False
        self.history_buffer = deque(maxlen=1024 * 100)  # Store last 100KB
    
    async def connect(self, port: str, baudrate: int = 115200, **kwargs) -> bool:
        """Connect to serial port.
        
        Args:
            port: Serial port name (e.g., 'COM3' on Windows, '/dev/ttyUSB0' on Linux)
            baudrate: Baud rate (default: 115200) - ignored for pseudo-terminals
            **kwargs: Additional serial port parameters
            
        Returns:
            True if connection successful, False otherwise
        """
        try:
            if self.serial_port and self.serial_port.is_open:
                await self.disconnect()
            
            # Configure serial port parameters
            # Use a short, non-blocking timeout. The read loop will handle waiting.
            serial_params = {
                'port': port,
                'baudrate': baudrate,
                'timeout': 0.1,
                'write_timeout': 1,
            }
            serial_params.update(kwargs)
            
            self.serial_port = serial.Serial(**serial_params)
            print(f"Connected to {port} at {baudrate} baud.")

            self._connected = True
            
            # Start reading task
            self.read_task = asyncio.create_task(self._read_loop())
            
            return True
        except Exception as e:
            print(f"Error connecting to serial port: {e}")
            import traceback
            traceback.print_exc()
            self._connected = False
            return False
    
    async def disconnect(self) -> None:
        """Close serial port connection."""
        self._connected = False
        
        if self.read_task:
            self.read_task.cancel()
            try:
                await self.read_task
            except asyncio.CancelledError:
                pass
            self.read_task = None
        
        if self.serial_port and self.serial_port.is_open:
            self.serial_port.close()
        
        self.serial_port = None
    
    async def send(self, data: bytes) -> None:
        """Send data to serial port.
        
        Args:
            data: Data to send
        """
        if not self.serial_port or not self.serial_port.is_open:
            raise RuntimeError("Serial port not connected")
        
        # Run blocking write in executor
        loop = asyncio.get_event_loop()
        await loop.run_in_executor(None, self.serial_port.write, data)
        await loop.run_in_executor(None, self.serial_port.flush)
    
    def is_connected(self) -> bool:
        """Check if serial port is connected.
        
        Returns:
            True if connected, False otherwise
        """
        return self._connected and self.serial_port is not None and self.serial_port.is_open
    
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
        """Background task to read data from serial port."""
        print(f"Read loop started for: {self.serial_port.port if self.serial_port else 'None'}")
        loop = asyncio.get_event_loop()
        
        while self._connected:
            try:
                if not self.serial_port or not self.serial_port.is_open:
                    print("Serial port closed, exiting read loop.")
                    break
                
                def blocking_read():
                    """Blocking read that waits for data based on pyserial timeout."""
                    try:
                        # Read available data, up to a large chunk size.
                        # This will block for up to `timeout` seconds (set in connect).
                        return self.serial_port.read(self.serial_port.in_waiting or 4096)
                    except (serial.SerialException, OSError) as e:
                        # This can happen if the device is disconnected.
                        print(f"Read error, disconnecting: {e}")
                        self._connected = False
                        return b''
                
                data = await loop.run_in_executor(None, blocking_read)
                
                if data:
                    # Append to history
                    self.history_buffer.extend(data)
                    
                    if self.data_callback:
                        self.data_callback(data)
                else:
                    # No data received, small sleep to prevent busy loop
                    await asyncio.sleep(0.01)
                        
            except asyncio.CancelledError:
                print("Read loop cancelled")
                break
            except Exception as e:
                print(f"Error in read loop: {e}")
                import traceback
                traceback.print_exc()
                await asyncio.sleep(0.1)  # Don't exit immediately, wait and retry
    
    @staticmethod
    def list_ports() -> list[dict]:
        """List available serial ports.
        
        Returns:
            List of dictionaries containing port information
        """
        ports = []
        for port in serial.tools.list_ports.comports():
            ports.append({
                "device": port.device,
                "description": port.description,
                "manufacturer": port.manufacturer,
                "hwid": port.hwid,
            })
        return ports
