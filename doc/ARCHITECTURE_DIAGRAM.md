# Command Discovery Architecture

## System Flow Diagram

```
┌─────────────────────────────────────────────────────────────┐
│                     User Interface                          │
│  ┌──────────────┐  ┌──────────────┐  ┌──────────────┐     │
│  │ Scan Button  │  │ Command List │  │ Expand Arrow │     │
│  └──────┬───────┘  └──────┬───────┘  └──────┬───────┘     │
└─────────┼──────────────────┼──────────────────┼─────────────┘
          │                  │                  │
          ▼                  ▼                  ▼
┌─────────────────────────────────────────────────────────────┐
│              Command Discovery Controller                    │
│  ┌──────────────────────────────────────────────────────┐  │
│  │  Concurrency Control                                  │  │
│  │  ┌────────────┐                                       │  │
│  │  │ Lock Check │──► discoveryLock = true/false        │  │
│  │  └────────────┘                                       │  │
│  │       │                                                │  │
│  │       ├─► If locked: Reject with error message        │  │
│  │       └─► If unlocked: Acquire lock & proceed         │  │
│  └──────────────────────────────────────────────────────┘  │
│                                                              │
│  ┌──────────────────────────────────────────────────────┐  │
│  │  Discovery Operations                                 │  │
│  │  ┌────────────────┐    ┌─────────────────────┐      │  │
│  │  │ scanCommands() │    │ discoverSubcommands()│      │  │
│  │  └────────┬───────┘    └──────────┬──────────┘      │  │
│  │           │                        │                  │  │
│  │           ▼                        ▼                  │  │
│  │    Send "help"              Send "help <cmd>"        │  │
│  └──────────┼──────────────────────────┼────────────────┘  │
└─────────────┼──────────────────────────┼───────────────────┘
              │                          │
              ▼                          ▼
┌─────────────────────────────────────────────────────────────┐
│                  WebSocket Connection                        │
│                          │                                   │
│                          ▼                                   │
│                  Zephyr Device Shell                         │
└─────────────────────────┬───────────────────────────────────┘
                          │
                          ▼
┌─────────────────────────────────────────────────────────────┐
│                  Response Parser                             │
│  ┌──────────────────┐    ┌─────────────────────────┐       │
│  │ parseHelpOutput()│    │ parseSubcommands()      │       │
│  └────────┬─────────┘    └──────────┬──────────────┘       │
│           │                          │                       │
│           ▼                          ▼                       │
│    Extract commands          Extract subcommands            │
└───────────┼──────────────────────────┼───────────────────────┘
            │                          │
            ▼                          ▼
┌─────────────────────────────────────────────────────────────┐
│                  Data Model                                  │
│  ┌──────────────────────────────────────────────────────┐  │
│  │  Command Structure                                    │  │
│  │  {                                                    │  │
│  │    id: 'log',                                         │  │
│  │    name: 'log',                                       │  │
│  │    description: 'Logging commands',                   │  │
│  │    hasSubcommands: true,                              │  │
│  │    subcommands: [                                     │  │
│  │      {                                                │  │
│  │        id: 'log_backend',                             │  │
│  │        name: 'backend',                               │  │
│  │        fullName: 'log backend',                       │  │
│  │        parent: 'log'                                  │  │
│  │      }                                                │  │
│  │    ]                                                  │  │
│  │  }                                                    │  │
│  └──────────────────────────────────────────────────────┘  │
└───────────────────────────┬─────────────────────────────────┘
                            │
                            ▼
┌─────────────────────────────────────────────────────────────┐
│                  Cache Layer (localStorage)                  │
│  ┌──────────────────────────────────────────────────────┐  │
│  │  Cache Structure (v2.0)                              │  │
│  │  {                                                    │  │
│  │    version: '2.0',                                    │  │
│  │    lastScanned: '2024-01-15T10:30:00Z',              │  │
│  │    commands: [...]  // Includes subcommands          │  │
│  │  }                                                    │  │
│  └──────────────────────────────────────────────────────┘  │
└─────────────────────────────────────────────────────────────┘
```

## Concurrency Control Flow

```
User Action: Click "Scan Commands"
         │
         ▼
    ┌─────────┐
    │ Check   │
    │ Lock    │
    └────┬────┘
         │
    ┌────┴────┐
    │         │
    ▼         ▼
Locked?    Unlocked?
    │         │
    │         ▼
    │    ┌─────────────┐
    │    │ Acquire Lock│
    │    └──────┬──────┘
    │           │
    │           ▼
    │    ┌─────────────┐
    │    │   Start     │
    │    │  Discovery  │
    │    └──────┬──────┘
    │           │
    │           ▼
    │    ┌─────────────┐
    │    │   Send      │
    │    │  Commands   │
    │    └──────┬──────┘
    │           │
    │           ▼
    │    ┌─────────────┐
    │    │   Parse     │
    │    │  Response   │
    │    └──────┬──────┘
    │           │
    │           ▼
    │    ┌─────────────┐
    │    │   Update    │
    │    │   Cache     │
    │    └──────┬──────┘
    │           │
    │           ▼
    │    ┌─────────────┐
    │    │ Release Lock│
    │    └─────────────┘
    │
    ▼
┌─────────────┐
│   Reject    │
│   with      │
│   Error     │
└─────────────┘
```

## Subcommand Discovery Flow

```
User Action: Click Expand Arrow
         │
         ▼
    ┌─────────────┐
    │  Check if   │
    │ Subcommands │
    │  Cached     │
    └──────┬──────┘
           │
      ┌────┴────┐
      │         │
      ▼         ▼
   Cached?   Not Cached?
      │         │
      │         ▼
      │    ┌─────────────┐
      │    │ Check Lock  │
      │    └──────┬──────┘
      │           │
      │      ┌────┴────┐
      │      │         │
      │      ▼         ▼
      │   Locked?   Unlocked?
      │      │         │
      │      │         ▼
      │      │    ┌─────────────┐
      │      │    │ Acquire Lock│
      │      │    └──────┬──────┘
      │      │           │
      │      │           ▼
      │      │    ┌─────────────┐
      │      │    │    Send     │
      │      │    │"help <cmd>" │
      │      │    └──────┬──────┘
      │      │           │
      │      │           ▼
      │      │    ┌─────────────┐
      │      │    │    Parse    │
      │      │    │ Subcommands │
      │      │    └──────┬──────┘
      │      │           │
      │      │           ▼
      │      │    ┌─────────────┐
      │      │    │   Update    │
      │      │    │   Command   │
      │      │    └──────┬──────┘
      │      │           │
      │      │           ▼
      │      │    ┌─────────────┐
      │      │    │ Release Lock│
      │      │    └──────┬──────┘
      │      │           │
      ▼      ▼           ▼
    ┌─────────────────────┐
    │   Display           │
    │   Subcommands       │
    └─────────────────────┘
```

## State Management

```
┌─────────────────────────────────────────┐
│         Application State               │
├─────────────────────────────────────────┤
│                                         │
│  discoveryLock: boolean                 │
│    ├─► false: Discovery allowed        │
│    └─► true:  Discovery blocked         │
│                                         │
│  commandDiscoveryInProgress: boolean    │
│    ├─► false: No discovery running     │
│    └─► true:  Discovery in progress     │
│                                         │
│  expandedCommands: object               │
│    ├─► { 'log': true }                 │
│    └─► Tracks expansion state           │
│                                         │
│  commands: array                        │
│    └─► Hierarchical command structure   │
│                                         │
│  commandsCache: object                  │
│    └─► Cached commands with metadata    │
│                                         │
└─────────────────────────────────────────┘
```

## UI Component Hierarchy

```
┌─────────────────────────────────────────────────────────┐
│                  Commands Sidebar                       │
│  ┌───────────────────────────────────────────────────┐ │
│  │  Header                                           │ │
│  │  ├─ Title: "Commands"                             │ │
│  │  ├─ Export Button                                 │ │
│  │  ├─ Import Button                                 │ │
│  │  └─ Close Button                                  │ │
│  └───────────────────────────────────────────────────┘ │
│                                                         │
│  ┌───────────────────────────────────────────────────┐ │
│  │  Command List                                     │ │
│  │  ┌─────────────────────────────────────────────┐ │ │
│  │  │  Command Item                               │ │ │
│  │  │  ├─ Expand Arrow (if has subcommands)       │ │ │
│  │  │  ├─ Command Name                            │ │ │
│  │  │  ├─ Badge: "has subcommands"                │ │ │
│  │  │  ├─ Description                             │ │ │
│  │  │  └─ Subcommands (when expanded)             │ │ │
│  │  │     ├─ Subcommand 1                         │ │ │
│  │  │     ├─ Subcommand 2                         │ │ │
│  │  │     └─ ...                                  │ │ │
│  │  └─────────────────────────────────────────────┘ │ │
│  └───────────────────────────────────────────────────┘ │
│                                                         │
│  ┌───────────────────────────────────────────────────┐ │
│  │  Footer                                           │ │
│  │  ├─ Rescan Button                                │ │
│  │  └─ Last Scanned Info                            │ │
│  └───────────────────────────────────────────────────┘ │
└─────────────────────────────────────────────────────────┘
```

## Key Design Decisions

### 1. Lazy Loading
- Subcommands are discovered on-demand
- Reduces initial scan time
- Improves user experience

### 2. Lock-Based Concurrency Control
- Simple boolean flag
- Minimal overhead
- Clear semantics

### 3. Hierarchical Data Model
- Parent-child relationships
- Full command names for execution
- Flexible for future extensions

### 4. Cache Versioning
- Supports migration
- Backward compatible
- Future-proof

### 5. Visual Hierarchy
- Indentation for subcommands
- Color coding (purple theme)
- Clear expand/collapse indicators
