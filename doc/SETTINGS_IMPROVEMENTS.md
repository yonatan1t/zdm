# Settings Improvements

## Overview

Two quality-of-life improvements have been added to the settings sidebar:
1. **Persistent Manual Port** - Saves your custom port name to localStorage
2. **Enter Key to Connect** - Press Enter anywhere in settings to connect

## Features

### 1. Persistent Manual Port

**Problem:** Every time you opened the app, you had to re-enter your custom port (e.g., `/dev/pts/12`).

**Solution:** The manual port is now saved to localStorage and automatically restored on next visit.

#### How It Works

**First Time:**
```
1. User enters "/dev/pts/12" in manual port field
2. User clicks "Connect"
3. Port is saved to localStorage
```

**Next Time:**
```
1. User opens app
2. Manual port field shows "/dev/pts/12" automatically
3. User just clicks "Connect" (or presses Enter!)
```

#### Implementation

**Save on Connect:**
```javascript
// In saveSettings()
if (this.manualPort) {
    localStorage.setItem('zdm_manual_port', this.manualPort);
    console.log('Saved manual port to localStorage:', this.manualPort);
}
```

**Load on Init:**
```javascript
// In init()
const savedManualPort = localStorage.getItem('zdm_manual_port');
if (savedManualPort) {
    this.manualPort = savedManualPort;
    console.log('Loaded saved manual port:', savedManualPort);
}
```

#### Storage Key

- **Key:** `zdm_manual_port`
- **Value:** String (e.g., `/dev/pts/12`)
- **Location:** Browser localStorage

### 2. Enter Key to Connect

**Problem:** Had to click the "Connect" button with mouse.

**Solution:** Press Enter key anywhere in the settings sidebar to connect.

#### Where It Works

**Enter key triggers connection from:**
- ✅ Manual port input field
- ✅ Port dropdown select
- ✅ Baud rate select
- ✅ **Anywhere when settings panel is open** (global listener)

#### Implementation

**Global Window Listener:**
```html
<div x-show="showSettings" 
     @keydown.enter.window="if(showSettings) saveSettings()">
```

This uses Alpine.js's `.window` modifier to listen for Enter key globally when the settings panel is open.

**On Input Fields (for immediate feedback):**
```html
<input type="text" 
    x-model="manualPort"
    @keydown.enter="saveSettings()"
    placeholder="/dev/pts/12">
```

**On Select Fields (for immediate feedback):**
```html
<select x-model="selectedPort"
    @keydown.enter="saveSettings()">
```

#### User Experience

**Workflow:**
```
1. Open Settings
2. Type port name: "/dev/pts/12"
3. Press Enter ⏎
4. Connected! ✅
```

**Fast Workflow:**
```
1. Open Settings (port already filled from last time)
2. Press Enter ⏎
3. Connected! ✅
```

## Usage Examples

### Example 1: First Time Setup

```
1. Click "Settings"
2. Enter manual port: "/dev/pts/12"
3. Press Enter
4. Status: "Connected to /dev/pts/12"
5. Next time: Port is pre-filled!
```

### Example 2: Quick Reconnect

```
1. Click "Settings"
2. Manual port shows: "/dev/pts/12" (from last time)
3. Press Enter
4. Connected!
```

### Example 3: Change Port

```
1. Click "Settings"
2. Manual port shows: "/dev/pts/12"
3. Change to: "/dev/pts/13"
4. Press Enter
5. Connected to new port
6. New port is now saved
```

### Example 4: Use Dropdown

```
1. Click "Settings"
2. Select port from dropdown
3. Press Enter
4. Connected!
```

## Technical Details

### localStorage Structure

```javascript
{
    "zdm_manual_port": "/dev/pts/12"
}
```

### Event Handling

**Alpine.js Event Binding:**
```html
@keydown.enter="saveSettings()"
```

This binds the Enter key to the `saveSettings()` method.

### Validation

The existing validation still applies:
- Port must be selected or entered
- Cannot connect if already connecting
- Shows error if port is empty

## Benefits

### For Users

1. **Faster workflow** - No need to re-enter port every time
2. **Keyboard friendly** - Press Enter instead of clicking
3. **Less friction** - Remembered settings reduce setup time
4. **Better UX** - Feels more responsive and polished

### For Developers

1. **Simple implementation** - Just localStorage and event binding
2. **No breaking changes** - Existing functionality unchanged
3. **Progressive enhancement** - Works without saved port too
4. **Easy to extend** - Can save more settings later

## Future Enhancements

### Possible Additions

1. **Save baud rate** - Remember last used baud rate
2. **Port history** - Dropdown of recently used ports
3. **Multiple profiles** - Save different connection profiles
4. **Auto-connect** - Option to auto-connect on startup
5. **Keyboard shortcuts** - Ctrl+Enter to connect from anywhere

### Example: Save Baud Rate

```javascript
// Save
localStorage.setItem('zdm_baud_rate', this.baudRate);

// Load
const savedBaudRate = localStorage.getItem('zdm_baud_rate');
if (savedBaudRate) {
    this.baudRate = savedBaudRate;
}
```

## Troubleshooting

### Issue: Port Not Saved

**Check:**
1. Browser allows localStorage
2. No private/incognito mode
3. Check console for errors

**Debug:**
```javascript
// In browser console
localStorage.getItem('zdm_manual_port')
```

### Issue: Enter Key Not Working

**Check:**
1. Focus is in the settings sidebar
2. Not disabled (connecting state)
3. Port is selected/entered

**Debug:**
```javascript
// Check if event is firing
@keydown.enter="console.log('Enter pressed'); saveSettings()"
```

### Issue: Wrong Port Loaded

**Clear saved port:**
```javascript
// In browser console
localStorage.removeItem('zdm_manual_port')
```

## Testing

### Test Saved Port

1. **Save a port:**
   ```
   - Enter "/dev/pts/12"
   - Connect
   - Disconnect
   ```

2. **Refresh page:**
   ```
   - Open Settings
   - Verify "/dev/pts/12" is pre-filled
   ```

3. **Clear and verify:**
   ```javascript
   localStorage.removeItem('zdm_manual_port')
   // Refresh page
   // Manual port should be empty
   ```

### Test Enter Key

1. **From manual port input:**
   ```
   - Click in manual port field
   - Type "/dev/pts/12"
   - Press Enter
   - Should connect
   ```

2. **From dropdown:**
   ```
   - Click port dropdown
   - Select a port
   - Press Enter
   - Should connect
   ```

3. **From baud rate:**
   ```
   - Click baud rate dropdown
   - Select a rate
   - Press Enter
   - Should connect
   ```

## Code Changes

### Files Modified

1. **`frontend/js/app.js`**
   - Added localStorage save in `saveSettings()`
   - Added localStorage load in `init()`

2. **`frontend/index.html`**
   - Added `@keydown.enter` to sidebar
   - Added `@keydown.enter` to manual port input
   - Added `@keydown.enter` to port select
   - Added `@keydown.enter` to baud rate select

### Lines Added

- JavaScript: ~10 lines
- HTML: ~4 attributes

## Summary

Two simple but powerful improvements:

✅ **Persistent Manual Port**
- Saves to localStorage
- Auto-loads on startup
- No more re-typing

✅ **Enter Key to Connect**
- Works from any field
- Works from sidebar
- Faster workflow

Both features work together for a smooth experience:
1. Port is pre-filled from last time
2. Press Enter to connect
3. Done! 🚀
