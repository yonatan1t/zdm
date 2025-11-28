# Automatic Subcommand Discovery

## Overview

The command discovery system now automatically discovers subcommands for all commands during the initial scan, with visual progress indicators.

## Features

### 1. Automatic Discovery

When you click "Scan Commands", the system:
1. Discovers all top-level commands
2. Automatically checks each command for subcommands
3. Shows progress with spinners and progress bar
4. Caches all results for instant loading next time

### 2. Visual Indicators

#### Per-Command Spinner
Each command shows a spinner while its subcommands are being discovered:

```
┌─────────────────────────────────────┐
│ log  🔄                             │  ← Spinner while discovering
│ Commands for controlling logger     │
└─────────────────────────────────────┘

↓ After discovery ↓

┌─────────────────────────────────────┐
│ ► log  [has subcommands]            │  ← Arrow and badge appear
│   Commands for controlling logger   │
└─────────────────────────────────────┘
```

#### Overall Progress Bar
At the top of the sidebar, a progress bar shows overall discovery progress:

```
┌─────────────────────────────────────┐
│ Commands                            │
│ 🔄 Discovering subcommands: 5/20    │
│ ████████░░░░░░░░░░░░░░░░░░░░ 25%   │
└─────────────────────────────────────┘
```

### 3. Smart Caching

- **First scan:** Discovers everything (takes ~20-40 seconds for 20 commands)
- **Subsequent loads:** Instant (loads from cache)
- **Force rescan:** Click "⟳ Rescan Commands" to rediscover

## Implementation

### State Variables

```javascript
{
    discoveringSubcommands: {},  // Track which commands are discovering
    discoveryProgress: {         // Track overall progress
        current: 0,
        total: 0
    }
}
```

### Discovery Flow

```
User clicks "Scan Commands"
  ↓
Discover top-level commands (help)
  ↓
For each command:
  ├─ Set discoveringSubcommands[cmd.id] = true
  ├─ Show spinner next to command
  ├─ Send "<cmd> --help"
  ├─ Parse subcommands
  ├─ Update command with subcommands
  ├─ Set discoveringSubcommands[cmd.id] = false
  ├─ Show arrow if subcommands found
  ├─ Update progress (current++)
  └─ Small delay (100ms) before next command
  ↓
Save all to cache
  ↓
Show "All commands scanned!"
```

### Key Methods

#### `discoverAllSubcommands()`
Automatically discovers subcommands for all commands:

```javascript
async discoverAllSubcommands() {
    this.discoveryProgress.total = this.commands.length;
    this.discoveryProgress.current = 0;
    
    for (let i = 0; i < this.commands.length; i++) {
        const cmd = this.commands[i];
        
        // Skip if already has subcommands
        if (cmd.subcommands && cmd.subcommands.length > 0) {
            this.discoveryProgress.current++;
            continue;
        }
        
        // Mark as discovering
        this.discoveringSubcommands[cmd.id] = true;
        
        // Discover subcommands
        await this.discoverSubcommandsInternal(cmd);
        
        // Mark as done
        this.discoveringSubcommands[cmd.id] = false;
        this.discoveryProgress.current++;
        
        // Small delay between commands
        await new Promise(resolve => setTimeout(resolve, 100));
    }
}
```

#### `discoverSubcommandsInternal(command)`
Internal method for discovering subcommands without lock checking:

```javascript
async discoverSubcommandsInternal(command) {
    this.commandDiscoveryInProgress = true;
    this.discoveryCollectedData = '';

    // Send '<command> --help'
    this.sendDiscoveryCommand(`${command.name} --help\n`);

    // Wait for response
    await this.waitForSubcommandDiscovery(2000);

    // Parse subcommands
    const subcommands = this.parseSubcommands(
        this.discoveryCollectedData, 
        command.name
    );

    // Update command
    if (subcommands.length > 0) {
        command.subcommands = subcommands;
        command.hasSubcommands = true;
    } else {
        command.hasSubcommands = false;
    }

    // Save to cache
    this.saveCachedCommands(this.commands);
}
```

## User Experience

### First Time Scan

```
1. User clicks "Scan Commands"
   Status: "Scanning commands..."

2. Top-level commands appear
   Status: "Commands scanned successfully! Discovering subcommands..."

3. Progress bar appears at top
   "🔄 Discovering subcommands: 0/20"

4. Each command shows spinner as it's checked
   log  🔄
   device  🔄
   kernel  (waiting)

5. Spinners disappear, arrows appear for commands with subcommands
   ► log  [has subcommands]
   ► device  [has subcommands]
   kernel  (no subcommands)

6. Progress bar fills up
   "🔄 Discovering subcommands: 20/20"

7. Progress bar disappears
   Status: "All commands scanned!"
```

### Subsequent Loads

```
1. User clicks "Commands"
   Status: "Loaded cached commands from [timestamp]"

2. All commands appear instantly with arrows
   ► log  [has subcommands]
   ► device  [has subcommands]
   kernel

3. No spinners, no progress bar (instant)
```

## Performance

### Timing

- **Top-level scan:** ~2-3 seconds
- **Per-command subcommand discovery:** ~1-2 seconds
- **Total for 20 commands:** ~20-40 seconds
- **Cache load:** Instant

### Optimization

1. **100ms delay between commands** - Prevents overwhelming the shell
2. **Skip already discovered** - Doesn't re-check cached subcommands
3. **Skip known empty** - Doesn't re-check commands with `hasSubcommands: false`
4. **Parallel UI updates** - Spinners update in real-time

## Configuration

### Adjust Discovery Timeout

```javascript
// In discoverSubcommandsInternal()
await this.waitForSubcommandDiscovery(2000); // 2 seconds

// Increase for slower shells:
await this.waitForSubcommandDiscovery(5000); // 5 seconds
```

### Adjust Delay Between Commands

```javascript
// In discoverAllSubcommands()
await new Promise(resolve => setTimeout(resolve, 100)); // 100ms

// Increase for slower shells:
await new Promise(resolve => setTimeout(resolve, 500)); // 500ms
```

### Disable Automatic Discovery

To disable automatic discovery and go back to manual:

```javascript
// In scanCommands(), comment out this line:
// await this.discoverAllSubcommands();
```

## Visual Design

### Spinner Icon

```html
<svg class="animate-spin h-4 w-4 text-purple-600">
    <circle class="opacity-25" cx="12" cy="12" r="10" 
            stroke="currentColor" stroke-width="4"></circle>
    <path class="opacity-75" fill="currentColor" 
          d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
</svg>
```

### Progress Bar

```html
<div class="w-full bg-gray-200 rounded-full h-1.5">
    <div class="bg-purple-600 h-1.5 rounded-full transition-all" 
         :style="`width: ${progress}%`"></div>
</div>
```

## Troubleshooting

### Issue: Discovery Takes Too Long

**Solution:**
1. Increase timeout: `waitForSubcommandDiscovery(5000)`
2. Increase delay: `setTimeout(resolve, 500)`
3. Check shell responsiveness

### Issue: Some Commands Not Discovered

**Solution:**
1. Check browser console for errors
2. Verify shell is responding to `--help` commands
3. Try manual discovery: Click "Check for subcommands"

### Issue: Progress Bar Stuck

**Solution:**
1. Check if discovery is actually running (console logs)
2. Refresh page and try again
3. Check for JavaScript errors in console

### Issue: Spinners Don't Disappear

**Solution:**
1. Check that `discoveringSubcommands[cmd.id]` is being set to `false`
2. Check for errors in `discoverSubcommandsInternal()`
3. Refresh page

## Testing

### Test Automatic Discovery

1. **Clear cache:**
   ```javascript
   localStorage.removeItem('zephyr_commands_cache');
   ```

2. **Connect to Zephyr shell:**
   ```bash
   ~/zephyrproject/apps/shell_module/build/zephyr/zephyr.exe
   ```

3. **Scan commands:**
   - Click "Scan Commands"
   - Watch spinners appear next to each command
   - Watch progress bar fill up
   - Verify arrows appear for commands with subcommands

4. **Test cache:**
   - Refresh page
   - Click "Commands"
   - Verify instant load with no spinners

### Expected Results

**Commands with subcommands:**
- `log` - Should show arrow
- `device` - Should show arrow
- `kernel` - Should show arrow
- `devmem` - Should show arrow

**Commands without subcommands:**
- `bypass` - No arrow
- `clear` - No arrow
- `version` - No arrow

## Benefits

### For Users

1. **No manual work** - Everything discovered automatically
2. **Visual feedback** - See progress in real-time
3. **Fast subsequent loads** - Instant from cache
4. **Complete information** - All subcommands discovered upfront

### For Developers

1. **Better UX** - Users don't need to click "Check for subcommands"
2. **Complete data** - All command information available immediately
3. **Cached results** - Reduces shell queries on subsequent loads
4. **Progress tracking** - Easy to see what's happening

## Future Enhancements

1. **Parallel discovery** - Discover multiple commands simultaneously
2. **Smart ordering** - Discover frequently used commands first
3. **Background discovery** - Discover while user browses other commands
4. **Incremental updates** - Update cache as discoveries complete
5. **Cancel button** - Allow user to cancel discovery

## Summary

Automatic subcommand discovery provides a seamless experience:
- ✅ Discovers all subcommands automatically
- ✅ Shows per-command spinners
- ✅ Shows overall progress bar
- ✅ Caches results for instant subsequent loads
- ✅ No manual "Check for subcommands" needed
- ✅ Complete command information upfront
