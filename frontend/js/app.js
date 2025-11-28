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
        activeView: 'commands', // VSCode-style sidebar view

        // Command Discovery State
        showCommands: false,
        commands: [],
        loadingCommands: false,
        commandsCache: null,
        lastScannedTime: null,
        commandDiscoveryInProgress: false,
        discoveryLock: false, // Concurrency control lock
        discoveryCollectedData: '',
        selectedCommand: null,
        commandArgs: {},
        commandResult: '',
        expandedCommands: {}, // Track which commands are expanded to show subcommands
        discoveringSubcommands: {}, // Track which commands are currently discovering subcommands
        discoveryProgress: { current: 0, total: 0 }, // Track overall discovery progress

        // WebSocket and Terminal
        ws: null,
        terminal: null,

        // Initialize application (Now handles status checks/port loading)
        async init() {
            console.log("init() called");

            // Load saved manual port from localStorage
            const savedManualPort = localStorage.getItem('zdm_manual_port');
            if (savedManualPort) {
                this.manualPort = savedManualPort;
                console.log('Loaded saved manual port:', savedManualPort);
            }

            // Load available ports
            await this.loadPorts();

            // Check connection status
            await this.checkStatus();
        },

        // Initialize xterm.js terminalS
        initTerminal(fit) {
            console.log("initTerminal() called");
            if (!window.Terminal) {
                console.error("xterm.js not loaded!");
                return;
            }

            // Defer initialization using $nextTick from the HTML for sizing stability
            // ...

            const term = new window.Terminal({
                cursorBlink: true,
                theme: { background: '#1e1e1e', foreground: '#d4d4d4' }
            });

            const fitAddon = new window.FitAddon.FitAddon();
            term.loadAddon(fitAddon);

            const el = document.getElementById('terminal');
            term.open(el);

            fitAddon.fit();

            window.addEventListener('resize', () => {
                fitAddon.fit();
            });

            term.writeln("✅ Terminal initialized successfully and fitted");

            this.terminal = term;   // <-- critical line

            // 💡 NEW CODE BLOCK START: Enable User Input (Tx)
            // Add event listener to send input data to the WebSocket
            term.onData(data => {
                if (this.ws && this.ws.readyState === WebSocket.OPEN) {
                    // Send the raw data (keystrokes) directly to the server via WebSocket
                    this.ws.send(data);
                } else {
                    console.warn('Cannot send data: WebSocket is not open.');
                }
            });
            // 💡 NEW CODE BLOCK END
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
                this.activeView = 'settings'; // Open settings view to connect
            }
        },

        // Save settings and connect
        async saveSettings() {
            // Use manualPort if it has a value, otherwise use selectedPort from dropdown
            const portToConnect = this.manualPort || this.selectedPort;

            if (!portToConnect) {
                this.showStatus('Please select or enter a serial port', 'error');
                return;
            }

            // Save manual port to localStorage if it was used
            if (this.manualPort) {
                localStorage.setItem('zdm_manual_port', this.manualPort);
                console.log('Saved manual port to localStorage:', this.manualPort);
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
                        port: portToConnect,
                        baudrate: parseInt(this.baudRate)
                    })
                });

                const data = await response.json();

                if (data.status === 'connected') {
                    this.connected = true;
                    this.currentPort = portToConnect;
                    this.showSettings = false;
                    this.activeView = 'commands'; // Switch to commands view after connecting
                    this.showStatus('Connected to ' + portToConnect, 'success');

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

                // Collect data during command discovery
                if (this.commandDiscoveryInProgress) {
                    this.discoveryCollectedData += event.data;
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
        },

        // ============ COMMAND DISCOVERY SYSTEM ============

        // Load cached commands from localStorage
        loadCachedCommands() {
            const cached = localStorage.getItem('zephyr_commands_cache');
            if (cached) {
                try {
                    this.commandsCache = JSON.parse(cached);
                    
                    // Validate cache version and structure
                    if (!this.commandsCache.version || !this.commandsCache.commands) {
                        console.warn('Invalid cache structure, ignoring cache');
                        return false;
                    }
                    
                    this.commands = this.commandsCache.commands || [];
                    this.lastScannedTime = this.commandsCache.lastScanned;
                    
                    console.log(`Loaded ${this.commands.length} commands from cache`);
                    
                    // Count commands with subcommands
                    const withSubcommands = this.commands.filter(c => c.subcommands && c.subcommands.length > 0).length;
                    if (withSubcommands > 0) {
                        console.log(`  ${withSubcommands} commands have subcommands`);
                    }
                    
                    return true;
                } catch (error) {
                    console.error('Error loading cached commands:', error);
                    return false;
                }
            }
            return false;
        },

        // Save commands to localStorage
        saveCachedCommands(commands) {
            const cache = {
                commands: commands,
                lastScanned: new Date().toISOString(),
                version: '2.0' // Updated version to support hierarchical structure
            };
            localStorage.setItem('zephyr_commands_cache', JSON.stringify(cache));
            this.commandsCache = cache;
            this.commands = commands;
            this.lastScannedTime = cache.lastScanned;
            
            console.log(`Saved ${commands.length} commands to cache`);
        },

        // Scan and discover commands
        async scanCommands(force = false) {
            if (!this.connected) {
                this.showStatus('Must be connected to scan commands', 'error');
                return;
            }

            // Concurrency control: prevent concurrent scans
            if (this.discoveryLock) {
                this.showStatus('Command discovery already in progress. Please wait...', 'error');
                return;
            }

            this.discoveryLock = true;
            this.loadingCommands = true;
            this.showStatus('Scanning commands...', 'info');

            try {
                // Try to load cache first (for fast startup), unless forced
                if (!force && this.loadCachedCommands()) {
                    this.showStatus('Loaded cached commands from ' + new Date(this.lastScannedTime).toLocaleString(), 'success');
                    this.showCommands = true;
                    this.loadingCommands = false;
                    this.discoveryLock = false;
                    return;
                }

                // Initiate discovery
                this.commandDiscoveryInProgress = true;
                this.discoveryCollectedData = '';

                console.log('Starting command discovery...');

                // Send 'help' command to get list of commands
                this.sendDiscoveryCommand('help\n');

                // Wait for discovery to complete (with timeout)
                await this.waitForDiscoveryCompletion(300);

                this.showStatus('Commands scanned successfully! Discovering subcommands...', 'success');
                this.showCommands = true;
                
                // Automatically discover subcommands for all commands
                await this.discoverAllSubcommands();
                
                this.showStatus('All commands scanned!', 'success');
            } catch (error) {
                console.error('Error scanning commands:', error);
                this.showStatus('Error scanning commands: ' + error.message, 'error');
                console.log('Collected data:', this.discoveryCollectedData.substring(0, 500));
            } finally {
                this.loadingCommands = false;
                this.commandDiscoveryInProgress = false;
                this.discoveryLock = false;
            }
        },

        // Discover subcommands for all commands
        async discoverAllSubcommands() {
            if (this.commands.length === 0) return;
            
            this.discoveryProgress.total = this.commands.length;
            this.discoveryProgress.current = 0;
            
            console.log(`Starting automatic subcommand discovery for ${this.commands.length} commands`);
            
            for (let i = 0; i < this.commands.length; i++) {
                const cmd = this.commands[i];
                
                // Skip if already has subcommands
                if (cmd.subcommands && cmd.subcommands.length > 0) {
                    this.discoveryProgress.current++;
                    continue;
                }
                
                // Skip if already checked and has no subcommands
                if (cmd.hasSubcommands === false) {
                    this.discoveryProgress.current++;
                    continue;
                }
                
                try {
                    // Mark as discovering
                    this.discoveringSubcommands[cmd.id] = true;
                    
                    // Discover subcommands (without lock since we're already in a locked operation)
                    await this.discoverSubcommandsInternal(cmd);
                    
                } catch (error) {
                    console.error(`Error discovering subcommands for ${cmd.name}:`, error);
                } finally {
                    // Mark as done
                    this.discoveringSubcommands[cmd.id] = false;
                    this.discoveryProgress.current++;
                }
                
                // Small delay between commands to avoid overwhelming the shell
                await new Promise(resolve => setTimeout(resolve, 100));
            }
            
            console.log('Automatic subcommand discovery complete');
        },

        // Internal subcommand discovery (without lock checking)
        async discoverSubcommandsInternal(command) {
            this.commandDiscoveryInProgress = true;
            this.discoveryCollectedData = '';

            try {
                console.log(`Discovering subcommands for: ${command.name}`);

                // Send '<command> --help' to get subcommands (Zephyr shell syntax)
                this.sendDiscoveryCommand(`${command.name} --help\n`);

                // Wait for discovery to complete (with shorter timeout for subcommands)
                await this.waitForSubcommandDiscovery(2000); // 2 seconds

                console.log(`Discovery complete. Collected ${this.discoveryCollectedData.length} chars`);

                // Parse subcommands from help output
                const subcommands = this.parseSubcommands(this.discoveryCollectedData, command.name);

                if (subcommands.length > 0) {
                    // Update command with subcommands
                    command.subcommands = subcommands;
                    command.hasSubcommands = true;

                    // Update in commands array
                    const cmdIndex = this.commands.findIndex(c => c.id === command.id);
                    if (cmdIndex !== -1) {
                        this.commands[cmdIndex] = command;
                    }

                    // Save updated cache
                    this.saveCachedCommands(this.commands);

                    console.log(`Found ${subcommands.length} subcommands for ${command.name}`);
                } else {
                    command.hasSubcommands = false;
                    console.log(`No subcommands found for ${command.name}`);
                }
            } catch (error) {
                console.error('Error discovering subcommands:', error);
            } finally {
                this.commandDiscoveryInProgress = false;
            }
        },

        // Toggle commands view or scan
        toggleCommands() {
            if (this.commands.length > 0) {
                this.showCommands = true;
            } else {
                this.scanCommands();
            }
        },

        // Execute a command with args
        executeCommand(command) {
            if (!command) {
                this.showStatus('No command selected', 'error');
                return;
            }

            // Build command string with args
            // Use fullName for subcommands (e.g., "log backend"), otherwise use name
            let cmdString = command.fullName || command.name;
            
            if (this.commandArgs && Object.keys(this.commandArgs).length > 0) {
                for (const [argId, argValue] of Object.entries(this.commandArgs)) {
                    if (argValue && argValue.trim()) {
                        cmdString += ' ' + argValue.trim();
                    }
                }
            }

            console.log('Executing command:', cmdString);

            // Send command via WebSocket
            if (this.ws && this.ws.readyState === WebSocket.OPEN) {
                this.commandResult = 'Sending command...';
                this.ws.send(cmdString + '\n');

                // Clear args for next command
                this.commandArgs = {};
                this.showStatus('Command sent: ' + cmdString, 'success');
            } else {
                this.showStatus('WebSocket not connected', 'error');
            }
        },

        // Send command during discovery
        sendDiscoveryCommand(command) {
            if (this.ws && this.ws.readyState === WebSocket.OPEN) {
                this.ws.send(command);
            }
        },

        // Wait for discovery to complete
        waitForDiscoveryCompletion(timeout) {
            return new Promise((resolve, reject) => {
                const startTime = Date.now();
                let lastDataLength = 0;
                let noDataChangedCount = 0;
                let resolved = false;

                const checkCompletion = () => {
                    if (resolved) return; // Prevent multiple resolutions

                    console.log(`Discovery check: data length = ${this.discoveryCollectedData.length}, timeout in ${timeout - (Date.now() - startTime)}ms`);

                    // Check if we have help output with commands
                    if (this.discoveryCollectedData.includes('Available commands:')) {
                        // Parse the help output
                        const parsed = this.parseHelpOutput(this.discoveryCollectedData);

                        console.log(`Found ${parsed.length} commands`);

                        if (parsed.length > 0) {
                            // Successfully got command list
                            resolved = true;
                            this.commands = parsed;
                            this.saveCachedCommands(parsed);
                            this.commandDiscoveryInProgress = false;
                            console.log('✓ Discovery successful with', parsed.length, 'commands');
                            resolve();
                            return;
                        }
                    }

                    // Check if data has stopped changing (no new data for 2 seconds)
                    if (this.discoveryCollectedData.length === lastDataLength) {
                        noDataChangedCount++;
                        if (noDataChangedCount >= 4) { // 2 seconds with no change
                            console.log('No new data for 2 seconds, treating as complete');
                            const parsed = this.parseHelpOutput(this.discoveryCollectedData);
                            if (parsed.length > 0) {
                                resolved = true;
                                this.commands = parsed;
                                this.saveCachedCommands(parsed);
                                console.log('✓ Discovery successful (data stable) with', parsed.length, 'commands');
                                resolve();
                                return;
                            } else {
                                // No commands found - reject instead of looping
                                resolved = true;
                                console.log('✗ Data stable but no commands found. Raw data length:', this.discoveryCollectedData.length);
                                reject(new Error('No commands found in help output'));
                                return;
                            }
                        }
                    } else {
                        noDataChangedCount = 0;
                        lastDataLength = this.discoveryCollectedData.length;
                    }

                    // Check timeout
                    if (Date.now() - startTime > timeout) {
                        resolved = true;
                        console.log('✗ Timeout reached. Final data length:', this.discoveryCollectedData.length);
                        reject(new Error('Command discovery timeout - no valid help output received'));
                        return;
                    }

                    // Try again in 500ms
                    setTimeout(checkCompletion, 500);
                };

                checkCompletion();
            });
        },

        // Wait for subcommand discovery to complete
        waitForSubcommandDiscovery(timeout) {
            return new Promise((resolve, reject) => {
                const startTime = Date.now();
                let lastDataLength = 0;
                let noDataChangedCount = 0;
                let resolved = false;

                const checkCompletion = () => {
                    if (resolved) return;

                    const elapsed = Date.now() - startTime;
                    console.log(`Subcommand discovery check: data length = ${this.discoveryCollectedData.length}, elapsed = ${elapsed}ms`);

                    // Check if data has stopped changing (no new data for 1 second)
                    if (this.discoveryCollectedData.length === lastDataLength) {
                        noDataChangedCount++;
                        if (noDataChangedCount >= 2) { // 1 second with no change (2 * 500ms)
                            console.log('Data stable, completing discovery');
                            resolved = true;
                            
                            // Log the collected data for debugging
                            console.log('Collected help output:', this.discoveryCollectedData.substring(0, 200));
                            
                            resolve();
                            return;
                        }
                    } else {
                        noDataChangedCount = 0;
                        lastDataLength = this.discoveryCollectedData.length;
                    }

                    // Check timeout
                    if (elapsed > timeout) {
                        resolved = true;
                        console.log('Timeout reached, completing with collected data');
                        resolve(); // Resolve anyway with whatever data we have
                        return;
                    }

                    // Try again in 500ms
                    setTimeout(checkCompletion, 500);
                };

                checkCompletion();
            });
        },

        // Discover subcommands for a specific command
        async discoverSubcommands(command) {
            if (!this.connected) {
                this.showStatus('Must be connected to discover subcommands', 'error');
                return;
            }

            // Concurrency control: prevent concurrent discovery
            if (this.discoveryLock) {
                this.showStatus('Discovery already in progress. Please wait...', 'error');
                return;
            }

            this.discoveryLock = true;
            this.commandDiscoveryInProgress = true;
            this.discoveryCollectedData = '';

            try {
                console.log(`Discovering subcommands for: ${command.name}`);

                // Send '<command> --help' to get subcommands (Zephyr shell syntax)
                this.sendDiscoveryCommand(`${command.name} --help\n`);

                // Wait for discovery to complete (with shorter timeout for subcommands)
                await this.waitForSubcommandDiscovery(2000); // 2 seconds

                console.log(`Discovery complete. Collected ${this.discoveryCollectedData.length} chars`);

                // Parse subcommands from help output
                const subcommands = this.parseSubcommands(this.discoveryCollectedData, command.name);

                if (subcommands.length > 0) {
                    // Update command with subcommands
                    command.subcommands = subcommands;
                    command.hasSubcommands = true;

                    // Update in commands array
                    const cmdIndex = this.commands.findIndex(c => c.id === command.id);
                    if (cmdIndex !== -1) {
                        this.commands[cmdIndex] = command;
                    }

                    // Save updated cache
                    this.saveCachedCommands(this.commands);

                    this.showStatus(`Found ${subcommands.length} subcommands for ${command.name}`, 'success');
                } else {
                    command.hasSubcommands = false;
                    this.showStatus(`No subcommands found for ${command.name}`, 'info');
                }
            } catch (error) {
                console.error('Error discovering subcommands:', error);
                this.showStatus('Error discovering subcommands: ' + error.message, 'error');
            } finally {
                this.commandDiscoveryInProgress = false;
                this.discoveryLock = false;
            }
        },

        // Parse arguments from help text
        parseArguments(helpText) {
            const args = [];
            
            // Look for arguments in format: <arg> or [<arg>]
            // Matches: <address>, [<width>], <module_0>, etc.
            const argPattern = /(<[\w_]+>|\[<[\w_]+>\])/g;
            const matches = helpText.match(argPattern);
            
            if (matches) {
                const seen = new Set();
                matches.forEach(match => {
                    // Remove < > and [ ]
                    const cleanArg = match.replace(/[<>\[\]]/g, '');
                    
                    // Skip duplicates
                    if (seen.has(cleanArg)) return;
                    seen.add(cleanArg);
                    
                    // Determine if required or optional
                    const required = match.startsWith('<');
                    
                    args.push({
                        id: cleanArg,
                        name: cleanArg,
                        required: required,
                        type: 'string',
                        description: ''
                    });
                });
            }
            
            return args;
        },

        // Parse subcommands from '<command> --help' output
        parseSubcommands(helpText, parentCommand) {
            // Remove ANSI escape codes
            const cleanText = helpText.replace(/\x1b\[[0-9;]*m/g, '').replace(/\x1b\[[0-9]*C/g, '');

            const lines = cleanText.split('\n').map(line => line.trim()).filter(line => line.length > 0);
            const subcommands = [];

            console.log(`=== PARSING SUBCOMMANDS FOR ${parentCommand} ===`);
            console.log('Raw help text:', helpText.substring(0, 200));
            console.log('Clean text:', cleanText.substring(0, 200));
            console.log('Number of lines:', lines.length);
            console.log('All lines:');
            for (let i = 0; i < lines.length; i++) {
                console.log(`  [${i}] "${lines[i]}"`);
            }

            // Check if this is a simple help output (no subcommands)
            // Format: "command --help" followed by "command - Description"
            if (lines.length <= 3) {
                // Check if it's just a simple command description
                const hasSimpleFormat = lines.some(line => 
                    line.includes(parentCommand) && line.includes('-') && !line.includes('--')
                );
                
                if (hasSimpleFormat) {
                    console.log('✓ Simple help format detected (no subcommands)');
                    return subcommands; // Return empty array
                }
            }

            // Look for subcommand section
            let inSubcommandSection = false;

            for (let i = 0; i < lines.length; i++) {
                const line = lines[i];

                // Look for "Subcommands:" or similar markers
                // Also look for lines that indicate subcommand listing
                if (line.toLowerCase().includes('subcommand') || 
                    line.includes('Available commands:') ||
                    line.toLowerCase().includes('options:') ||
                    line.toLowerCase().includes('usage:')) {
                    inSubcommandSection = true;
                    console.log(`✓ Found subcommand section at line ${i}: "${line}"`);
                    continue;
                }

                if (inSubcommandSection) {
                    // Match subcommand line: "subcommand_name : Description"
                    // Also try to match: "  subcommand_name  Description" (without colon)
                    let cmdMatch = line.match(/^(\w[\w_-]*)\s+:\s*(.*)$/);
                    
                    if (!cmdMatch) {
                        // Try alternative format: "  subcommand_name  Description"
                        cmdMatch = line.match(/^(\w[\w_-]+)\s{2,}(.+)$/);
                    }

                    if (cmdMatch) {
                        const subCmdName = cmdMatch[1];
                        let subCmdDesc = cmdMatch[2].trim();
                        let usage = '';

                        // Skip if it looks like the parent command itself
                        if (subCmdName === parentCommand) {
                            continue;
                        }

                        // Look ahead for continuation lines and usage info
                        for (let j = i + 1; j < lines.length; j++) {
                            const nextLine = lines[j];

                            // Stop if we hit another command
                            if (nextLine.match(/^(\w[\w_-]*)\s+:/)) {
                                break;
                            }
                            
                            if (nextLine.match(/^(\w[\w_-]+)\s{2,}/)) {
                                break;
                            }

                            // Stop if line contains colon (likely another section)
                            if (nextLine.includes(':') && !nextLine.startsWith(' ')) {
                                break;
                            }

                            // Check if it's a usage line
                            if (nextLine.toLowerCase().includes('usage:')) {
                                usage = nextLine;
                                i = j;
                                continue;
                            }

                            // Add continuation if it's indented or looks like a continuation
                            if (nextLine.startsWith(' ') || !nextLine.match(/^[A-Z]/)) {
                                subCmdDesc += ' ' + nextLine;
                                i = j;
                            } else {
                                break;
                            }
                        }

                        // Parse arguments from description and usage
                        const fullText = subCmdDesc + ' ' + usage;
                        const args = this.parseArguments(fullText);

                        subcommands.push({
                            id: `${parentCommand}_${subCmdName}`,
                            name: subCmdName,
                            fullName: `${parentCommand} ${subCmdName}`,
                            description: subCmdDesc,
                            parent: parentCommand,
                            usage: usage,
                            helpText: fullText,
                            args: args
                        });

                        console.log(`  ✓ [${subCmdName}] "${subCmdDesc.substring(0, 50)}..." (${args.length} args)`);
                    }
                }
            }

            console.log(`=== RESULT: ${subcommands.length} subcommands found ===`);
            
            if (subcommands.length === 0) {
                console.log('No subcommands found. This command may not have subcommands.');
            }
            
            return subcommands;
        },

        // Toggle command expansion to show/hide subcommands
        toggleCommandExpansion(command) {
            if (!this.expandedCommands[command.id]) {
                // Expand: discover subcommands if not already discovered
                if (!command.subcommands && command.hasSubcommands !== false) {
                    this.discoverSubcommands(command);
                }
                this.expandedCommands[command.id] = true;
            } else {
                // Collapse
                this.expandedCommands[command.id] = false;
            }
        },

        // Parse 'help' command output to extract command list
        parseHelpOutput(helpText) {
            // Remove ANSI escape codes (like [1;32m, [24C, etc)
            const cleanText = helpText.replace(/\x1b\[[0-9;]*m/g, '').replace(/\x1b\[[0-9]*C/g, '');

            const lines = cleanText.split('\n').map(line => line.trim()).filter(line => line.length > 0);
            const commands = [];
            let inCommandSection = false;

            console.log('=== PARSING HELP OUTPUT ===');
            console.log('Total non-empty lines:', lines.length);

            for (let i = 0; i < lines.length; i++) {
                const line = lines[i];

                if (line.includes('Available commands:')) {
                    inCommandSection = true;
                    console.log(`✓ Found section marker at line ${i}`);
                    console.log('Next 10 lines after marker:');
                    for (let j = i + 1; j < Math.min(i + 11, lines.length); j++) {
                        console.log(`  [${j}] "${lines[j]}"`);
                    }
                    continue;
                }

                if (inCommandSection) {
                    // Match command line: "command_name            : Description here"
                    // After trimming, the format is: "command_name ... : description"
                    const cmdMatch = line.match(/^(\w[\w_]*)\s+:\s*(.*)$/);

                    if (cmdMatch) {
                        const cmdName = cmdMatch[1];
                        let cmdDesc = cmdMatch[2].trim();

                        // Look ahead for continuation lines
                        for (let j = i + 1; j < lines.length; j++) {
                            const nextLine = lines[j];

                            // Stop if we hit another command (word followed by colon)
                            if (nextLine.match(/^(\w[\w_]*)\s+:/)) {
                                break;
                            }

                            // If it's clearly not a continuation, stop
                            if (nextLine.includes(':')) {
                                break;
                            }

                            // Add continuation
                            cmdDesc += ' ' + nextLine;
                            i = j; // Skip these lines
                        }

                        // Parse arguments from description
                        const args = this.parseArguments(cmdDesc);

                        commands.push({
                            id: cmdName,
                            name: cmdName,
                            description: cmdDesc,
                            usage: '',
                            helpText: cmdDesc,
                            args: args,
                            hasSubcommands: null, // null = unknown, true = has, false = none
                            subcommands: null
                        });

                        console.log(`  ✓ [${cmdName}] "${cmdDesc.substring(0, 50)}..."`);
                    } else if (line.match(/^(\w[\w_]*)\s+:/)) {
                        // This is a command but regex didn't match - debug it
                        console.log(`  ⚠ Regex mismatch for: "${line.substring(0, 60)}"`);
                    }
                }
            }

            console.log(`=== RESULT: ${commands.length} commands found ===`);
            if (commands.length > 0) {
                console.log('Commands:', commands.map(c => c.name).join(', '));
            }
            return commands;
        },

        // Export commands to JSON file
        exportCommands() {
            const dataStr = JSON.stringify(this.commandsCache || { commands: this.commands, lastScanned: new Date().toISOString() }, null, 2);
            const dataBlob = new Blob([dataStr], { type: 'application/json' });
            const url = URL.createObjectURL(dataBlob);
            const link = document.createElement('a');
            link.href = url;
            link.download = `zephyr_commands_${new Date().toISOString().split('T')[0]}.json`;
            link.click();
            URL.revokeObjectURL(url);
        },

        // Import commands from JSON file
        importCommands(file) {
            const reader = new FileReader();
            reader.onload = (e) => {
                try {
                    const data = JSON.parse(e.target.result);
                    if (data.commands && Array.isArray(data.commands)) {
                        this.saveCachedCommands(data.commands);
                        this.showStatus('Commands imported successfully!', 'success');
                    } else {
                        this.showStatus('Invalid commands format', 'error');
                    }
                } catch (error) {
                    this.showStatus('Error importing commands: ' + error.message, 'error');
                }
            };
            reader.readAsText(file);
        },

        // Clear cached commands
        clearCommandsCache() {
            localStorage.removeItem('zephyr_commands_cache');
            this.commands = [];
            this.commandsCache = null;
            this.lastScannedTime = null;
            this.showStatus('Commands cache cleared', 'info');
        }
    };
}