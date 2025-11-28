# Zephyr Shell Command Syntax Reference

## Command Help Syntax

### Getting Help for Top-Level Commands

```bash
uart:~$ help
```

This displays all available top-level commands.

### Getting Help for a Specific Command (CORRECT)

```bash
uart:~$ log --help
```

**✅ Correct:** Use `<command> --help` to get help for a specific command and its subcommands.

### Common Mistake (INCORRECT)

```bash
uart:~$ help log
help: wrong parameter count
help - Prints the help message.
```

**❌ Incorrect:** `help <command>` does NOT work in Zephyr shell.

## Examples

### Example 1: Log Command

```bash
# Get help for log command
uart:~$ log --help

log - Logging commands
Subcommands:
  backend   : Enable backend logging
  disable   : Disable logging
  enable    : Enable logging
```

### Example 2: Device Command

```bash
# Get help for device command
uart:~$ device --help

device - Device management
Subcommands:
  list      : List all devices
  info      : Show device information
  reset     : Reset the device
```

### Example 3: Kernel Command

```bash
# Get help for kernel command
uart:~$ kernel --help

kernel - Kernel commands
Subcommands:
  version   : Show kernel version
  threads   : List kernel threads
  stacks    : Show stack information
```

## Subcommand Execution

### Executing a Subcommand

```bash
# Execute a subcommand
uart:~$ log backend

# Execute with arguments
uart:~$ device info <device_id>
```

### Getting Help for a Subcommand

Some commands support nested help:

```bash
# Get help for a subcommand
uart:~$ log backend --help
```

## Implementation in ZDM

### How ZDM Discovers Subcommands

1. **Initial Scan:**
   ```javascript
   // Send 'help' to get top-level commands
   this.ws.send('help\n');
   ```

2. **Subcommand Discovery:**
   ```javascript
   // Send '<command> --help' to get subcommands
   this.ws.send(`${command.name} --help\n`);
   ```

3. **Parsing:**
   - Looks for "Subcommands:" section
   - Parses lines with format: `subcommand : Description`
   - Creates hierarchical structure

### Example Discovery Flow

```
User clicks "Check for subcommands" on 'log' command
  ↓
ZDM sends: "log --help\n"
  ↓
Device responds with help text
  ↓
ZDM parses subcommands (backend, disable, enable)
  ↓
Arrow (►) appears next to 'log' command
  ↓
User clicks arrow to expand
  ↓
Subcommands displayed indented below
```

## Common Zephyr Shell Commands with Subcommands

### Logging Commands
```bash
log --help
├─ backend
├─ disable
├─ enable
└─ list_backends
```

### Device Commands
```bash
device --help
├─ list
├─ info
└─ reset
```

### Kernel Commands
```bash
kernel --help
├─ version
├─ threads
├─ stacks
└─ uptime
```

### I2C Commands
```bash
i2c --help
├─ scan
├─ read
└─ write
```

### GPIO Commands
```bash
gpio --help
├─ conf
├─ get
├─ set
└─ blink
```

## Troubleshooting

### Issue: "help: wrong parameter count"

**Problem:**
```bash
uart:~$ help log
help: wrong parameter count
```

**Solution:**
Use `--help` flag instead:
```bash
uart:~$ log --help
```

### Issue: Command not found

**Problem:**
```bash
uart:~$ mycommand --help
mycommand: command not found
```

**Solution:**
- Check that the command exists: `help`
- Verify spelling
- Ensure the command is available in your Zephyr build

### Issue: No subcommands shown

**Problem:**
Command executes but shows no subcommands.

**Possible Causes:**
1. Command has no subcommands
2. Help text format is different
3. Command doesn't support `--help` flag

**Solution:**
Check the command's documentation or source code.

## Parser Compatibility

### Supported Help Formats

The ZDM parser supports multiple help text formats:

**Format 1: With colon**
```
Subcommands:
  backend   : Enable backend logging
  disable   : Disable logging
```

**Format 2: Without colon (spaces)**
```
Subcommands:
  backend     Enable backend logging
  disable     Disable logging
```

**Format 3: Options style**
```
Options:
  -b, --backend    Enable backend logging
  -d, --disable    Disable logging
```

### Parser Features

- Removes ANSI escape codes
- Handles multi-line descriptions
- Supports various indentation styles
- Detects section markers (Subcommands:, Options:, etc.)

## Best Practices

### For Users

1. **Always use `--help` flag:**
   ```bash
   <command> --help
   ```

2. **Check for subcommands in ZDM:**
   - Click "Check for subcommands" button
   - Or use the demo to see examples

3. **Execute full command path:**
   ```bash
   log backend  # Not just 'backend'
   ```

### For Developers

1. **Implement `--help` for all commands:**
   ```c
   SHELL_CMD_REGISTER(mycommand, NULL, "My command", cmd_mycommand);
   ```

2. **Document subcommands clearly:**
   ```c
   SHELL_SUBCMD_SET_CREATE(sub_mycommand,
       SHELL_CMD(subcommand1, NULL, "Description", cmd_sub1),
       SHELL_CMD(subcommand2, NULL, "Description", cmd_sub2),
       SHELL_SUBCMD_SET_END
   );
   ```

3. **Follow consistent format:**
   - Use clear descriptions
   - Keep subcommand names short
   - Use consistent naming conventions

## References

- [Zephyr Shell Documentation](https://docs.zephyrproject.org/latest/services/shell/index.html)
- [Zephyr Shell API](https://docs.zephyrproject.org/latest/doxygen/html/group__shell.html)
- ZDM Command Discovery Documentation: `COMMAND_DISCOVERY.md`

## Quick Reference Card

```
┌─────────────────────────────────────────────────┐
│ Zephyr Shell Quick Reference                    │
├─────────────────────────────────────────────────┤
│                                                  │
│ List all commands:                               │
│   help                                           │
│                                                  │
│ Get help for a command:                          │
│   <command> --help                               │
│                                                  │
│ Execute a subcommand:                            │
│   <command> <subcommand> [args]                  │
│                                                  │
│ Examples:                                        │
│   log --help                                     │
│   log backend                                    │
│   device list                                    │
│   kernel version                                 │
│                                                  │
└─────────────────────────────────────────────────┘
```
