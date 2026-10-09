#!/usr/bin/env bash
# Fuzail Ahmed - 3D Portfolio launcher (Linux/macOS)
cd "$(dirname "$(readlink -f "$0")")" || exit 1

if command -v python3 >/dev/null 2>&1; then
  exec python3 serve.py 8080
elif command -v python >/dev/null 2>&1; then
  exec python serve.py 8080
fi

echo "Python was not found. Install Python 3 or run: npx serve -l 8080"
exit 1
