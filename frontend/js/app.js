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
        sidebarWidth: 320,
        isResizing: false,

        // Multi-session state
        sessions: [], // Array of { id, port, baudrate, connected, terminal, fitAddon, ws, promptBuffer }
        activeSessionId: null,

        currentPromptBuffer: '',

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
        terminalFitAddon: null,

        // Repeat Commands State
        repeatCommands: [],
        repeatModalData: {
            id: null,
            name: '',
            command: '',
            interval: 1.0
        },

        // Initialize application (Now handles status checks/port loading)
        async init() {
            console.log("init() called");

            // Load saved manual port from localStorage
            const savedManualPort = localStorage.getItem('zdm_manual_port');
            if (savedManualPort) {
                this.manualPort = savedManualPort;
                this.selectedPort = savedManualPort; // Sync with selectedPort so UI buttons work
                console.log('Loaded saved manual port:', savedManualPort);
            }

            // Load available ports
            await this.loadPorts();

            // Check connection status
            await this.checkStatus();

            // Load repeat commands
            this.initRepeatCommands();

            // Load saved sidebar width
            const savedWidth = localStorage.getItem('zdm_sidebar_width');
            if (savedWidth) {
                this.sidebarWidth = parseInt(savedWidth);
            }
        },

        // Initialize Repeat Commands from localStorage
        initRepeatCommands() {
            const saved = localStorage.getItem('zdm_repeat_commands');
            if (saved) {
                try {
                    const parsed = JSON.parse(saved);
                    // Ensure active states are cleared on startup for safety
                    this.repeatCommands = parsed.map(rc => ({
                        ...rc,
                        runningSessions: [] // Array of { sessionId, port, timerId }
                    }));
                } catch (e) {
                    console.error('Error loading repeat commands:', e);
                }
            }
        },

        saveRepeatCommands() {
            // Only save the data, not the timer IDs or active status
            const toSave = this.repeatCommands.map(({ id, name, command, interval }) => ({
                id, name, command, interval
            }));
            localStorage.setItem('zdm_repeat_commands', JSON.stringify(toSave));
        },

        // Initialize xterm.js terminal for a specific session
        initTerminal(session, containerId = 'terminal') {
            console.log(`initTerminal() called for ${session.port}`);
            if (!window.Terminal) {
                console.error("xterm.js not loaded!");
                return;
            }

            const term = new window.Terminal({
                cursorBlink: true,
                theme: {
                    background: '#0f172a', // slate-900
                    foreground: '#e2e8f0', // slate-200
                    cursor: '#818cf8', // indigo-400
                    cursorAccent: '#0f172a',
                    selection: '#334155', // slate-700
                    black: '#1e293b',
                    red: '#ef4444',
                    green: '#10b981',
                    yellow: '#f59e0b',
                    blue: '#3b82f6',
                    magenta: '#a855f7',
                    cyan: '#06b6d4',
                    white: '#cbd5e1',
                    brightBlack: '#475569',
                    brightRed: '#f87171',
                    brightGreen: '#34d399',
                    brightYellow: '#fbbf24',
                    brightBlue: '#60a5fa',
                    brightMagenta: '#c084fc',
                    brightCyan: '#22d3ee',
                    brightWhite: '#f1f5f9'
                }
            });

            const fitAddon = new window.FitAddon.FitAddon();
            term.loadAddon(fitAddon);

            const el = document.getElementById(containerId);
            term.open(el);

            // Initial fit
            fitAddon.fit();

            // Debounced resize
            let resizeTimeout;
            const debouncedFit = () => {
                clearTimeout(resizeTimeout);
                resizeTimeout = setTimeout(() => {
                    fitAddon.fit();
                }, 100);
            };

            window.addEventListener('resize', debouncedFit);
            const resizeObserver = new ResizeObserver(debouncedFit);
            resizeObserver.observe(el.parentElement);

            // Support Ctrl+C (Copy) and Ctrl+V (Paste)
            term.attachCustomKeyEventHandler(e => {
                if (e.ctrlKey && e.code === 'KeyC') {
                    if (term.hasSelection()) return false;
                }
                if (e.ctrlKey && e.code === 'KeyV') return false;
                return true;
            });

            // Enable User Input (Tx)
            term.onData(data => {
                // Buffer tracking for repeat command restoration
                for (let i = 0; i < data.length; i++) {
                    const char = data[i];
                    if (char === '\r' || char === '\n') {
                        session.promptBuffer = '';
                    } else if (char === '\x7f' || char === '\b') { // Backspace
                        session.promptBuffer = session.promptBuffer.slice(0, -1);
                    } else if (char === '\x15') { // Ctrl+U
                        session.promptBuffer = '';
                    } else if (char === '\x03') { // Ctrl+C
                        session.promptBuffer = '';
                    } else if (char.length === 1 && char >= ' ' && char <= '~') { // Printable ASCII
                        session.promptBuffer += char;
                    }
                }

                if (session.ws && session.ws.readyState === WebSocket.OPEN) {
                    session.ws.send(data);
                }
            });

            return { term, fitAddon };
        },

        // ============ SIDEBAR RESIZING ============

        startResizing(e) {
            this.isResizing = true;
            document.body.style.cursor = 'ew-resize';
            document.body.style.userSelect = 'none'; // Prevent text selection
        },

        doResize(e) {
            if (!this.isResizing) return;

            // Minimal 150px, Maximal half screen
            const newWidth = Math.max(150, Math.min(e.clientX - 48, window.innerWidth / 2));
            this.sidebarWidth = newWidth;

            // Debounced terminal fit to keep it snappy
            this.resizeTerminal();
        },

        stopResizing() {
            if (!this.isResizing) return;
            this.isResizing = false;
            document.body.style.cursor = '';
            document.body.style.userSelect = '';
            localStorage.setItem('zdm_sidebar_width', this.sidebarWidth);
            this.resizeTerminal();
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

                if (data.sessions && data.sessions.length > 0) {
                    this.sessions = data.sessions.map(s => ({
                        id: 'session_' + Date.now() + Math.random().toString(36).substr(2, 9),
                        port: s.port,
                        baudrate: s.baudrate,
                        connected: true,
                        terminal: null,
                        fitAddon: null,
                        ws: null,
                        promptBuffer: ''
                    }));

                    // Switch to first session
                    this.activeSessionId = this.sessions[0].id;
                    this.switchSession(this.activeSessionId);

                    // Initialize terminals for all restored sessions
                    this.$nextTick(() => {
                        this.sessions.forEach(session => {
                            const initResult = this.initTerminal(session, `terminal-${session.id}`);
                            if (initResult) {
                                session.terminal = initResult.term;
                                session.fitAddon = initResult.fitAddon;
                                this.connectWebSocket(session);
                            }
                        });
                    });
                }
            } catch (error) {
                console.error('Error checking status:', error);
            }
        },

        // Toggle connection
        async toggleConnection() {
            if (this.connected) {
                await this.disconnect();
                this.activeView = 'settings'; // Open settings view to connect
            }
        },

        // Active session helpers for compatibility
        get activeSession() {
            return this.sessions.find(s => s.id === this.activeSessionId);
        },
        get terminal() {
            return this.activeSession ? this.activeSession.terminal : null;
        },
        get terminalFitAddon() {
            return this.activeSession ? this.activeSession.fitAddon : null;
        },
        get ws() {
            return this.activeSession ? this.activeSession.ws : null;
        },
        get currentPromptBuffer() {
            return this.activeSession ? this.activeSession.promptBuffer : '';
        },
        set currentPromptBuffer(val) {
            if (this.activeSession) this.activeSession.promptBuffer = val;
        },

        // Switch active session
        switchSession(sessionId) {
            this.activeSessionId = sessionId;
            const session = this.activeSession;
            if (session) {
                this.currentPort = session.port;
                this.connected = session.connected;
                // Focus terminal
                this.$nextTick(() => {
                    if (session.terminal) {
                        session.terminal.focus();
                        session.fitAddon.fit();
                    }
                });
            } else {
                this.currentPort = '';
                this.connected = false;
            }
        },

        // Close a session
        async closeSession(sessionId) {
            const session = this.sessions.find(s => s.id === sessionId);
            if (!session) return;

            // Disconnect if connected
            if (session.connected) {
                try {
                    await fetch('/api/disconnect', {
                        method: 'POST',
                        headers: { 'Content-Type': 'application/json' },
                        body: JSON.stringify({ port: session.port })
                    });
                } catch (e) { console.error("Disconnect error", e); }
            }

            if (session.ws) session.ws.close();

            this.sessions = this.sessions.filter(s => s.id !== sessionId);

            if (this.activeSessionId === sessionId) {
                this.activeSessionId = this.sessions.length > 0 ? this.sessions[0].id : null;
                this.switchSession(this.activeSessionId);
            }
        },

        // Connect WebSocket for a specific session
        connectWebSocket(session) {
            if (!session) return;

            if (session.ws) {
                session.ws.close();
            }

            const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
            const wsUrl = `${protocol}//${window.location.host}/ws?port=${encodeURIComponent(session.port)}`;

            session.ws = new WebSocket(wsUrl);

            session.ws.onopen = () => {
                console.log(`WebSocket connected for ${session.port}`);
                if (session.terminal) {
                    session.terminal.write('\r\n[WebSocket connected]\r\n');
                }

                if (session.ws.readyState === WebSocket.OPEN) {
                    session.ws.send('\r');
                }
            };

            session.ws.onmessage = (event) => {
                if (this.commandDiscoveryInProgress && this.activeSessionId === session.id) {
                    this.discoveryCollectedData += event.data;
                }

                if (event.data.length < 100 && event.data.trim().startsWith('{')) {
                    try {
                        const data = JSON.parse(event.data);
                        if (data.type === 'error') {
                            if (session.terminal) session.terminal.writeln('\r\n[Error] ' + data.message);
                        }
                        return;
                    } catch (e) { }
                }

                if (session.terminal) {
                    session.terminal.write(event.data);
                }
            };

            session.ws.onerror = (error) => {
                console.error(`WebSocket error for ${session.port}:`, error);
                if (session.terminal) session.terminal.write('\r\n[WebSocket error]\r\n');
            };

            session.ws.onclose = () => {
                console.log(`WebSocket disconnected for ${session.port}`);
                if (session.terminal && session.connected) {
                    session.terminal.write('\r\n[WebSocket disconnected]\r\n');
                }
            };
        },

        // Disconnect from active session
        async disconnect() {
            const session = this.activeSession;
            if (!session) return;

            try {
                await fetch('/api/disconnect', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ port: session.port })
                });

                if (session.ws) session.ws.close();
                session.connected = false;
                this.connected = false; // Sync for global UI
                this.showStatus('Disconnected from ' + session.port, 'info');
            } catch (error) {
                console.error('Error disconnecting:', error);
                this.showStatus('Error disconnecting: ' + error.message, 'error');
            }
        },

        get connectButtonState() {
            if (this.connecting) return 'connecting';
            const port = this.manualPort || this.selectedPort;
            if (!port) return 'connect';

            const session = this.sessions.find(s => s.port === port && s.connected);
            if (!session) return 'connect';

            if (this.activeSessionId === session.id) return 'disconnect';
            return 'switch';
        },

        // Save settings / Toggle connection
        async saveSettings() {
            const state = this.connectButtonState;
            const portToConnect = this.manualPort || this.selectedPort;

            if (state === 'switch') {
                const session = this.sessions.find(s => s.port === portToConnect);
                this.switchSession(session.id);
                this.showSettings = false;
                this.activeView = 'commands';
                return;
            }

            if (state === 'disconnect') {
                await this.disconnect();
                return;
            }

            if (!portToConnect) {
                this.showStatus('Please select or enter a serial port', 'error');
                return;
            }

            this.connecting = true;
            this.statusMessage = '';

            try {
                // Save manual port to localStorage
                if (this.manualPort) {
                    localStorage.setItem('zdm_manual_port', this.manualPort);
                }

                const response = await fetch('/api/connect', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({
                        port: portToConnect,
                        baudrate: parseInt(this.baudRate) || 115200
                    })
                });

                const data = await response.json();

                if (data.status === 'connected') {
                    // Create new session
                    const sessionId = 'session_' + Date.now();
                    const newSession = {
                        id: sessionId,
                        port: portToConnect,
                        baudrate: parseInt(this.baudRate) || 115200,
                        connected: true,
                        terminal: null,
                        fitAddon: null,
                        ws: null,
                        promptBuffer: ''
                    };

                    this.sessions.push(newSession);
                    this.activeSessionId = sessionId;
                    this.connected = true;
                    this.currentPort = portToConnect;
                    this.showSettings = false;
                    this.activeView = 'commands';

                    // Initialize terminal
                    this.$nextTick(() => {
                        const initResult = this.initTerminal(newSession, `terminal-${sessionId}`);
                        if (initResult) {
                            newSession.terminal = initResult.term;
                            newSession.fitAddon = initResult.fitAddon;
                            this.connectWebSocket(newSession);
                        }
                    });

                    this.showStatus('Connected to ' + portToConnect, 'success');
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

        // ============ REPEAT COMMANDS LOGIC ============

        openRepeatModal(obj = null, isExisting = false) {
            if (isExisting) {
                // Editing an existing repeat command
                this.repeatModalData = {
                    id: obj.id,
                    name: obj.name,
                    command: obj.command,
                    interval: obj.interval
                };
            } else if (obj) {
                // Creating from a discovered command
                this.repeatModalData = {
                    id: null,
                    name: obj.fullName || obj.name,
                    command: obj.fullName || obj.name,
                    interval: 1.0
                };
            } else {
                // New raw command
                this.repeatModalData = {
                    id: null,
                    name: '',
                    command: '',
                    interval: 1.0
                };
            }
            this.activeView = 'repeat-create';
        },

        addRepeatCommand() {
            const data = this.repeatModalData;
            if (!data.command || !data.interval) {
                this.showStatus('Command and interval are required', 'error');
                return;
            }

            if (data.id) {
                // Update existing
                const index = this.repeatCommands.findIndex(rc => rc.id === data.id);
                if (index !== -1) {
                    const rc = this.repeatCommands[index];
                    const activeSessions = [...rc.runningSessions]; // Clone to restart

                    // Stop for all sessions
                    activeSessions.forEach(s => {
                        if (s.timerId) clearInterval(s.timerId);
                    });
                    rc.runningSessions = [];

                    // Update properties
                    rc.name = data.name || data.command;
                    rc.command = data.command;
                    rc.interval = parseFloat(data.interval);

                    // Restart for all sessions
                    activeSessions.forEach(s => {
                        const session = this.sessions.find(sess => sess.id === s.sessionId);
                        if (session && session.connected) {
                            const newRun = {
                                sessionId: session.id,
                                port: session.port,
                                timerId: null
                            };
                            this.executeRepeatCommand(rc, session);
                            newRun.timerId = setInterval(() => {
                                this.executeRepeatCommand(rc, session);
                            }, rc.interval * 1000);
                            rc.runningSessions.push(newRun);
                        }
                    });

                    this.showStatus('Repeat command updated', 'success');
                }
            } else {
                // Create new
                const newCmd = {
                    id: Date.now(),
                    name: data.name || data.command,
                    command: data.command,
                    interval: parseFloat(data.interval),
                    runningSessions: []
                };
                this.repeatCommands.push(newCmd);
                this.showStatus('Repeat command added', 'success');
            }

            this.saveRepeatCommands();
            this.activeView = 'repeat';
            if (this.terminal) this.terminal.focus();
        },

        removeRepeatCommand(id) {
            const index = this.repeatCommands.findIndex(rc => rc.id === id);
            if (index !== -1) {
                const rc = this.repeatCommands[index];
                if (rc.runningSessions) {
                    rc.runningSessions.forEach(s => {
                        if (s.timerId) clearInterval(s.timerId);
                    });
                }
                this.repeatCommands.splice(index, 1);
                this.saveRepeatCommands();
            }
            if (this.terminal) this.terminal.focus();
        },

        toggleRepeatCommand(rc) {
            const sessionId = this.activeSessionId;
            if (!sessionId) return;

            const existingSession = rc.runningSessions.find(s => s.sessionId === sessionId);

            if (existingSession) {
                // Stop for this session
                if (existingSession.timerId) {
                    clearInterval(existingSession.timerId);
                }
                rc.runningSessions = rc.runningSessions.filter(s => s.sessionId !== sessionId);
            } else {
                // Start for this session
                const session = this.activeSession;
                if (!session || !session.connected) {
                    this.showStatus('Must be connected to start repeating', 'error');
                    return;
                }

                const newRun = {
                    sessionId: session.id,
                    port: session.port,
                    timerId: null
                };

                this.executeRepeatCommand(rc, session); // Initial run
                newRun.timerId = setInterval(() => {
                    this.executeRepeatCommand(rc, session);
                }, rc.interval * 1000);

                rc.runningSessions.push(newRun);
            }
            if (this.terminal) this.terminal.focus();
        },

        executeRepeatCommand(rc, session) {
            const targetSession = session || this.activeSession;
            if (targetSession && targetSession.ws && targetSession.ws.readyState === WebSocket.OPEN) {
                const bufferToRestore = targetSession.promptBuffer;

                if (bufferToRestore) {
                    // 1. Clear current line on device (Ctrl+U)
                    targetSession.ws.send('\x15');
                }

                // 2. Send the periodic command
                targetSession.ws.send(rc.command + '\r');

                if (bufferToRestore) {
                    // 3. Restore the buffered text
                    targetSession.ws.send(bufferToRestore);
                }
            }
        },

        stopAllRepeats() {
            this.repeatCommands.forEach(rc => {
                if (rc.runningSessions) {
                    rc.runningSessions.forEach(s => {
                        if (s.timerId) clearInterval(s.timerId);
                    });
                    rc.runningSessions = [];
                }
            });
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

        // Resize terminal to fit container
        resizeTerminal() {
            if (this.terminalFitAddon) {
                this.terminalFitAddon.fit();
            }
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
                    console.error(`Error discovering subcommands for ${cmd.name}: `, error);
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
                console.log(`Discovering subcommands for: ${command.name} `);

                // Send '<command> --help' to get subcommands (Zephyr shell syntax)
                this.sendDiscoveryCommand(`${command.name} --help\n`);

                // Wait for discovery to complete (with shorter timeout for subcommands)
                await this.waitForSubcommandDiscovery(2000); // 2 seconds

                console.log(`Discovery complete.Collected ${this.discoveryCollectedData.length} chars`);

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
                this.ws.send(cmdString + '\n');

                // Clear args for next command
                this.commandArgs = {};
                this.commandResult = ''; // Clear previous result
                this.showStatus('Command sent: ' + cmdString, 'success');
            } else {
                this.showStatus('WebSocket not connected', 'error');
            }
        },

        // Quick execute command from list (with required args check)
        quickExecuteCommand(command) {
            if (!command) return;

            // Check if command has required arguments
            const hasRequiredArgs = command.args && command.args.some(arg => arg.required);

            if (hasRequiredArgs) {
                // Open command detail page to fill in required args
                this.selectedCommand = command;
                this.showStatus('Please fill in required arguments', 'info');
            } else {
                // Execute immediately if no required args
                this.executeCommand(command);
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

                    console.log(`Discovery check: data length = ${this.discoveryCollectedData.length}, timeout in ${timeout - (Date.now() - startTime)} ms`);

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

                    // Check if data has stopped changing (no new data for 0.5 seconds)
                    if (this.discoveryCollectedData.length === lastDataLength) {
                        noDataChangedCount++;
                        if (noDataChangedCount >= 2) { // 0.5 seconds with no change (2 * 250ms)
                            console.log('No new data for 0.5 seconds, treating as complete');
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

                    // Try again in 250ms
                    setTimeout(checkCompletion, 100);
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
                    console.log(`Subcommand discovery check: data length = ${this.discoveryCollectedData.length}, elapsed = ${elapsed} ms`);

                    // Check if data has stopped changing (no new data for 0.4 seconds)
                    if (this.discoveryCollectedData.length === lastDataLength) {
                        noDataChangedCount++;
                        if (noDataChangedCount >= 2) { // 0.4 seconds with no change (2 * 200ms)
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

                    // Try again in 200ms
                    setTimeout(checkCompletion, 100);
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
                console.log(`Discovering subcommands for: ${command.name} `);

                // Send '<command> --help' to get subcommands (Zephyr shell syntax)
                this.sendDiscoveryCommand(`${command.name} --help\n`);

                // Wait for discovery to complete (with shorter timeout for subcommands)
                await this.waitForSubcommandDiscovery(2000); // 2 seconds

                console.log(`Discovery complete.Collected ${this.discoveryCollectedData.length} chars`);

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

            // Look for arguments in format: <arg> or [<arg>] or [arg]
            // Matches: <address>, [<width>], <H:M:S>, [Y-m-d], <module_0>, etc.
            // Pattern matches: <anything> or [<anything>] or [anything]
            const argPattern = /(<[^>]+>|\[<[^\]>]+>\]|\[[^\]<>]+\])/g;

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
                    // Required: starts with < (not [)
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

            console.log(`=== PARSING SUBCOMMANDS FOR ${parentCommand} === `);
            console.log('Raw help text:', helpText.substring(0, 200));
            console.log('Clean text:', cleanText.substring(0, 200));
            console.log('Number of lines:', lines.length);
            console.log('All lines:');
            for (let i = 0; i < lines.length; i++) {
                console.log(`  [${i}]"${lines[i]}"`);
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

                // Look for "Subcommands:" marker specifically
                // Don't confuse with "Usage:" which can appear in main description
                if (line.toLowerCase() === 'subcommands:' ||
                    line.toLowerCase().startsWith('subcommands:')) {
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
                        let inUsageBlock = false;
                        let usageLines = [];

                        for (let j = i + 1; j < lines.length; j++) {
                            const nextLine = lines[j];

                            // Stop if we hit another command
                            if (nextLine.match(/^(\w[\w_-]*)\s+:/)) {
                                break;
                            }

                            if (nextLine.match(/^(\w[\w_-]+)\s{2,}/)) {
                                break;
                            }

                            // Check if it's a usage line
                            if (nextLine.toLowerCase().includes('usage:')) {
                                inUsageBlock = true;
                                // Extract usage text after "Usage:"
                                const usageText = nextLine.replace(/.*usage:\s*/i, '').trim();
                                if (usageText) {
                                    usageLines.push(usageText);
                                }
                                i = j;
                                continue;
                            }

                            // If in usage block, collect indented lines
                            if (inUsageBlock && nextLine.startsWith(' ')) {
                                usageLines.push(nextLine.trim());
                                i = j;
                                continue;
                            }

                            // Stop if line contains colon and not indented (likely another section)
                            if (nextLine.includes(':') && !nextLine.startsWith(' ')) {
                                break;
                            }

                            // Add continuation if it's indented or looks like a continuation
                            if (!inUsageBlock && (nextLine.startsWith(' ') || !nextLine.match(/^[A-Z]/))) {
                                subCmdDesc += ' ' + nextLine;
                                i = j;
                            } else if (!inUsageBlock) {
                                break;
                            }
                        }

                        // Build usage string
                        if (usageLines.length > 0) {
                            usage = usageLines.join(' ');
                        }

                        // Parse arguments from description and usage
                        const fullText = subCmdDesc + ' ' + usage;
                        const args = this.parseArguments(fullText);

                        subcommands.push({
                            id: `${parentCommand}_${subCmdName} `,
                            name: subCmdName,
                            fullName: `${parentCommand} ${subCmdName} `,
                            description: subCmdDesc,
                            parent: parentCommand,
                            usage: usage,
                            helpText: fullText,
                            args: args
                        });

                        console.log(`  ✓[${subCmdName}] "${subCmdDesc.substring(0, 50)}..."(${args.length} args)`);
                    }
                }
            }

            console.log(`=== RESULT: ${subcommands.length} subcommands found === `);

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
                    console.log(`✓ Found section marker at line ${i} `);
                    console.log('Next 10 lines after marker:');
                    for (let j = i + 1; j < Math.min(i + 11, lines.length); j++) {
                        console.log(`  [${j}]"${lines[j]}"`);
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

                        // Look ahead for continuation lines and extract usage
                        let fullDesc = cmdDesc;
                        let usageLines = [];
                        let inUsageBlock = false;

                        for (let j = i + 1; j < lines.length; j++) {
                            const nextLine = lines[j];

                            // Stop if we hit another command (word followed by colon)
                            if (nextLine.match(/^(\w[\w_]*)\s+:/)) {
                                break;
                            }

                            // Check for Usage: marker
                            if (nextLine.toLowerCase().includes('usage:')) {
                                inUsageBlock = true;
                                const usageText = nextLine.replace(/.*usage:\s*/i, '').trim();
                                if (usageText) {
                                    usageLines.push(usageText);
                                }
                                fullDesc += ' ' + nextLine;
                                i = j;
                                continue;
                            }

                            // If in usage block, collect indented lines
                            if (inUsageBlock && nextLine.startsWith(' ')) {
                                usageLines.push(nextLine.trim());
                                fullDesc += ' ' + nextLine;
                                i = j;
                                continue;
                            }

                            // Stop if not indented and we're in usage block
                            if (inUsageBlock && !nextLine.startsWith(' ')) {
                                break;
                            }

                            // If it's clearly not a continuation, stop
                            if (nextLine.includes(':') && !nextLine.startsWith(' ')) {
                                break;
                            }

                            // Add continuation
                            fullDesc += ' ' + nextLine;
                            i = j;
                        }

                        // Parse arguments from full description
                        const args = this.parseArguments(fullDesc);

                        // Build usage string
                        let usage = '';
                        if (usageLines.length > 0) {
                            usage = usageLines.join(' ');
                        } else {
                            // Generate basic usage from command name and args
                            usage = cmdName;
                            if (args.length > 0) {
                                usage += ' ' + args.map(arg =>
                                    arg.required ? `< ${arg.name}> ` : `[<${arg.name}>]`
                                ).join(' ');
                            }
                        }

                        commands.push({
                            id: cmdName,
                            name: cmdName,
                            description: cmdDesc,
                            usage: usage,
                            helpText: fullDesc,
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