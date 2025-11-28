# Troubleshooting Guide - Subcommand Expand/Collapse Buttons

## Issue: Expand/Collapse Button Not Showing

### Why This Happens

The expand/collapse button (arrow ►) only appears when a command has one of these conditions:
1. `cmd.hasSubcommands === true` 
2. `cmd.subcommands` is defined and not null

When commands are initially discovered from the `help` command, they are created with:
```javascript
{
    id: 'log',
    name: 'log',
    description: 'Logging commands',
    hasSubcommands: null,  // ← null means "unknown"
    subcommands: null      // ← no subcommands discovered yet
}
```

Since both are `null`, the button won't show until we know for sure the command has subcommands.

### Solutions

#### Solution 1: Use the "Check for subcommands" Button

I've added a small button under each command that says "Check for subcommands". Click this to discover if a command has subcommands.

**Steps:**
1. Connect to your Zephyr device
2. Scan commands
3. Look for the blue "Check for subcommands" link under each command
4. Click it to discover subcommands
5. If subcommands are found, the expand arrow will appear

#### Solution 2: View the Demo

Open `demo_subcommands.html` in your browser to see how the expand/collapse functionality works with pre-populated data.

**What you'll see:**
- Commands with subcommands have an arrow (►)
- Click the arrow to expand (it rotates to ▼)
- Subcommands appear indented below
- Click again to collapse

#### Solution 3: Manually Set hasSubcommands

If you know certain commands have subcommands, you can modify the parser to set `hasSubcommands: true` for specific commands:

```javascript
// In parseHelpOutput(), after creating the command object:
commands.push({
    id: cmdName,
    name: cmdName,
    description: cmdDesc,
    usage: '',
    helpText: '',
    args: [],
    hasSubcommands: ['log', 'device', 'kernel'].includes(cmdName) ? true : null,
    subcommands: null
});
```

#### Solution 4: Auto-Discover All Subcommands

Modify `scanCommands()` to automatically discover subcommands for all commands:

```javascript
async scanCommands(force = false) {
    // ... existing code ...
    
    // After initial scan, discover subcommands for all commands
    if (this.commands.length > 0) {
        this.showStatus('Discovering subcommands...', 'info');
        
        for (const cmd of this.commands) {
            try {
                await this.discoverSubcommands(cmd);
            } catch (error) {
                console.log(`No subcommands for ${cmd.name}`);
            }
        }
    }
}
```

**Note:** This will make the initial scan slower but will populate all subcommands immediately.

### Testing the Implementation

#### Test 1: Visual Demo
```bash
# Open the demo file
open demo_subcommands.html
# or
firefox demo_subcommands.html
```

You should see:
- ✅ Arrow buttons next to commands with subcommands
- ✅ Arrows rotate when clicked
- ✅ Subcommands appear/disappear on click
- ✅ Proper indentation and styling

#### Test 2: With Real Device

1. **Connect to Device:**
   - Start backend: `cd backend && python -m app.main`
   - Open frontend: `http://localhost:8000`
   - Connect to your Zephyr device

2. **Scan Commands:**
   - Click "Scan Commands"
   - Wait for scan to complete

3. **Check for Subcommands:**
   - Look for "Check for subcommands" button under commands
   - Click it for commands you think have subcommands (like `log`, `device`, `kernel`)
   - If subcommands exist, the arrow will appear

4. **Expand/Collapse:**
   - Click the arrow to expand
   - Verify subcommands appear
   - Click again to collapse

#### Test 3: Cache Persistence

1. Discover subcommands for a command
2. Refresh the page
3. Click "Commands" button (loads from cache)
4. Verify the arrow appears immediately (subcommands are cached)

### Debugging

#### Check Console Logs

Open browser console (F12) and look for:

```
Loaded X commands from cache
  Y commands have subcommands
```

If you see "0 commands have subcommands", then no subcommands have been discovered yet.

#### Check Cache

In browser console:
```javascript
JSON.parse(localStorage.getItem('zephyr_commands_cache'))
```

Look for commands with `subcommands` array populated.

#### Check Command Structure

In browser console:
```javascript
// Get Alpine.js data
$el.__x.$data.commands
```

Check if any commands have:
- `hasSubcommands: true`
- `subcommands: [...]` with items

### Common Issues

#### Issue: Button appears but nothing happens when clicked

**Cause:** `toggleCommandExpansion()` not working

**Fix:** Check console for errors. Verify the method exists in app.js.

#### Issue: Subcommands discovered but not showing

**Cause:** `expandedCommands` state not updating

**Fix:** 
1. Check that `expandedCommands` is initialized as `{}`
2. Verify Alpine.js is loaded
3. Check for JavaScript errors in console

#### Issue: Arrow doesn't rotate

**Cause:** CSS transform not applying

**Fix:** Verify Tailwind CSS is loaded. The class `:class="expandedCommands[cmd.id] ? 'rotate-90' : ''"` should add `rotate-90` when expanded.

#### Issue: "Check for subcommands" button always shows

**Cause:** Commands never get `hasSubcommands` set to `false`

**Fix:** This is expected behavior. The button will hide once subcommands are discovered (or confirmed to not exist).

### Expected Behavior

#### Initial State (After Scan)
```
┌─────────────────────────────────┐
│ log                             │
│ Logging commands                │
│ Check for subcommands           │  ← Blue link
└─────────────────────────────────┘
```

#### After Discovering Subcommands
```
┌─────────────────────────────────┐
│ ► log          [has subcommands]│  ← Arrow appears
│   Logging commands              │
└─────────────────────────────────┘
```

#### After Expanding
```
┌─────────────────────────────────┐
│ ▼ log          [has subcommands]│  ← Arrow rotated
│   Logging commands              │
│   ├─ backend                    │  ← Subcommands
│   │  Enable backend logging     │
│   ├─ disable                    │
│   │  Disable logging            │
└─────────────────────────────────┘
```

### Quick Fixes

#### Quick Fix 1: Force Show Arrows for Testing

Temporarily modify the HTML to always show arrows:

```html
<!-- Change this: -->
<button 
    x-show="cmd.hasSubcommands || cmd.subcommands"
    ...>

<!-- To this: -->
<button 
    x-show="true"
    ...>
```

This will show arrows for all commands (for testing only).

#### Quick Fix 2: Pre-populate Test Data

Add test subcommands to the cache:

```javascript
// In browser console
const testCache = {
    version: '2.0',
    lastScanned: new Date().toISOString(),
    commands: [
        {
            id: 'log',
            name: 'log',
            description: 'Logging commands',
            hasSubcommands: true,
            subcommands: [
                {
                    id: 'log_backend',
                    name: 'backend',
                    fullName: 'log backend',
                    description: 'Enable backend logging',
                    parent: 'log'
                }
            ]
        }
    ]
};
localStorage.setItem('zephyr_commands_cache', JSON.stringify(testCache));
// Refresh page
```

### Getting Help

If you're still having issues:

1. **Check the demo:** Open `demo_subcommands.html` - if this works, the code is correct
2. **Check console:** Look for JavaScript errors
3. **Check cache:** Verify commands are being saved correctly
4. **Check Alpine.js:** Verify Alpine.js is loaded (check for `$el` in console)
5. **Check Tailwind:** Verify Tailwind CSS is loaded (check if other styles work)

### Summary

The expand/collapse buttons work correctly but only appear when:
1. Subcommands have been discovered, OR
2. `hasSubcommands` is explicitly set to `true`

Use the "Check for subcommands" button to discover subcommands, or open `demo_subcommands.html` to see the UI working with pre-populated data.
