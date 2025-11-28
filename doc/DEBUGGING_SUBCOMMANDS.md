# Debugging Subcommand Discovery

## What to Check in Browser Console

When you click "Check for subcommands", you should see detailed logs in the browser console (F12).

### Expected Console Output

#### For a command WITH subcommands (e.g., `log`):

```
Discovering subcommands for: log
Subcommand discovery check: data length = 0, elapsed = 0ms
[WebSocket message received]
Subcommand discovery check: data length = 150, elapsed = 500ms
Data stable, completing discovery
Discovery complete. Collected 150 chars
=== PARSING SUBCOMMANDS FOR log ===
Raw help text: log --help\nlog - Logging commands\nSubcommands:\n  backend : Enable backend...
Clean text: log --helplog - Logging commandsSubcommands:  backend : Enable backend...
Number of lines: 5
All lines:
  [0] "log --help"
  [1] "log - Logging commands"
  [2] "Subcommands:"
  [3] "backend : Enable backend logging"
  [4] "disable : Disable logging"
✓ Found subcommand section at line 2: "Subcommands:"
  ✓ [backend] "Enable backend logging"
  ✓ [disable] "Disable logging"
=== RESULT: 2 subcommands found ===
Saved 10 commands to cache
```

#### For a command WITHOUT subcommands (e.g., `bypass`):

```
Discovering subcommands for: bypass
Subcommand discovery check: data length = 0, elapsed = 0ms
[WebSocket message received]
Subcommand discovery check: data length = 56, elapsed = 500ms
Data stable, completing discovery
Discovery complete. Collected 56 chars
=== PARSING SUBCOMMANDS FOR bypass ===
Raw help text: bypass --helpbypass - Bypass shell[1;32muart:
Clean text: bypass --helpbypass - Bypass shelluart:
Number of lines: 2
All lines:
  [0] "bypass --helpbypass - Bypass shell"
  [1] "uart:"
✓ Simple help format detected (no subcommands)
=== RESULT: 0 subcommands found ===
```

## Common Issues and Solutions

### Issue 1: "Timeout reached" Error

**Symptoms:**
```
✗ Timeout reached. Final data length: 56
Error discovering subcommands: Error: Command discovery timeout
```

**Cause:** The old code was rejecting on timeout.

**Solution:** ✅ FIXED - Now resolves with collected data even on timeout.

### Issue 2: No Subcommands Found (But They Exist)

**Symptoms:**
```
=== RESULT: 0 subcommands found ===
```

**Debugging Steps:**

1. **Check the raw help text:**
   ```javascript
   // Look in console for:
   Raw help text: ...
   ```

2. **Check if "Subcommands:" appears:**
   - If YES: Parser should find them
   - If NO: Command may not have subcommands, or uses different format

3. **Check line parsing:**
   ```javascript
   // Look for lines like:
   All lines:
     [0] "command --help"
     [1] "command - Description"
     [2] "Subcommands:"  ← Should trigger section detection
     [3] "subcmd : Description"  ← Should be parsed
   ```

4. **Common format variations:**
   ```
   Format 1 (with colon):
     backend : Enable backend logging
   
   Format 2 (with spaces):
     backend     Enable backend logging
   
   Format 3 (options style):
     -b, --backend    Enable backend logging
   ```

### Issue 3: Arrow Doesn't Appear

**Symptoms:**
- Subcommands discovered successfully
- But arrow (►) doesn't show

**Debugging:**

1. **Check if `hasSubcommands` is set:**
   ```javascript
   // In console:
   $el.__x.$data.commands.find(c => c.name === 'log')
   // Should show: hasSubcommands: true
   ```

2. **Check if `subcommands` array exists:**
   ```javascript
   // Should show: subcommands: [{...}, {...}]
   ```

3. **Force refresh:**
   - Close and reopen the Commands sidebar
   - Or refresh the page and load from cache

### Issue 4: Data Not Being Collected

**Symptoms:**
```
Subcommand discovery check: data length = 0, elapsed = 500ms
Subcommand discovery check: data length = 0, elapsed = 1000ms
```

**Cause:** WebSocket messages not being collected during discovery.

**Check:**
1. Is `commandDiscoveryInProgress` set to `true`?
2. Are WebSocket messages being received?
3. Check the WebSocket `onmessage` handler:
   ```javascript
   if (this.commandDiscoveryInProgress) {
       this.discoveryCollectedData += event.data;
   }
   ```

## Manual Testing

### Test 1: Simple Command (No Subcommands)

```bash
# In terminal
bypass --help
```

**Expected output:**
```
bypass - Bypass shell
```

**Expected result in ZDM:**
- Console shows "Simple help format detected"
- No arrow appears
- Status: "No subcommands found for bypass"

### Test 2: Command with Subcommands

```bash
# In terminal (if available)
log --help
```

**Expected output:**
```
log - Logging commands
Subcommands:
  backend : Enable backend logging
  disable : Disable logging
  enable  : Enable logging
```

**Expected result in ZDM:**
- Console shows "Found subcommand section"
- Console shows "✓ [backend]", "✓ [disable]", etc.
- Arrow (►) appears
- Status: "Found 3 subcommands for log"

## Debugging Checklist

When subcommand discovery isn't working:

- [ ] Open browser console (F12)
- [ ] Click "Check for subcommands"
- [ ] Check for "Discovering subcommands for: X" log
- [ ] Check "Subcommand discovery check" logs
- [ ] Check "Discovery complete. Collected X chars" log
- [ ] Check "=== PARSING SUBCOMMANDS ===" section
- [ ] Check "Raw help text:" - does it contain the help output?
- [ ] Check "All lines:" - are lines being split correctly?
- [ ] Check for "✓ Found subcommand section" or "Simple help format detected"
- [ ] Check "=== RESULT: X subcommands found ==="
- [ ] If 0 found but should have subcommands, check the format

## Advanced Debugging

### Enable Verbose Logging

Add this to see every WebSocket message during discovery:

```javascript
// In app.js, in the ws.onmessage handler:
if (this.commandDiscoveryInProgress) {
    console.log('Discovery collecting:', event.data);
    this.discoveryCollectedData += event.data;
}
```

### Inspect Discovery State

```javascript
// In browser console during discovery:
$el.__x.$data.commandDiscoveryInProgress  // Should be true
$el.__x.$data.discoveryLock              // Should be true
$el.__x.$data.discoveryCollectedData     // Should contain help text
```

### Test Parser Directly

```javascript
// In browser console:
const testHelp = `log --help
log - Logging commands
Subcommands:
  backend : Enable backend logging
  disable : Disable logging`;

const app = $el.__x.$data;
const result = app.parseSubcommands(testHelp, 'log');
console.log('Parsed:', result);
```

## Getting Help

If you're still having issues:

1. **Copy console logs** - Include the full "=== PARSING SUBCOMMANDS ===" section
2. **Copy help output** - Run `<command> --help` in terminal and copy output
3. **Check format** - Does the help output match expected formats?
4. **Try demo** - Open `demo_subcommands.html` to verify UI works

## Summary of Fixes

### Fix 1: Timeout Handling
- **Before:** Rejected on timeout
- **After:** Resolves with collected data

### Fix 2: Completion Detection
- **Before:** Looked for "Available commands:"
- **After:** Waits for data to stabilize (1 second no change)

### Fix 3: Simple Format Detection
- **Before:** Tried to parse everything
- **After:** Detects simple format (no subcommands) and returns empty array

### Fix 4: Better Logging
- **Before:** Limited logging
- **After:** Logs raw text, clean text, all lines, and parsing results
