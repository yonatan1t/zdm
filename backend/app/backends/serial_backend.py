"""Serial port backend implementation."""
import asyncio
import serial
import serial.tools.list_ports
import os
import glob
from typing import Optional, Callable
from .base import BaseBackend

# Import termios for terminal control (Linux/Unix only)
try:
    import termios
    import fcntl
    import select
    TERMIOS_AVAILABLE = True
except ImportError:
    TERMIOS_AVAILABLE = False
    select = None


class SerialBackend(BaseBackend):
    """Serial port communication backend."""
    
    def __init__(self):
        self.serial_port: Optional[serial.Serial] = None
        self.data_callback: Optional[Callable[[bytes], None]] = None
        self.read_task: Optional[asyncio.Task] = None
        self._connected = False
    
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
            
            # Check if this is a pseudo-terminal (pts)
            is_pts = '/dev/pts/' in port or port.startswith('/dev/pts/')
            
            # Configure serial port parameters
            # For pseudo-terminals, use a longer timeout to allow blocking reads
            # This ensures we wait for data to arrive
            serial_params = {
                'port': port,
                'timeout': 0.5 if is_pts else 1,  # Longer timeout for pts to allow blocking reads
                'write_timeout': 1,
            }
            
            # For pseudo-terminals, baudrate doesn't matter, but pyserial requires it
            # Use a default baudrate but the pts will ignore it
            if not is_pts:
                serial_params['baudrate'] = baudrate
            else:
                # Pseudo-terminals don't use baudrate, but pyserial needs it
                serial_params['baudrate'] = 115200
            
            # Add any additional parameters
            serial_params.update(kwargs)
            
            self.serial_port = serial.Serial(**serial_params)
            
            # For pseudo-terminals, set to raw mode if possible
            # This is important for Zephyr native sim
            if is_pts and TERMIOS_AVAILABLE:
                try:
                    # Get current terminal settings
                    fd = self.serial_port.fileno()
                    attrs = termios.tcgetattr(fd)
                    
                    # Set raw mode: no echo, no canonical mode, no signals
                    attrs[3] = attrs[3] & ~(termios.ECHO | termios.ICANON | termios.ISIG)
                    attrs[0] = attrs[0] & ~(termios.IGNBRK | termios.BRKINT | termios.PARMRK | 
                                           termios.ISTRIP | termios.INLCR | termios.IGNCR | 
                                           termios.ICRNL | termios.IXON)
                    attrs[1] = attrs[1] & ~termios.OPOST
                    attrs[2] = attrs[2] & ~(termios.CSIZE | termios.PARENB)
                    attrs[2] = attrs[2] | termios.CS8
                    
                    # Set VMIN and VTIME for blocking reads with timeout
                    # VMIN=0: don't require minimum bytes (allows timeout to work)
                    # VTIME=5: 0.5 second timeout (in deciseconds)
                    # This works with pyserial's timeout mechanism
                    attrs[6][termios.VMIN] = 0
                    attrs[6][termios.VTIME] = 5  # 0.5 seconds
                    
                    termios.tcsetattr(fd, termios.TCSANOW, attrs)
                    print(f"Set raw mode with VMIN=0, VTIME=5 for pseudo-terminal {port}")
                except Exception as e:
                    print(f"Warning: Could not set raw mode for pseudo-terminal: {e}")
                    # Continue anyway - it might still work
            
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
    
    async def _read_loop(self) -> None:
        """Background task to read data from serial port."""
        is_pts = self.serial_port and '/dev/pts/' in self.serial_port.port if self.serial_port else False
        
        print(f"Read loop started for {'PTS' if is_pts else 'serial'} port: {self.serial_port.port if self.serial_port else 'None'}")
        print(f"Callback set: {self.data_callback is not None}")
        
        loop = asyncio.get_event_loop()
        
        while self._connected:
            try:
                if not self.serial_port or not self.serial_port.is_open:
                    print("Serial port not open, exiting read loop")
                    break
                
                # Use select for pseudo-terminals to wait for data
                # This is more reliable than polling in_waiting
                def blocking_read():
                    """Blocking read that waits for data with timeout."""
                    try:
                        if is_pts and select:
                            # Use select to wait for data to be available
                            # This is more reliable for pseudo-terminals
                            fd = self.serial_port.fileno()
                            ready, _, _ = select.select([fd], [], [], 0.1)  # 0.1 second timeout
                            if ready:
                                # Data is available, read it
                                if self.serial_port.in_waiting > 0:
                                    return self.serial_port.read(self.serial_port.in_waiting)
                                else:
                                    # Even if in_waiting is 0, try reading (data might be there)
                                    return self.serial_port.read(4096)
                            else:
                                # Timeout, no data available
                                return b''
                        else:
                            # For real serial ports or if select is not available
                            if self.serial_port.in_waiting > 0:
                                return self.serial_port.read(self.serial_port.in_waiting)
                            else:
                                # Try a blocking read with timeout
                                return self.serial_port.read(1)
                    except serial.SerialTimeoutException:
                        return b''
                    except Exception as e:
                        print(f"Error in blocking_read: {e}")
                        import traceback
                        traceback.print_exc()
                        return b''
                
                # Read data in executor (non-blocking for async loop)
                data = await loop.run_in_executor(None, blocking_read)
                
                if data:
                    # Read any additional data that became available while we were reading
                    while True:
                        try:
                            if self.serial_port.in_waiting > 0:
                                additional_data = await loop.run_in_executor(
                                    None,
                                    lambda: self.serial_port.read(min(self.serial_port.in_waiting, 4096))
                                )
                                if additional_data:
                                    data += additional_data
                                else:
                                    break
                            else:
                                break
                        except:
                            break
                    
                    if data:
                        if self.data_callback:
                            try:
                                self.data_callback(data)
                                # Only log occasionally to reduce noise
                                # print(f"Read {len(data)} bytes -> callback")
                            except Exception as e:
                                print(f"ERROR in callback: {e}")
                                import traceback
                                traceback.print_exc()
                        else:
                            print(f"WARNING: Read {len(data)} bytes but callback is None!")
                else:
                    # No data received, small sleep to prevent busy loop
                    await asyncio.sleep(0.001 if is_pts else 0.01)
                        
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

