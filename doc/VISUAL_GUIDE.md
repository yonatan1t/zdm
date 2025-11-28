# Visual Guide - Command Discovery with Subcommands

## What You Should See

### Step 1: Initial Command List (After Scanning)

After clicking "Scan Commands", you'll see a list like this:

```
┌────────────────────────────────────────┐
│ Commands                          [X]  │
├────────────────────────────────────────┤
│                                        │
│  ┌──────────────────────────────────┐ │
│  │ log                              │ │
│  │ Logging commands                 │ │
│  │ Check for subcommands            │ │ ← Click this
│  └──────────────────────────────────┘ │
│                                        │
│  ┌──────────────────────────────────┐ │
│  │ device                           │ │
│  │ Device management                │ │
│  │ Check for subcommands            │ │
│  └──────────────────────────────────┘ │
│                                        │
│  ┌──────────────────────────────────┐ │
│  │ help                             │ │
│  │ Show help information            │ │
│  └──────────────────────────────────┘ │
│                                        │
└────────────────────────────────────────┘
```

**Note:** The "Check for subcommands" link appears for commands that haven't been checked yet.

### Step 2: After Discovering Subcommands

After clicking "Check for subcommands" on the `log` command:

```
┌────────────────────────────────────────┐
│ Commands                          [X]  │
├────────────────────────────────────────┤
│                                        │
│  ┌──────────────────────────────────┐ │
│  │ ► log    [has subcommands]       │ │ ← Arrow appears!
│  │   Logging commands               │ │
│  └──────────────────────────────────┘ │
│                                        │
│  ┌──────────────────────────────────┐ │
│  │ device                           │ │
│  │ Device management                │ │
│  │ Check for subcommands            │ │
│  └──────────────────────────────────┘ │
│                                        │
└────────────────────────────────────────┘
```

**Changes:**
- ✅ Arrow (►) appears on the left
- ✅ Purple badge "has subcommands" appears
- ✅ "Check for subcommands" link disappears

### Step 3: Expanding to Show Subcommands

Click the arrow (►) to expand:

```
┌────────────────────────────────────────┐
│ Commands                          [X]  │
├────────────────────────────────────────┤
│                                        │
│  ┌──────────────────────────────────┐ │
│  │ ▼ log    [has subcommands]       │ │ ← Arrow rotated
│  │   Logging commands               │ │
│  │                                  │ │
│  │   ┌────────────────────────────┐ │ │
│  │   │ backend                    │ │ │ ← Subcommands
│  │   │ Enable backend logging     │ │ │
│  │   └────────────────────────────┘ │ │
│  │   ┌────────────────────────────┐ │ │
│  │   │ disable                    │ │ │
│  │   │ Disable logging            │ │ │
│  │   └────────────────────────────┘ │ │
│  │   ┌────────────────────────────┐ │ │
│  │   │ enable                     │ │ │
│  │   │ Enable logging             │ │ │
│  │   └────────────────────────────┘ │ │
│  └──────────────────────────────────┘ │
│                                        │
└────────────────────────────────────────┘
```

**Changes:**
- ✅ Arrow rotates to point down (▼)
- ✅ Subcommands appear indented
- ✅ Purple left border shows hierarchy
- ✅ Gray background distinguishes subcommands

### Step 4: Executing a Subcommand

Click on a subcommand (e.g., "backend"):

```
┌────────────────────────────────────────┐
│ Commands                          [X]  │
├────────────────────────────────────────┤
│                                        │
│  ← Back to Commands                    │
│                                        │
│  ┌──────────────────────────────────┐ │
│  │ log backend                      │ │ ← Full command name
│  │ Enable backend logging           │ │
│  │ Subcommand of: log               │ │ ← Shows parent
│  └──────────────────────────────────┘ │
│                                        │
│  Usage                                 │
│  No usage info                         │
│                                        │
│  ┌──────────────────────────────────┐ │
│  │ [Execute]  [Cancel]              │ │
│  └──────────────────────────────────┘ │
│                                        │
└────────────────────────────────────────┘
```

**Features:**
- ✅ Shows full command name ("log backend")
- ✅ Shows parent command
- ✅ Execute button sends full command

## Color Coding

### Purple Theme
- **Purple badge:** "has subcommands"
- **Purple border:** Left border of subcommand section
- **Purple text:** Parent command reference

### Gray Theme
- **Gray background:** Subcommand section
- **Gray border:** Command borders
- **Gray text:** Descriptions

### Interactive States
- **Hover:** Light gray background
- **Active:** Darker gray background

## Icons and Indicators

### Arrow States
```
►  Collapsed (can expand)
▼  Expanded (can collapse)
```

### Badges
```
[has subcommands]  Purple badge indicating subcommands exist
```

### Links
```
Check for subcommands  Blue underlined link to discover subcommands
```

## Animation

### Expand/Collapse
- Arrow rotates smoothly (90 degrees)
- Subcommands slide in/out
- Transition duration: ~200ms

### Hover Effects
- Background color changes
- Smooth transition

## Responsive Design

### Desktop (> 640px)
```
┌─────────────────────────────────┐
│ Sidebar: 384px (24rem) wide     │
│ Full height                     │
│ Slide in from right             │
└─────────────────────────────────┘
```

### Mobile (< 640px)
```
┌─────────────────────────────────┐
│ Sidebar: Full width             │
│ Full height                     │
│ Slide in from right             │
└─────────────────────────────────┘
```

## Keyboard Navigation

Currently not implemented, but planned:
- `Tab` - Navigate between commands
- `Enter` - Expand/collapse or execute
- `Escape` - Close sidebar
- `Arrow Up/Down` - Navigate commands

## Accessibility

### Screen Readers
- Commands are announced with their descriptions
- Expand/collapse state is announced
- Subcommands are announced as nested items

### Keyboard Access
- All buttons are keyboard accessible
- Focus indicators visible
- Logical tab order

## Testing the UI

### Quick Test Checklist

1. **Open Demo:**
   ```bash
   open demo_subcommands.html
   ```

2. **Verify Arrows:**
   - [ ] Arrows appear next to commands with subcommands
   - [ ] Arrows are clickable
   - [ ] Arrows rotate when clicked

3. **Verify Expansion:**
   - [ ] Subcommands appear when expanded
   - [ ] Subcommands are indented
   - [ ] Purple left border appears
   - [ ] Gray background appears

4. **Verify Collapse:**
   - [ ] Subcommands disappear when collapsed
   - [ ] Arrow rotates back
   - [ ] Smooth animation

5. **Verify Execution:**
   - [ ] Clicking subcommand opens executor
   - [ ] Full command name shown
   - [ ] Parent command shown
   - [ ] Execute button works

## Comparison: Before vs After

### Before (No Subcommands)
```
┌──────────────────────┐
│ log                  │
│ Logging commands     │
└──────────────────────┘
```

### After (With Subcommands)
```
┌──────────────────────┐
│ ▼ log [has subcommands]
│   Logging commands   │
│   ├─ backend         │
│   ├─ disable         │
│   └─ enable          │
└──────────────────────┘
```

## Real-World Example

### Zephyr Shell Commands

Typical Zephyr commands with subcommands:

```
log
├─ backend
├─ disable
├─ enable
└─ list_backends

device
├─ list
├─ info
└─ reset

kernel
├─ version
├─ threads
└─ stacks

i2c
├─ scan
├─ read
└─ write
```

Each of these would show with an expand arrow and the hierarchical structure.

## Tips for Best Experience

1. **Discover Subcommands Early:** Click "Check for subcommands" for commands you use frequently
2. **Use Cache:** Subcommands are cached, so they load instantly on next visit
3. **Expand Multiple:** You can expand multiple commands at once
4. **Search Coming Soon:** Future versions will include search across subcommands

## Troubleshooting

### Not Seeing Arrows?
→ See `TROUBLESHOOTING_SUBCOMMANDS.md`

### Arrows Not Rotating?
→ Check that Tailwind CSS is loaded

### Subcommands Not Appearing?
→ Check browser console for errors

### Want to Test Without Device?
→ Open `demo_subcommands.html`
