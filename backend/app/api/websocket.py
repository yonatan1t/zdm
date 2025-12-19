"""WebSocket endpoint for real-time serial communication."""
import asyncio
from fastapi import WebSocket, WebSocketDisconnect
from app.api.routes import get_serial_manager


async def websocket_endpoint(websocket: WebSocket):
    """WebSocket endpoint for serial communication."""
    await websocket.accept()
    
    # Get port from query params
    port = websocket.query_params.get('port')
    
    if not port:
        await websocket.send_json({
            "type": "error",
            "message": "Missing port query parameter"
        })
        await websocket.close()
        return

    serial_manager = get_serial_manager()
    backend = serial_manager.get_backend(port)
    
    if not backend or not backend.is_connected():
        await websocket.send_json({
            "type": "error",
            "message": f"Serial port {port} not connected"
        })
        await websocket.close()
        return
    
    # Log connection status
    print(f"WebSocket connected for port: {port}")

    # Replay history to new connection
    history = backend.get_history()
    if history:
        await websocket.send_text(history.decode('utf-8', errors='replace'))
    else:
        # If no history, send an initial enter to trigger the prompt
        await backend.send(b'\r')
    
    # Queue for received data from serial port
    data_queue = asyncio.Queue(maxsize=1000)
    
    def sync_callback(data: bytes):
        """Callback for serial data - queues data for async processing."""
        try:
            try:
                data_queue.put_nowait(data)
            except asyncio.QueueFull:
                print(f"WARNING: Data queue full for {port}, dropping data")
        except Exception as e:
            print(f"Error in callback for {port}: {e}")
    
    # Set the callback for THIS SPECIFIC backend instance
    backend.set_data_callback(sync_callback)
    
    # Task to process queued data and send to WebSocket
    async def send_data_task():
        """Task to send queued serial data to WebSocket."""
        while True:
            try:
                data = await data_queue.get()
                try:
                    text_data = data.decode('utf-8', errors='replace')
                    await websocket.send_text(text_data)
                except Exception as e:
                    print(f"ERROR: Failed to send to WebSocket ({port}): {e}")
                    break
            except asyncio.CancelledError:
                break
            except Exception as e:
                print(f"ERROR in send_data_task ({port}): {e}")
                break
    
    send_task = asyncio.create_task(send_data_task())
    
    try:
        while True:
            # Receive message from client
            data = await websocket.receive_text()
            
            # Send to THIS SPECIFIC serial port
            if backend.is_connected():
                try:
                    await backend.send(data.encode('utf-8'))
                except Exception as e:
                    await websocket.send_json({
                        "type": "error",
                        "message": f"Error sending to serial port {port}: {str(e)}"
                    })
            else:
                await websocket.send_json({
                    "type": "error",
                    "message": f"Serial port {port} disconnected"
                })
                break
    
    except WebSocketDisconnect:
        print(f"WebSocket client disconnected for port: {port}")
    except Exception as e:
        print(f"WebSocket error for port {port}: {e}")
    finally:
        # Clean up
        send_task.cancel()
        try:
            await send_task
        except asyncio.CancelledError:
            pass
        
        # Only clear callback if this backend still exists and it's our callback
        if backend and backend.data_callback == sync_callback:
            backend.set_data_callback(None)
