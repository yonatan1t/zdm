// Zephyr Device Manager - Main Application
function terminalApp() {
    return {
        // State
        connected: false,
        showSettings: false,
        selectedPort: '',
        manualPort: '',  // Add this line
        theme: 'dark', // 'light' or 'dark'
        connectionMode: 'serial', // 'serial' or 'telnet'
        telnetHost: 'localhost',
        telnetPort: '23',
        baudRate: '115200',
        availablePorts: [],
        loadingPorts: false,
        statusMessage: '',
        statusMessageType: 'info',
        connecting: false,
        currentPort: '',
        activeView: 'commands', // VSCode-style sidebar view
        sidebarWidth: 320,
        activeView: 'commands', // VSCode-style sidebar view
        sidebarWidth: 320,
        isResizing: false,

        // Toolbar State
        activeMenu: null,

        // Multi-session & Layout state
        sessions: [], // Array of { id, port, baudrate, connected, terminal, fitAddon, ws, promptBuffer }
        layoutGroups: [], // Array of { id, sessionIds, activeSessionId }
        activeSessionId: null, // Legacy: still used for "global" context (e.g. settings)

        // Drag & Drop State
        draggedSessionId: null,
        dragOverGroupId: null,
        dragOverPosition: null, // 'top', 'bottom', 'left', 'right', 'center'

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
        discoveryStartTime: null, // Track when the scan started
        showDiscoveryConfirm: false, // Show confirmation dialog for long scans
        discoveryPaused: false, // Pause scanning for user confirmation
        discoveryCancelRequested: false, // Allow user to cancel

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
            if (this._initialized) return;
            this._initialized = true;
            console.log("init() called");

            // Load theme
            const savedTheme = localStorage.getItem('zdm_theme');
            if (savedTheme) {
                this.theme = savedTheme;
            } else if (window.matchMedia && window.matchMedia('(prefers-color-scheme: light)').matches) {
                this.theme = 'light';
            }
            this.updateThemeClass();

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

            // Load saved view
            const savedView = localStorage.getItem('zdm_active_view');
            if (savedView) {
                this.activeView = savedView;
            }

            // Watch for view changes to save
            this.$watch('activeView', (value) => {
                localStorage.setItem('zdm_active_view', value);
            });

            // Handle window resize for all terminals
            window.addEventListener('resize', () => {
                this.sessions.forEach(s => {
                    if (s.terminal && s.fitAddon) s.fitAddon.fit();
                });
            });
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

        // Initialize terminal (returns term instance, doesn't attach yet if container not found)
        initTerminal(session, containerId) {
            if (session.terminal) return { term: session.terminal, fitAddon: session.fitAddon };
            if (!window.Terminal) {
                console.error("xterm.js not loaded!");
                return;
            }

            const isDark = this.theme === 'dark';

            const term = new window.Terminal({
                cursorBlink: true,
                theme: isDark ? {
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
                } : {
                    background: '#ffffff', // white
                    foreground: '#1e293b', // slate-800
                    cursor: '#6366f1', // indigo-500
                    cursorAccent: '#ffffff',
                    selection: '#cbd5e1', // slate-300
                    black: '#000000',
                    red: '#dc2626',
                    green: '#059669',
                    yellow: '#d97706',
                    blue: '#2563eb',
                    magenta: '#9333ea',
                    cyan: '#0891b2',
                    white: '#e2e8f0',
                    brightBlack: '#334155',
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
            if (el) {
                term.open(el);

                // Load WebGL Addon
                try {
                    if (window.WebglAddon) {
                        const webglAddon = new window.WebglAddon.WebglAddon();
                        webglAddon.onContextLoss(e => {
                            webglAddon.dispose();
                        });
                        term.loadAddon(webglAddon);
                        console.log("WebGL Addon loaded");
                    }
                } catch (e) {
                    console.error("Failed to load WebGL addon", e);
                }

                // Initial fit
                fitAddon.fit();
            }

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

        updateThemeClass() {
            if (this.theme === 'dark') {
                document.documentElement.classList.add('dark');
            } else {
                document.documentElement.classList.remove('dark');
            }
        },

        toggleTheme() {
            this.theme = this.theme === 'dark' ? 'light' : 'dark';
            localStorage.setItem('zdm_theme', this.theme);
            this.updateThemeClass();
            this.refreshTerminalThemes();
        },

        // Menu Bar Helpers
        openMenu(name) {
            this.activeMenu = this.activeMenu === name ? null : name;
        },
        closeMenu() {
            this.activeMenu = null;
        },

        // Project Persistence
        newProject() {
            if (confirm('Create new project? Unsaved changes will be lost.')) {
                this.sessions.forEach(s => {
                    if (s.ws) s.ws.close();
                });
                this.sessions = [];
                this.layoutGroups = [];
                this.savedCommands = [];
                this.activeView = 'commands';
                this.currentPort = '';
                this.baudrate = 115200;
                // Keep theme as is, or reset? Let's keep it.
            }
        },

        async saveProject(saveAs = false) {
            const project = {
                meta: {
                    version: "1.0",
                    created: new Date().toISOString()
                },
                settings: {
                    theme: this.theme,
                    sidebarWidth: this.sidebarWidth,
                    activeView: this.activeView
                },
                sessions: this.sessions.map(s => ({
                    id: s.id,
                    port: s.port,
                    baudrate: s.baudrate,
                    // We don't save the actual connection state or terminal content, 
                    // just the configuration to restore the tab.
                })),
                layoutGroups: this.layoutGroups,
                data: {
                    savedCommands: this.savedCommands,
                    repeatCommands: this.repeatCommands
                }
            };

            const content = JSON.stringify(project, null, 2);

            // Use File System Access API if available
            if (window.showSaveFilePicker) {
                try {
                    const handle = await window.showSaveFilePicker({
                        suggestedName: 'project.zp',
                        types: [{
                            description: 'Zephyr Project File',
                            accept: { 'application/json': ['.zp'] },
                        }],
                    });
                    const writable = await handle.createWritable();
                    await writable.write(content);
                    await writable.close();
                    return;
                } catch (err) {
                    // If user cancels or error occurs, fall back to legacy method if saveAs was false
                    if (err.name === 'AbortError') return;
                    console.error('File Picker Error:', err);
                }
            }

            // Fallback for browsers that don't support File System Access API
            let filename = "project.zp";
            if (saveAs) {
                const name = prompt("Enter project filename:", "project");
                if (!name) return; // User cancelled
                filename = name.endsWith('.zp') ? name : name + '.zp';
            }

            const blob = new Blob([content], { type: "application/json" });
            const url = URL.createObjectURL(blob);
            const a = document.createElement("a");
            a.href = url;
            a.download = filename;
            document.body.appendChild(a);
            a.click();
            document.body.removeChild(a);
            URL.revokeObjectURL(url);
        },

        triggerOpenProject() {
            document.getElementById('projectFileInput').click();
        },

        async loadProject(event) {
            const file = event.target.files[0];
            if (!file) return;

            const text = await file.text();
            try {
                const project = JSON.parse(text);

                // version check could go here

                // Restore settings
                if (project.settings) {
                    if (project.settings.theme && project.settings.theme !== this.theme) {
                        this.toggleTheme(); // or just set it
                    }
                    if (project.settings.sidebarWidth) this.sidebarWidth = project.settings.sidebarWidth;
                    if (project.settings.activeView) this.activeView = project.settings.activeView;
                }

                // Restore Data
                if (project.data) {
                    this.savedCommands = project.data.savedCommands || [];
                    this.repeatCommands = project.data.repeatCommands || [];
                }

                // Restore Sessions (Closed state)
                if (project.sessions) {
                    // Close existing
                    this.sessions.forEach(s => { if (s.ws) s.ws.close(); });
                    this.sessions = [];

                    // Re-create tabs
                    project.sessions.forEach(sConfig => {
                        const newSession = {
                            id: sConfig.id,
                            port: sConfig.port,
                            baudrate: sConfig.baudrate,
                            connected: false,
                            terminal: null,
                            fitAddon: null,
                            ws: null,
                            promptBuffer: ''
                        };
                        this.sessions.push(newSession);
                        // We will need to init terminal UI for these, relying on Alpine's x-for to render them
                        // and then $nextTick to init xterm? 
                        // Actually, initTerminal is called in x-init of the *tab content*.
                        // When we push to sessions, the DOM updates.
                    });
                }

                // Restore Layout
                if (project.layoutGroups) {
                    this.layoutGroups = project.layoutGroups;
                } else {
                    // If no layout groups, imply default if sessions exist?
                    // Existing logic handles simple sessions array usually.
                }

                alert('Project loaded successfully!');

            } catch (e) {
                console.error("Failed to load project", e);
                alert('Error loading project file');
            }

            // Reset input
            event.target.value = '';
        },

        refreshTerminalThemes() {
            const isDark = this.theme === 'dark';
            const theme = isDark ? {
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
            } : {
                background: '#ffffff', // white
                foreground: '#000000', // black
                cursor: '#4f46e5', // indigo-600
                cursorAccent: '#ffffff',
                selection: '#cbd5e1', // slate-300
                black: '#000000',
                red: '#dc2626',
                green: '#059669',
                yellow: '#d97706',
                blue: '#2563eb',
                magenta: '#9333ea',
                cyan: '#0891b2',
                white: '#e2e8f0',
                brightBlack: '#334155',
                brightRed: '#f87171',
                brightGreen: '#34d399',
                brightYellow: '#fbbf24',
                brightBlue: '#60a5fa',
                brightMagenta: '#c084fc',
                brightCyan: '#22d3ee',
                brightWhite: '#f1f5f9'
            };

            this.sessions.forEach(session => {
                if (session.terminal) {
                    session.terminal.options.theme = theme;
                }
            });
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
                    // Try to restore order and active port from localStorage
                    let openPorts = [];
                    let savedGroups = [];
                    const savedState = localStorage.getItem('zdm_session_state');
                    if (savedState) {
                        try {
                            const parsed = JSON.parse(savedState);
                            openPorts = parsed.openPorts || [];
                            savedGroups = parsed.layoutGroups || [];
                        } catch (e) {
                            console.error('Error parsing session state:', e);
                        }
                    }

                    // Map backend sessions to frontend session objects
                    const backendSessions = data.sessions;

                    // Restore sessions
                    const restoredSessions = [];
                    backendSessions.forEach(backendSess => {
                        restoredSessions.push({
                            id: 'session_' + Math.random().toString(36).substr(2, 9),
                            port: backendSess.port,
                            baudrate: backendSess.baudrate,
                            connected: true,
                            terminal: null,
                            fitAddon: null,
                            ws: null,
                            promptBuffer: ''
                        });
                    });

                    this.sessions = restoredSessions;

                    // Restore Layout Groups
                    if (savedGroups.length > 0) {
                        // Reconstruct groups based on available sessions
                        this.layoutGroups = savedGroups.map(g => {
                            const availableSessionIds = g.sessionIds.filter(port =>
                                this.sessions.find(s => s.port === port)
                            ).map(port => this.sessions.find(s => s.port === port).id);

                            if (availableSessionIds.length === 0) return null;

                            const activeSess = this.sessions.find(s => s.port === g.activePort);
                            return {
                                id: g.id,
                                sessionIds: availableSessionIds,
                                activeSessionId: activeSess ? activeSess.id : availableSessionIds[0]
                            };
                        }).filter(g => g !== null);
                    }

                    // Ensure at least one group exists
                    if (this.layoutGroups.length === 0) {
                        this.layoutGroups = [{
                            id: 'group_default',
                            sessionIds: this.sessions.map(s => s.id),
                            activeSessionId: this.sessions.length > 0 ? this.sessions[0].id : null
                        }];
                    }

                    // Set global active session if not set
                    if (!this.activeSessionId && this.sessions.length > 0) {
                        this.activeSessionId = this.sessions[0].id;
                    }

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
                        // Switch to initial session to ensure fit
                        if (this.activeSessionId) this.switchSession(this.activeSessionId);
                    });
                }
            } catch (error) {
                console.error('Error checking status:', error);
            }
        },

        saveSessionState() {
            const state = {
                openPorts: this.sessions.map(s => s.port),
                activePort: this.activeSession ? this.activeSession.port : null,
                layoutGroups: this.layoutGroups.map(g => ({
                    id: g.id,
                    sessionIds: g.sessionIds.map(sid => this.sessions.find(s => s.id === sid).port),
                    activePort: this.sessions.find(s => s.id === g.activeSessionId)?.port
                }))
            };
            localStorage.setItem('zdm_session_state', JSON.stringify(state));
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
        switchSession(sessionId, groupId = null) {
            console.log(`Switching to session ${sessionId} in group ${groupId}`);

            // If groupId is provided, update that group's active session
            if (groupId) {
                const groupIdx = this.layoutGroups.findIndex(g => g.id === groupId);
                if (groupIdx !== -1) {
                    this.layoutGroups[groupIdx].activeSessionId = sessionId;
                    // Force reactivity for the array
                    this.layoutGroups = [...this.layoutGroups];
                }
            } else {
                // Find which group contains this session and update it
                const groupIdx = this.layoutGroups.findIndex(g => g.sessionIds.includes(sessionId));
                if (groupIdx !== -1) {
                    this.layoutGroups[groupIdx].activeSessionId = sessionId;
                    this.layoutGroups = [...this.layoutGroups];
                }
            }

            this.activeSessionId = sessionId;
            const session = this.activeSession;
            if (session) {
                this.currentPort = session.port;
                this.connected = session.connected;
                this.$nextTick(() => {
                    if (session.terminal) {
                        this.attachTerminalToDom(session);
                        session.terminal.focus();
                    }
                });
                this.saveSessionState();
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

            // Find group containing this session
            const group = this.layoutGroups.find(g => g.sessionIds.includes(sessionId));
            if (group) {
                group.sessionIds = group.sessionIds.filter(id => id !== sessionId);

                // If group is empty, remove it (unless it's the last one)
                if (group.sessionIds.length === 0 && this.layoutGroups.length > 1) {
                    this.layoutGroups = this.layoutGroups.filter(g => g.id !== group.id);
                } else if (group.activeSessionId === sessionId) {
                    group.activeSessionId = group.sessionIds.length > 0 ? group.sessionIds[0] : null;
                }
            }

            this.sessions = this.sessions.filter(s => s.id !== sessionId);

            if (this.activeSessionId === sessionId) {
                this.activeSessionId = this.sessions.length > 0 ? this.sessions[0].id : null;
                if (this.activeSessionId) this.switchSession(this.activeSessionId);
            }
            this.saveSessionState();
        },

        // Drag & Drop Handlers
        handleDragStart(sessionId) {
            this.draggedSessionId = sessionId;
            document.body.classList.add('dragging');
        },

        handleDragEnd() {
            this.draggedSessionId = null;
            this.dragOverGroupId = null;
            this.dragOverPosition = null;
            document.body.classList.remove('dragging');
        },

        handleDragOver(event, groupId, position = 'center') {
            event.preventDefault();

            let finalPosition = position;

            // If dragging over the main container, detect if it's near an edge
            if (position === 'center' && event.currentTarget.classList.contains('group')) {
                const rect = event.currentTarget.getBoundingClientRect();
                const x = event.clientX - rect.left;
                const y = event.clientY - rect.top;
                const threshold = 50; // pixels from edge to trigger split

                if (x < threshold) finalPosition = 'left';
                else if (x > rect.width - threshold) finalPosition = 'right';
                else if (y < threshold) finalPosition = 'top';
                else if (y > rect.height - threshold) finalPosition = 'bottom';
            }

            if (this.dragOverGroupId !== groupId || this.dragOverPosition !== finalPosition) {
                this.dragOverGroupId = groupId;
                this.dragOverPosition = finalPosition;
            }
        },

        handleDragLeave() {
            this.dragOverGroupId = null;
            this.dragOverPosition = null;
        },

        handleDrop(event, targetGroupId, position = 'center') {
            event.preventDefault();
            const sessionId = this.draggedSessionId;
            if (!sessionId) return;

            // Use the calculated dragOverPosition if we're dropping in 'center' and have a more specific one
            const effectivePosition = (position === 'center' && this.dragOverPosition) ? this.dragOverPosition : position;

            const sourceGroup = this.layoutGroups.find(g => g.sessionIds.includes(sessionId));
            const targetGroup = this.layoutGroups.find(g => g.id === targetGroupId);

            if (!sourceGroup || !targetGroup) return;

            if (effectivePosition === 'center' || (sourceGroup.id === targetGroup.id && effectivePosition === 'center')) {
                // Move session within the same group or to another tab bar
                if (sourceGroup.id !== targetGroup.id) {
                    sourceGroup.sessionIds = sourceGroup.sessionIds.filter(id => id !== sessionId);
                    targetGroup.sessionIds.push(sessionId);

                    // Cleanup source group if empty
                    if (sourceGroup.sessionIds.length === 0 && this.layoutGroups.length > 1) {
                        this.layoutGroups = this.layoutGroups.filter(g => g.id !== sourceGroup.id);
                    } else if (sourceGroup.activeSessionId === sessionId) {
                        sourceGroup.activeSessionId = sourceGroup.sessionIds[0];
                    }
                }
                targetGroup.activeSessionId = sessionId;
            } else {
                // Split group
                sourceGroup.sessionIds = sourceGroup.sessionIds.filter(id => id !== sessionId);

                const newGroupId = 'group_' + Math.random().toString(36).substr(2, 9);
                const newGroup = {
                    id: newGroupId,
                    sessionIds: [sessionId],
                    activeSessionId: sessionId
                };

                const targetIdx = this.layoutGroups.indexOf(targetGroup);
                if (effectivePosition === 'left' || effectivePosition === 'top') {
                    this.layoutGroups.splice(targetIdx, 0, newGroup);
                } else {
                    this.layoutGroups.splice(targetIdx + 1, 0, newGroup);
                }

                // Cleanup source group if empty
                if (sourceGroup.sessionIds.length === 0 && this.layoutGroups.length > 1) {
                    this.layoutGroups = this.layoutGroups.filter(g => g.id !== sourceGroup.id);
                } else if (sourceGroup.activeSessionId === sessionId) {
                    sourceGroup.activeSessionId = sourceGroup.sessionIds[0];
                }
            }

            this.handleDragEnd();

            this.switchSession(sessionId);

            // Refit all terminals after layout change
            this.$nextTick(() => {
                this.sessions.forEach(s => {
                    this.attachTerminalToDom(s);
                });
            });

            this.saveSessionState();
        },

        splitGroup(sessionId, position) {
            const group = this.layoutGroups.find(g => g.sessionIds.includes(sessionId));
            if (!group) return;

            this.draggedSessionId = sessionId;
            this.handleDrop({ preventDefault: () => { } }, group.id, position);
        },

        // Connect WebSocket for a specific session
        connectWebSocket(session) {
            if (!session) return;

            if (session.ws) {
                if (session.ws.readyState === WebSocket.OPEN || session.ws.readyState === WebSocket.CONNECTING) {
                    // Already connected or connecting, no need to re-connect unless port changed
                    return;
                }
                session.ws.close();
            }

            const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
            const wsUrl = `${protocol}//${window.location.host}/ws?port=${encodeURIComponent(session.port)}`;

            session.ws = new WebSocket(wsUrl);

            session.ws.onopen = () => {
                console.log(`WebSocket connected for ${session.port}`);
                // WebSocket connected successfully

                // Removed automatic \r on connect to avoid prompt flooding on refresh
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
                // WebSocket error occurred
            };

            session.ws.onclose = () => {
                console.log(`WebSocket disconnected for ${session.port}`);
                // WebSocket closed
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

            let port;
            if (this.connectionMode === 'telnet') {
                if (!this.telnetHost || !this.telnetPort) return 'connect';
                port = `${this.telnetHost}:${this.telnetPort}`;
            } else {
                port = this.manualPort || this.selectedPort;
            }

            if (!port) return 'connect';

            const session = this.sessions.find(s => s.port === port && s.connected);
            if (!session) return 'connect';

            if (this.activeSessionId === session.id) return 'disconnect';
            return 'switch';
        },

        // Save settings / Toggle connection
        async saveSettings() {
            const state = this.connectButtonState;
            let portToConnect;

            if (this.connectionMode === 'telnet') {
                portToConnect = `${this.telnetHost}:${this.telnetPort}`;
            } else {
                portToConnect = this.manualPort || this.selectedPort;
            }

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
                        baudrate: parseInt(this.baudRate) || 115200,
                        connection_type: this.connectionMode
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

                    // Add to active group or create one
                    if (this.layoutGroups.length === 0) {
                        this.layoutGroups.push({
                            id: 'group_default',
                            sessionIds: [sessionId],
                            activeSessionId: sessionId
                        });
                    } else {
                        // Find group containing currently active session or just use the first one
                        const activeGroup = this.layoutGroups.find(g => g.activeSessionId === this.activeSessionId) || this.layoutGroups[0];
                        activeGroup.sessionIds.push(sessionId);
                        activeGroup.activeSessionId = sessionId;
                    }

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
                    this.saveSessionState();
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

        // Helper to robustly attach terminal to DOM
        attachTerminalToDom(session) {
            if (!session || !session.terminal) return;

            const containerId = `terminal-${session.id}`;
            const el = document.getElementById(containerId);

            if (!el) return;

            // If terminal is not attached yet (element property is undefined or not in DOM)
            if (!session.terminal.element || !session.terminal.element.parentNode) {
                console.log(`First time open for ${session.port}`);
                session.terminal.open(el);
                if (session.fitAddon) session.fitAddon.fit();
                return;
            }

            // If attached but to the WRONG parent (e.g. after split/move)
            if (session.terminal.element.parentNode !== el) {
                console.log(`Re-parenting terminal ${session.port} to new container`);
                el.appendChild(session.terminal.element);
                if (session.fitAddon) session.fitAddon.fit();
            } else {
                // Just refit to be safe
                if (session.fitAddon) session.fitAddon.fit();
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
                this.discoveryStartTime = Date.now();
                this.showDiscoveryConfirm = false;
                this.discoveryCancelRequested = false;
                this.discoveryPaused = false;

                console.log('Starting command discovery...');

                // Send 'help' command to get list of commands
                this.sendDiscoveryCommand('help\n');

                // Wait for discovery to complete (with timeout)
                await this.waitForDiscoveryCompletion(300);

                this.showStatus('Commands scanned successfully! Discovering deep subcommands...', 'success');
                this.showCommands = true;

                // Recursive deep discovery
                await this.discoverAllSubcommands();

                if (this.discoveryCancelRequested) {
                    this.showStatus('Command discovery cancelled by user.', 'info');
                } else {
                    this.showStatus('All commands and deep subcommands scanned!', 'success');
                }
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

        // Recursive discovery for all commands and their children
        async discoverAllSubcommands() {
            if (this.commands.length === 0) return;

            console.log(`Starting deep subcommand discovery for ${this.commands.length} top-level commands`);

            // We use a queue-like approach to discover all subcommands recursively
            // but we process them top-level first for better UX
            for (let i = 0; i < this.commands.length; i++) {
                if (this.discoveryCancelRequested) break;

                const cmd = this.commands[i];
                await this.discoverDeep(cmd);
            }

            console.log('Deep subcommand discovery complete');
        },

        // Recursively discover subcommands for a command and its found children
        async discoverDeep(command) {
            if (this.discoveryCancelRequested) return;

            // Check for 60-second timeout
            if (!this.showDiscoveryConfirm && (Date.now() - this.discoveryStartTime > 60000)) {
                this.showDiscoveryConfirm = true;
                this.discoveryPaused = true;

                // Wait for user to decide
                while (this.discoveryPaused && !this.discoveryCancelRequested) {
                    await new Promise(resolve => setTimeout(resolve, 500));
                }

                if (this.discoveryCancelRequested) return;
            }

            try {
                this.discoveringSubcommands[command.id] = true;
                const subcommands = await this.discoverSubcommandsInternal(command);

                if (subcommands && subcommands.length > 0) {
                    // Flattening: Add subcommands directly to the parent's subcommands list
                    // If this is a deep subcommand, it still goes into the top-level command's subcommands list
                    // to keep the UI flat as requested.

                    // Find the top-level parent
                    let topLevelCmd = command;
                    while (topLevelCmd.parentCmd) {
                        topLevelCmd = topLevelCmd.parentCmd;
                    }

                    if (!topLevelCmd.subcommands) topLevelCmd.subcommands = [];

                    for (const sub of subcommands) {
                        // Link back for recursion
                        sub.parentCmd = command;

                        // Calculate display name relative to top-level command
                        // e.g. if top-level is 'shell' and this is 'shell echo off', name = 'echo off'
                        if (sub.fullName) {
                            const topLevelName = topLevelCmd.name;
                            if (sub.fullName.startsWith(topLevelName + ' ')) {
                                sub.name = sub.fullName.substring(topLevelName.length + 1).trim();
                            }
                        }

                        // Add to top-level list if not already there (by fullName)
                        if (!topLevelCmd.subcommands.find(s => s.fullName === sub.fullName)) {
                            topLevelCmd.subcommands.push(sub);
                        }

                        // Recurse into this subcommand
                        await this.discoverDeep(sub);
                    }

                    topLevelCmd.hasSubcommands = true;
                    this.saveCachedCommands(this.commands);
                }
            } catch (error) {
                console.error(`Error in deep discovery for ${command.fullName || command.name}:`, error);
            } finally {
                this.discoveringSubcommands[command.id] = false;
            }
        },

        continueDiscovery() {
            this.showDiscoveryConfirm = false;
            this.discoveryPaused = false;
        },

        cancelDiscovery() {
            this.discoveryCancelRequested = true;
            this.discoveryPaused = false;
            this.showDiscoveryConfirm = false;
        },

        // Internal subcommand discovery (returns found subcommands)
        async discoverSubcommandsInternal(command) {
            this.commandDiscoveryInProgress = true;
            this.discoveryCollectedData = '';

            try {
                const cmdName = command.fullName || command.name;
                console.log(`Discovering subcommands for: ${cmdName}`);

                // Send '<command> --help' to get subcommands
                this.sendDiscoveryCommand(`${cmdName.trim()} --help\n`);

                // Wait for discovery to complete
                await this.waitForSubcommandDiscovery(1200);

                // Parse subcommands from help output
                const subcommands = this.parseSubcommands(this.discoveryCollectedData, cmdName.trim());

                // Minimal delay to avoid overwhelming the shell
                await new Promise(resolve => setTimeout(resolve, 10));

                return subcommands;
            } catch (error) {
                console.error('Error discovering subcommands:', error);
                return [];
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

                    // Check if we have help output with commands
                    if (this.discoveryCollectedData.includes('Available commands:')) {
                        // If we also see the prompt, we are definitely done
                        if (this.discoveryCollectedData.match(/[\$>] $/) || this.discoveryCollectedData.match(/\n.*[\$>] $/)) {
                            const parsed = this.parseHelpOutput(this.discoveryCollectedData);
                            if (parsed.length > 0) {
                                resolved = true;
                                this.commands = parsed;
                                this.saveCachedCommands(parsed);
                                this.commandDiscoveryInProgress = false;
                                console.log('✓ Discovery successful (prompt detected) with', parsed.length, 'commands');
                                resolve();
                                return;
                            }
                        }
                    }

                    // Check if data has stopped changing (no new data for 0.2 seconds)
                    if (this.discoveryCollectedData.length === lastDataLength) {
                        noDataChangedCount++;
                        if (noDataChangedCount >= 3) { // 150ms with no change (3 * 50ms)
                            console.log('No new data for 150ms, treating as complete');
                            const parsed = this.parseHelpOutput(this.discoveryCollectedData);
                            if (parsed.length > 0) {
                                resolved = true;
                                this.commands = parsed;
                                this.saveCachedCommands(parsed);
                                console.log('✓ Discovery successful (data stable) with', parsed.length, 'commands');
                                resolve();
                                return;
                            } else {
                                resolved = true;
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
                        reject(new Error('Command discovery timeout'));
                        return;
                    }

                    // Try again in 50ms
                    setTimeout(checkCompletion, 50);
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

                    // FAST PATH: Check if we have the prompt at the end of the buffer
                    if (this.discoveryCollectedData.length > 5 &&
                        (this.discoveryCollectedData.match(/[\$>] $/) || this.discoveryCollectedData.match(/\n.*[\$>] $/))) {
                        console.log('Prompt detected, completing discovery immediately');
                        resolved = true;
                        resolve();
                        return;
                    }

                    // Check if data has stopped changing (no new data for 0.15 seconds)
                    if (this.discoveryCollectedData.length === lastDataLength) {
                        noDataChangedCount++;
                        if (noDataChangedCount >= 3) { // 150ms (3 * 50ms)
                            console.log('Data stable, completing discovery');
                            resolved = true;
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
                        resolve();
                        return;
                    }

                    // Try again in 50ms
                    setTimeout(checkCompletion, 50);
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
                    // Robust subcommand discovery:
                    // 1. "subcommand : Description"
                    // 2. "subcommand Description" (multiple spaces)
                    let cmdMatch = line.match(/^(\w[\w_-]*)\s+:\s*(.*)$/);
                    if (!cmdMatch) {
                        cmdMatch = line.match(/^(\w[\w_-]+)\s{2,}(.+)$/);
                    }

                    // Specific case: dynamic subcommands/args look like <arg> or [arg]
                    // If the "subcommand name" starts with < or [, it's likely an argument, not a command.
                    if (cmdMatch) {
                        const subCmdName = cmdMatch[1];

                        // If it's a dynamic argument, don't treat as a subcommand for recursion
                        if (subCmdName.startsWith('<') || subCmdName.startsWith('[')) {
                            console.log(`  ! Skipping dynamic argument as subcommand: ${subCmdName}`);
                            continue;
                        }

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