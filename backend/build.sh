#!/bin/bash
# Build script for Linux/Mac

echo "Building Zephyr Device Manager executable..."

# Activate virtual environment if it exists
if [ -f venv/bin/activate ]; then
    source venv/bin/activate
fi

# Install PyInstaller if not already installed
pip install pyinstaller

# Clean previous builds
rm -rf build dist

# Build the executable
pyinstaller zdm.spec

echo ""
echo "Build complete! Executable is in dist/zdm"
echo ""
