# Command Discovery System - Implementation Documentation

## Overview

This document describes the enhanced command discovery system for the Zephyr Device Manager, which includes concurrency control and recursive subcommand support.

## Features

### 1. Concurrency Control

The command discovery system now prevents concurrent discovery operations to ensure data consistency and prevent race conditions.

#### Implementation Details

- **Discovery Lock**: A `discoveryLock` flag prevents multiple discovery operations from running simultaneously
- **User Feedback**: When a discovery is already in progress, subsequent attempts are rejected with a clear error message
- **Automatic Cleanup**: The lock is automatically released when discovery completes or fails

#### Usage

```javascript
// The lock is automatically managed
await this.scanCommands(); // First call acquires lock
await this.scanCommands(); // Second call is rejected with error message
```

#### Benefits

- Prevents data corruption from concurrent writes to command cache
- Avoids confusing UI states
- Provides clear feedback to users
- Validates Requirements 9.3 and 10.3

### 2. Recursive Subcommand Support

The system now supports hierarchical command structures with parent commands and subcommands (e.g., `log backend`, `log disable`).

#### Data Model

Commands now support a hierarchical structure:

```javascript
{
  id: 'log',
  name: 'log',
  description: 'Logging commands',
  hasSubcommands: true,  // Indicates if command has subcommands
  subcommands: [
    {
      id: 'log_backend',
      name: 'backend',
      fullName: 'log backend',  // Full command to execute
      description: 'Enable backend logging',
      parent: 'log'  // Reference to parent command
    }
  ]
}
```

#### Discovery Process

1. **Initial Discovery**: Run `help` command to get top-level commands
2. **Subcommand Discovery**: For each command, optionally run `<command> --help` to discover subcommands
3. **Lazy Loading**: Subcommands are discovered on-demand when user expands a command
4. **Caching**: Both parent commands and subcommands are cached in localStorage

**Note:** Zephyr shell uses `<command> --help` syntax (not `help <command>`) to get subcommand information.

#### UI Features

- **Visual Indicators**: Commands with subcommands show a badge and expand/collapse arrow
- **Drill-Down Interface**: Click arrow to expand and view subcommands
- **Nested Display**: Subcommands are displayed with indentation and visual hierarchy
- **Full Command Execution**: Subcommands execute with their full name (e.g., `log backend`)

#### API Methods

##### `discoverSubcommands(command)`

Discovers subcommands for a specific parent command.

```javascript
await this.discoverSubcommands(command);
```

- Sends `<command> --help` to device (Zephyr shell syntax)
- Parses output to extract subcommands
- Updates command object with subcommands
- Saves to cache

##### `parseSubcommands(helpText, parentCommand)`

Parses the output of `<command> --help` to extract subcommands.

```javascript
const subcommands = this.parseSubcommands(helpText, 'log');
```

Returns array of subcommand objects with:
- `id`: Unique identifier (parent_subcommand)
- `name`: Subcommand name
- `fullName`: Full command string for execution
- `description`: Subcommand description
- `parent`: Parent command name

##### `toggleCommandExpansion(command)`

Toggles the expansion state of a command to show/hide subcommands.

```javascript
this.toggleCommandExpansion(command);
```

- Expands: Discovers subcommands if not already discovered
- Collapses: Hides subcommands
- Tracks state in `expandedCommands` object

#### Cache Structure

The cache now uses version 2.0 to support hierarchical structures:

```javascript
{
  version: '2.0',
  lastScanned: '2024-01-15T10:30:00Z',
  commands: [
    {
      id: 'log',
      name: 'log',
      description: 'Logging commands',
      hasSubcommands: true,
      subcommands: [...]
    }
  ]
}
```

### 3. Command Execution

Commands are executed with proper handling of subcommands:

```javascript
executeCommand(command) {
  // Use fullName for subcommands, name for regular commands
  let cmdString = command.fullName || command.name;
  // Add arguments...
  this.ws.send(cmdString + '\n');
}
```

## Testing

A test file `test_command_discovery.html` is provided to verify:

1. **Concurrency Control**: Attempts to start concurrent discoveries are properly rejected
2. **Subcommand Structure**: Hierarchical command structure is correctly maintained
3. **UI Behavior**: Expansion/collapse and visual indicators work correctly

### Running Tests

1. Open `test_command_discovery.html` in a browser
2. Click "Test Concurrent Discovery" to verify lock mechanism
3. Click "Test Subcommand Structure" to verify data model
4. Observe results in the test results panel

## Requirements Validation

This implementation validates the following requirements:

- **Requirement 9.3**: Command discovery concurrency control prevents concurrent scans
- **Requirement 10.3**: Discovery operations are isolated and don't interfere with each other
- **Requirement 15.3**: Recursive subcommand support for hierarchical command structures

## Future Enhancements

Potential improvements for future iterations:

1. **Automatic Subcommand Discovery**: Automatically discover subcommands for all commands during initial scan
2. **Search/Filter**: Add search functionality that works across parent commands and subcommands
3. **Command History**: Track frequently used subcommands
4. **Argument Discovery**: Parse subcommand help to discover required/optional arguments
5. **Command Validation**: Validate command syntax before execution
6. **Batch Discovery**: Discover multiple subcommands in parallel (with proper concurrency control)

## Migration Notes

### From Version 1.0 Cache

The cache structure has been updated from version 1.0 to 2.0. The system handles this gracefully:

- Old caches (v1.0) are still loaded but won't have subcommand data
- Users can rescan to populate subcommands
- No data loss occurs during migration

### Backward Compatibility

The implementation maintains backward compatibility:

- Commands without subcommands work exactly as before
- Existing command execution logic is preserved
- Cache loading handles both old and new formats

## Code Organization

### Frontend Files Modified

- `frontend/js/app.js`: Core command discovery logic
- `frontend/index.html`: UI for hierarchical command display

### Key State Variables

- `discoveryLock`: Boolean flag for concurrency control
- `expandedCommands`: Object tracking which commands are expanded
- `commandDiscoveryInProgress`: Boolean flag for discovery state

### Key Methods

- `scanCommands(force)`: Main discovery entry point with concurrency control
- `discoverSubcommands(command)`: Discover subcommands for a specific command
- `parseSubcommands(helpText, parentCommand)`: Parse subcommand output
- `toggleCommandExpansion(command)`: Toggle command expansion state
- `executeCommand(command)`: Execute command with subcommand support

## Performance Considerations

- **Lazy Loading**: Subcommands are only discovered when needed
- **Caching**: All discovered commands and subcommands are cached
- **Lock Overhead**: Minimal overhead from lock checking (simple boolean flag)
- **UI Responsiveness**: Expansion/collapse is instant for cached subcommands

## Security Considerations

- **Input Validation**: Command names are validated before execution
- **Concurrency Safety**: Lock prevents race conditions in cache updates
- **Error Handling**: All discovery operations have proper error handling and cleanup
