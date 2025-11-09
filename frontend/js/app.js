// Zephyr Device Manager - Main Application
function terminalApp() {
    return {
        // State
        connected: false,
        showSettings: false,
        selectedPort: '',
        manualPort: '',  // Add this line
        baudRate: '115200',
        availablePorts: [],
        loadingPorts: false,
        statusMessage: '',
        statusMessageType: 'info',
        connecting: false,
        currentPort: '',
        
        // WebSocket and Terminal
        ws: null,
        terminal: null,
        
        // Initialize application
        async init() {
            // Initialize terminal
            this.initTerminal();
            
            // Load available ports
            await this.loadPorts();
            
            // Check connection status
            await this.checkStatus();
        },
        
        // Initialize xterm.js terminal
        initTerminal() {
            const Terminal = window.Terminal;
            const FitAddon = window.FitAddon;
            
            this.terminal = new Terminal({
                cursorBlink: true,
                fontSize: 14,
                fontFamily: 'Consolas, "Courier New", monospace',
                theme: {
                    background: '#1e1e1e',
                    foreground: '#d4d4d4',
                    cursor: '#aeafad',
                    black: '#1e1e1e',
                    red: '#f44747',
                    green: '#4ec9b0',
                    yellow: '#dcdcaa',
                    blue: '#569cd6',
                    magenta: '#c586c0',
                    cyan: '#4ec9b0',
                    white: '#d4d4d4',
                }
            });
            
            const fitAddon = new FitAddon.FitAddon();
            this.terminal.loadAddon(fitAddon);
            
            const terminalElement = document.getElementById('terminal');
            this.terminal.open(terminalElement);
            fitAddon.fit();
            
            // Handle window resize
            window.addEventListener('resize', () => {
                fitAddon.fit();
            });
            
            // Handle terminal input
            this.terminal.onData((data) => {
                if (this.ws && this.ws.readyState === WebSocket.OPEN) {
                    this.ws.send(data);
                }
            });
            
            this.terminal.writeln('Zephyr Device Manager Terminal');
            this.terminal.writeln('Click "Settings" to configure serial port connection.');
        },
        
        // Load available serial ports
        async loadPorts() {
            this.loadingPorts = true;
            try {
                const response = await fetch('/api/ports');
                const data = await response.json();
                this.availablePorts = data.ports || [];
                
                // If no port selected and ports available, select first one
                if (!this.selectedPort && this.availablePorts.length > 0) {
                    this.selectedPort = this.availablePorts[0].device;
                }
            } catch (error) {
                console.error('Error loading ports:', error);
                this.showStatus('Error loading ports: ' + error.message, 'error');
            } finally {
                this.loadingPorts = false;
            }
        },
        
        // Check connection status
        async checkStatus() {
            try {
                const response = await fetch('/api/status');
                const data = await response.json();
                this.connected = data.connected || false;
                this.currentPort = data.port || '';
                
                if (this.connected) {
                    this.connectWebSocket();
                }
            } catch (error) {
                console.error('Error checking status:', error);
            }
        },
        
        // Toggle connection
        async toggleConnection() {
            if (this.connected) {
                await this.disconnect();
            } else {
                this.showSettings = true;
            }
        },
        
        // Save settings and connect
        async saveSettings() {
            if (!this.selectedPort) {
                this.showStatus('Please select a serial port', 'error');
                return;
            }
            
            this.connecting = true;
            this.statusMessage = '';
            
            try {
                // Disconnect if already connected
                if (this.connected) {
                    await this.disconnect();
                }
                
                // Connect to serial port
                const response = await fetch('/api/connect', {
                    method: 'POST',
                    headers: {
                        'Content-Type': 'application/json',
                    },
                    body: JSON.stringify({
                        port: this.selectedPort,
                        baudrate: parseInt(this.baudRate)
                    })
                });
                
                const data = await response.json();
                
                if (data.status === 'connected') {
                    this.connected = true;
                    this.currentPort = this.selectedPort;
                    this.showSettings = false;
                    this.showStatus('Connected to ' + this.selectedPort, 'success');
                    
                    // Connect WebSocket
                    this.connectWebSocket();
                } else {
                    this.showStatus('Failed to connect: ' + (data.message || 'Unknown error'), 'error');
                }
            } catch (error) {
                console.error('Error connecting:', error);
                this.showStatus('Error connecting: ' + error.message, 'error');
            } finally {
                this.connecting = false;
            }
        },
        
        // Connect WebSocket
        connectWebSocket() {
            // Close existing connection
            if (this.ws) {
                this.ws.close();
            }
            
            // Determine WebSocket URL
            const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
            const wsUrl = `${protocol}//${window.location.host}/ws`;
            
            this.ws = new WebSocket(wsUrl);
            
            this.ws.onopen = () => {
                console.log('WebSocket connected');
                if (this.terminal) {
                    this.terminal.write('\r\n[WebSocket connected]\r\n');
                    // Test: write a test message to verify terminal works
                    setTimeout(() => {
                        if (this.terminal) {
                            this.terminal.write('[Test: Terminal is working]\r\n');
                        }
                    }, 1000);
                } else {
                    console.error('Terminal not initialized when WebSocket opened!');
                }
            };
            
            // Track message count for debugging
            let messageCount = 0;
            
            this.ws.onmessage = (event) => {
                messageCount++;
                // Log first 10 messages, then every 100th message
                if (messageCount <= 10 || messageCount % 100 === 0) {
                    console.log(`[${messageCount}] WebSocket message: ${event.data.length} chars`, 
                                event.data.length > 0 ? `"${event.data.substring(0, Math.min(50, event.data.length))}"` : '(empty)');
                }
                
                // Check if message is JSON (error message)
                // Only check if it starts with '{' and is short (JSON errors are short)
                if (event.data.length < 100 && event.data.trim().startsWith('{')) {
                    try {
                        const data = JSON.parse(event.data);
                        if (data.type === 'error') {
                            console.error('WebSocket error:', data.message);
                            if (this.terminal) {
                                this.terminal.writeln('\r\n[Error] ' + data.message);
                            }
                        }
                        return;
                    } catch (e) {
                        // Not valid JSON, continue as text
                    }
                }
                
                // Treat as text data from serial port
                if (!this.terminal) {
                    console.error('Terminal not initialized!');
                    return;
                }
                
                try {
                    // Write data directly to terminal
                    // xterm.js handles this efficiently
                    this.terminal.write(event.data);
                    
                    // Log first few successful writes
                    if (messageCount <= 5) {
                        console.log(`[${messageCount}] Written to terminal successfully`);
                    }
                } catch (e) {
                    console.error('Error writing to terminal:', e, 'Data:', event.data);
                }
            };
            
            this.ws.onerror = (error) => {
                console.error('WebSocket error:', error);
                if (this.terminal) {
                    this.terminal.write('\r\n[WebSocket error]\r\n');
                }
            };
            
            this.ws.onclose = () => {
                console.log('WebSocket disconnected');
                if (this.terminal && this.connected) {
                    this.terminal.write('\r\n[WebSocket disconnected]\r\n');
                }
            };
        },
        
        // Disconnect
        async disconnect() {
            try {
                // Close WebSocket
                if (this.ws) {
                    this.ws.close();
                    this.ws = null;
                }
                
                // Disconnect serial port
                const response = await fetch('/api/disconnect', {
                    method: 'POST'
                });
                
                const data = await response.json();
                this.connected = false;
                this.currentPort = '';
                
                if (this.terminal) {
                    this.terminal.write('\r\n\r\n[Disconnected]\r\n');
                }
            } catch (error) {
                console.error('Error disconnecting:', error);
            }
        },
        
        // Show status message
        showStatus(message, type = 'info') {
            this.statusMessage = message;
            this.statusMessageType = type;
            
            // Clear message after 5 seconds
            setTimeout(() => {
                this.statusMessage = '';
            }, 5000);
        }
    };
}

