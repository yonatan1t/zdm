# Product Overview

Zephyr Device Manager (ZDM) is a web-based serial terminal application for Zephyr RTOS development and debugging.

## Core Purpose

Provides real-time serial communication with Zephyr devices through a browser-based terminal interface, enabling developers to interact with embedded devices without installing native terminal applications.

## Key Features

- Real-time serial port communication with Zephyr devices
- Interactive web-based terminal using xterm.js
- Automatic command discovery from Zephyr shell
- Hierarchical command structure with subcommand support
- WebSocket-based bidirectional communication
- Settings panel for serial port configuration
- Command history and caching
- No build step required for frontend

## Target Users

Embedded systems developers working with Zephyr RTOS who need a lightweight, cross-platform terminal interface for device interaction and debugging.

## Future Extensions

- Additional communication backends (Telnet, RTT, MQTT)
- MCUMGR support for device management
- FOTA (Firmware Over-The-Air) updates
