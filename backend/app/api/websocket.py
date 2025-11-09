"""WebSocket endpoint for real-time serial communication."""
import asyncio
from fastapi import WebSocket, WebSocketDisconnect
from app.api.routes import get_serial_manager


async def websocket_endpoint(websocket: WebSocket):
    """WebSocket endpoint for serial communication."""
    await websocket.accept()
    
    serial_manager = get_serial_manager()
    
    # Log connection status
    print(f"WebSocket connected. Serial port connected: {serial_manager.is_connected()}")
    
    # Queue for received data from serial port (larger queue for high data rates)
    data_queue = asyncio.Queue(maxsize=1000)
    
    # Use a simple queue - no need for complex buffering
    # The queue itself handles batching, and we send data as it arrives
    # Data callback to queue received data
    def sync_callback(data: bytes):
        """Callback for serial data - queues data for async processing."""
        try:
            # Put data directly in queue (non-blocking)
            # The queue will batch automatically as the consumer reads it
            try:
                data_queue.put_nowait(data)
            except asyncio.QueueFull:
                print("WARNING: Data queue full, dropping data")
        except Exception as e:
            print(f"Error in callback: {e}")
            import traceback
            traceback.print_exc()
    
    print(f"WebSocket: Setting callback. Serial connected: {serial_manager.is_connected()}")
    serial_manager.set_data_callback(sync_callback)
    print(f"WebSocket: Callback set: {serial_manager.data_callback is not None}")
    
    # Task to process queued data and send to WebSocket
    async def send_data_task():
        """Task to send queued serial data to WebSocket."""
        while True:
            try:
                data = await data_queue.get()
                try:
                    text_data = data.decode('utf-8', errors='replace')
                    await websocket.send_text(text_data)
                    # Only log occasionally to reduce noise
                    # print(f"TX: {len(text_data)} chars -> WebSocket")
                except Exception as e:
                    print(f"ERROR: Failed to send to WebSocket: {e}")
                    import traceback
                    traceback.print_exc()
                    break
            except asyncio.CancelledError:
                break
            except Exception as e:
                print(f"ERROR in send_data_task: {e}")
                import traceback
                traceback.print_exc()
                break
    
    send_task = asyncio.create_task(send_data_task())
    
    try:
        while True:
            # Receive message from client
            data = await websocket.receive_text()
            
            # Send to serial port if connected
            if serial_manager.is_connected():
                try:
                    await serial_manager.send(data.encode('utf-8'))
                except Exception as e:
                    await websocket.send_json({
                        "type": "error",
                        "message": f"Error sending to serial port: {str(e)}"
                    })
            else:
                await websocket.send_json({
                    "type": "error",
                    "message": "Serial port not connected"
                })
    
    except WebSocketDisconnect:
        print("WebSocket client disconnected")
    except Exception as e:
        print(f"WebSocket error: {e}")
    finally:
        # Clean up
        send_task.cancel()
        try:
            await send_task
        except asyncio.CancelledError:
            pass
        serial_manager.set_data_callback(None)

