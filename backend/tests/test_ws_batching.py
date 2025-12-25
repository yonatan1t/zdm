
import asyncio
import sys

# Mocking the logic directly since we can't easily import the inner function without refactoring
async def processing_logic(data_queue, mock_send):
    """
    Replicated logic from send_data_task in websocket.py
    """
    while True:
        try:
            # Get first item (blocking)
            data = await data_queue.get()
            
            # Try to get more items if available immediately (up to 50 items or ~32KB to avoid latency)
            # This creates a "batch" of data to send in one frame
            batch_buffer = [data]
            curr_size = len(data)
            
            try:
                # Collect pending items without blocking
                while not data_queue.empty() and len(batch_buffer) < 50 and curr_size < 32768:
                    next_data = data_queue.get_nowait()
                    batch_buffer.append(next_data)
                    curr_size += len(next_data)
            except asyncio.QueueEmpty:
                pass
            
            # Combine all chunks
            combined_data = b''.join(batch_buffer)
            
            try:
                text_data = combined_data.decode('utf-8', errors='replace')
                await mock_send(text_data)
            except Exception as e:
                print(f"ERROR: Failed to send: {e}")
                break
        except asyncio.CancelledError:
            break
        except Exception as e:
            print(f"ERROR: {e}")
            break

async def test_batching():
    print("Starting batching test...")
    data_queue = asyncio.Queue()
    received_messages = []
    
    async def mock_send(text):
        received_messages.append(text)
        print(f"Sent message: {len(text)} chars")
    
    # Start the consumer task
    task = asyncio.create_task(processing_logic(data_queue, mock_send))
    
    # PRODUCER: Rapidly put 10 items into the queue
    print("Putting 10 items into queue...")
    test_chars = [b'a', b'b', b'c', b'd', b'e', b'f', b'g', b'h', b'i', b'j']
    for char in test_chars:
        data_queue.put_nowait(char)
        # Yield to event loop briefly to ensure they are available but not consumed yet?
        # Actually, since get() is async, if we put_nowait sequentially without await, 
        # the consumer task handles them in the first wake up after this block.
        
    # Allow the consumer to run
    await asyncio.sleep(0.1)
    
    # VERIFY
    print(f"Total messages sent: {len(received_messages)}")
    print(f"Messages: {received_messages}")
    
    if len(received_messages) == 1 and received_messages[0] == "abcdefghij":
        print("SUCCESS: Items were batched into a single message.")
    elif len(received_messages) < 10:
        print("PARTIAL SUCCESS: Items were batched, but maybe not into one.")
    else:
        print("FAILURE: No batching occurred.")
        sys.exit(1)
        
    task.cancel()
    try:
        await task
    except asyncio.CancelledError:
        pass

if __name__ == "__main__":
    asyncio.run(test_batching())
