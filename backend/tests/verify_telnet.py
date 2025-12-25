import asyncio
import sys
import os

# Add backend directory to path
sys.path.append(os.path.abspath(os.path.join(os.path.dirname(__file__), '..')))

from app.services.connection_manager import ConnectionManager

SERIAL_MANAGER = ConnectionManager()
TEST_PORT = 12345
TEST_HOST = '127.0.0.1'

async def start_mock_server():
    async def handle_client(reader, writer):
        print("Mock Server: Client connected")
        while True:
            data = await reader.read(100)
            if not data:
                break
            print(f"Mock Server: Received {data!r}")
            writer.write(data)
            await writer.drain()
        print("Mock Server: Client disconnected")
        writer.close()

    server = await asyncio.start_server(handle_client, TEST_HOST, TEST_PORT)
    addr = server.sockets[0].getsockname()
    print(f"Mock Server: Serving on {addr}")
    return server

async def test_client():
    connection_string = f"{TEST_HOST}:{TEST_PORT}"
    print(f"Test Client: Connecting to {connection_string}...")
    
    success = await SERIAL_MANAGER.connect(
        port=connection_string,
        connection_type='telnet'
    )
    
    if not success:
        print("Test Client: Failed to connect")
        return False

    backend = SERIAL_MANAGER.get_backend(connection_string)
    if not backend:
        print("Test Client: Backend not found")
        return False

    # Setup callback to verify reception
    received_data = asyncio.Queue()
    
    def on_data(data):
        print(f"Test Client: Callback received {data!r}")
        received_data.put_nowait(data)
        
    backend.set_data_callback(on_data)

    test_msg = b"Hello Telnet"
    print(f"Test Client: Sending {test_msg!r}")
    await backend.send(test_msg)
    
    try:
        data = await asyncio.wait_for(received_data.get(), timeout=2.0)
        if data == test_msg:
            print("Test Client: SUCCESS - Echo received")
            return True
        else:
            print(f"Test Client: FAILURE - Expected {test_msg!r}, got {data!r}")
            return False
    except asyncio.TimeoutError:
        print("Test Client: FAILURE - Timeout waiting for echo")
        return False
    finally:
        await SERIAL_MANAGER.disconnect(connection_string)

async def main():
    server = await start_mock_server()
    
    # Give server a moment to start
    await asyncio.sleep(0.5)
    
    try:
        success = await test_client()
        if success:
            print("VERIFICATION PASSED")
            sys.exit(0)
        else:
            print("VERIFICATION FAILED")
            sys.exit(1)
    finally:
        server.close()
        await server.wait_closed()

if __name__ == "__main__":
    asyncio.run(main())
