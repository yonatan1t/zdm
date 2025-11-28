# Quick Start Guide - Command Discovery Features

## For End Users

### Using Command Discovery

1. **Connect to Device**
   - Click "Settings" button
   - Select serial port
   - Click "Connect"

2. **Scan Commands**
   - Click "Scan Commands" button
   - Wait for discovery to complete
   - Commands appear in sidebar

3. **View Subcommands**
   - Look for commands with "has subcommands" badge
   - Click the arrow (►) to expand
   - Subcommands appear indented below parent

4. **Execute Commands**
   - Click on any command (parent or subcommand)
   - Fill in arguments if needed
   - Click "Execute"

5. **Rescan Commands**
   - Click "⟳ Rescan Commands" at bottom of sidebar
   - Discovers new commands and subcommands

### Concurrency Protection

If you try to scan while a scan is in progress:
- You'll see: "Command discovery already in progress. Please wait..."
- Wait for current scan to complete
- Then try again

## For Developers

### Adding New Command Types

To support new command patterns:

1. **Update Parser**
   ```javascript
   // In parseHelpOutput() or parseSubcommands()
   const cmdMatch = line.match(/your-pattern-here/);
   ```

2. **Update Data Model**
   ```javascript
   commands.push({
     id: cmdName,
     name: cmdName,
     description: cmdDesc,
     // Add new properties here
     customProperty: value
   });
   ```

3. **Update UI**
   ```html
   <!-- In frontend/index.html -->
   <div x-show="cmd.customProperty">
     <!-- Display custom property -->
   </div>
   ```

### Extending Subcommand Discovery

To add automatic discovery for all commands:

```javascript
async scanCommands(force = false) {
  // ... existing code ...
  
  // After initial scan, discover all subcommands
  for (const cmd of this.commands) {
    await this.discoverSubcommands(cmd);
  }
}
```

### Custom Discovery Logic

To add custom discovery logic:

```javascript
async customDiscovery(command) {
  if (this.discoveryLock) {
    this.showStatus('Discovery in progress', 'error');
    return;
  }
  
  this.discoveryLock = true;
  try {
    // Your custom logic here
    this.sendDiscoveryCommand('your-command\n');
    await this.waitForDiscoveryCompletion(timeout);
    // Parse and process results
  } finally {
    this.discoveryLock = false;
  }
}
```

### Testing Your Changes

1. **Manual Testing**
   ```bash
   # Start the backend
   cd backend
   python -m app.main
   
   # Open frontend in browser
   # Navigate to http://localhost:8000
   ```

2. **Automated Testing**
   ```bash
   # Open test file in browser
   open test_command_discovery.html
   
   # Run tests
   # Click test buttons and verify results
   ```

3. **Integration Testing**
   - Connect to real Zephyr device
   - Test with various shell configurations
   - Verify all command types are discovered

### Common Issues

#### Issue: Commands not discovered
**Solution:**
- Check WebSocket connection
- Verify device is sending help output
- Check console for parsing errors
- Increase timeout in `waitForDiscoveryCompletion()`

#### Issue: Subcommands not showing
**Solution:**
- Click expand arrow to trigger discovery
- Check if `help <command>` returns subcommands
- Verify parsing logic in `parseSubcommands()`

#### Issue: Concurrent discovery errors
**Solution:**
- This is expected behavior
- Wait for current discovery to complete
- Check that lock is properly released in finally block

### Performance Tuning

#### Adjust Discovery Timeout
```javascript
// In scanCommands()
await this.waitForDiscoveryCompletion(300); // milliseconds
```

#### Adjust Stability Check
```javascript
// In waitForDiscoveryCompletion()
if (noDataChangedCount >= 4) { // 4 * 500ms = 2 seconds
```

#### Batch Subcommand Discovery
```javascript
async discoverAllSubcommands() {
  const promises = this.commands.map(cmd => 
    this.discoverSubcommands(cmd)
  );
  await Promise.all(promises);
}
```

### API Reference

#### Methods

##### `scanCommands(force = false)`
Scans for top-level commands.
- **Parameters:**
  - `force`: Skip cache and force rescan
- **Returns:** Promise
- **Throws:** Error if discovery fails

##### `discoverSubcommands(command)`
Discovers subcommands for a specific command.
- **Parameters:**
  - `command`: Command object
- **Returns:** Promise
- **Side Effects:** Updates command.subcommands

##### `toggleCommandExpansion(command)`
Toggles expansion state of a command.
- **Parameters:**
  - `command`: Command object
- **Side Effects:** Updates expandedCommands state

##### `executeCommand(command)`
Executes a command (parent or subcommand).
- **Parameters:**
  - `command`: Command object
- **Side Effects:** Sends command via WebSocket

#### State Variables

##### `discoveryLock`
- **Type:** Boolean
- **Purpose:** Prevents concurrent discoveries
- **Values:** true (locked), false (unlocked)

##### `expandedCommands`
- **Type:** Object
- **Purpose:** Tracks which commands are expanded
- **Structure:** `{ 'command-id': true/false }`

##### `commands`
- **Type:** Array
- **Purpose:** Stores all discovered commands
- **Structure:** Array of command objects

### Code Examples

#### Example 1: Custom Command Parser
```javascript
parseCustomCommands(helpText) {
  const lines = helpText.split('\n');
  const commands = [];
  
  for (const line of lines) {
    // Your parsing logic
    if (line.match(/your-pattern/)) {
      commands.push({
        id: extractId(line),
        name: extractName(line),
        description: extractDesc(line)
      });
    }
  }
  
  return commands;
}
```

#### Example 2: Conditional Subcommand Discovery
```javascript
async smartDiscovery(command) {
  // Only discover subcommands for certain command types
  if (command.name.startsWith('log') || 
      command.name.startsWith('device')) {
    await this.discoverSubcommands(command);
  }
}
```

#### Example 3: Progress Tracking
```javascript
async scanCommandsWithProgress() {
  this.discoveryProgress = 0;
  
  await this.scanCommands();
  this.discoveryProgress = 50;
  
  for (let i = 0; i < this.commands.length; i++) {
    await this.discoverSubcommands(this.commands[i]);
    this.discoveryProgress = 50 + (50 * (i + 1) / this.commands.length);
  }
}
```

### Best Practices

1. **Always Use Lock**
   - Check `discoveryLock` before starting discovery
   - Acquire lock at start
   - Release in finally block

2. **Validate Input**
   - Check command structure before processing
   - Validate help output format
   - Handle malformed data gracefully

3. **Cache Aggressively**
   - Save to localStorage after discovery
   - Load from cache on startup
   - Version your cache structure

4. **Provide Feedback**
   - Show loading states
   - Display error messages
   - Indicate progress

5. **Handle Errors**
   - Wrap in try-catch
   - Log errors to console
   - Show user-friendly messages
   - Clean up state in finally

### Debugging Tips

1. **Enable Console Logging**
   ```javascript
   console.log('Discovery started');
   console.log('Collected data:', this.discoveryCollectedData);
   console.log('Parsed commands:', commands);
   ```

2. **Inspect Cache**
   ```javascript
   // In browser console
   JSON.parse(localStorage.getItem('zephyr_commands_cache'))
   ```

3. **Monitor WebSocket**
   ```javascript
   this.ws.onmessage = (event) => {
     console.log('WS message:', event.data);
     // ... rest of handler
   };
   ```

4. **Check Lock State**
   ```javascript
   // In browser console
   Alpine.store('app').discoveryLock
   ```

### Contributing

To contribute improvements:

1. Fork the repository
2. Create a feature branch
3. Make your changes
4. Add tests
5. Update documentation
6. Submit pull request

### Support

For issues or questions:
- Check `COMMAND_DISCOVERY.md` for detailed documentation
- Review `test_command_discovery.html` for examples
- Check console for error messages
- Open an issue on GitHub

## Quick Reference

### Keyboard Shortcuts
- None currently implemented
- Future: Ctrl+K to open command palette

### Status Messages
- "Scanning commands..." - Discovery in progress
- "Commands scanned successfully!" - Discovery complete
- "Command discovery already in progress" - Concurrent attempt blocked
- "Error scanning commands" - Discovery failed

### Visual Indicators
- 🔒 Lock icon - Discovery locked
- ► Arrow - Command can be expanded
- ▼ Arrow - Command is expanded
- Purple badge - "has subcommands"
- Indented list - Subcommands

### Cache Location
- **Browser:** localStorage
- **Key:** `zephyr_commands_cache`
- **Format:** JSON
- **Version:** 2.0
