#!/bin/sh
set -eu

echo "Starting virtual display on :99"
Xvfb :99 -screen 0 1440x1000x24 -ac +extension RANDR &

export DISPLAY=:99

echo "Starting tracking API on port ${PORT:-3000}"
exec node server.js
