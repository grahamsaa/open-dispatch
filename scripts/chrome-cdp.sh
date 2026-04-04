#!/bin/bash
# Launch Chrome with CDP (Chrome DevTools Protocol) debugging enabled.
# This allows OpenDispatch to connect to your actual Chrome sessions
# with all your saved logins, cookies, and authenticated sessions.
#
# Usage:
#   ./scripts/chrome-cdp.sh          # Launch Chrome with CDP on port 9222
#   ./scripts/chrome-cdp.sh 9333     # Use a custom port

PORT="${1:-9222}"

# Check if Chrome is already running with CDP
if curl -s "http://localhost:$PORT/json/version" > /dev/null 2>&1; then
  echo "Chrome CDP already available on port $PORT"
  curl -s "http://localhost:$PORT/json/version" | python3 -c "import sys,json; d=json.load(sys.stdin); print(f'Browser: {d.get(\"Browser\",\"unknown\")}')"
  exit 0
fi

# Check if Chrome is running without CDP
if pgrep -f "Google Chrome" > /dev/null 2>&1; then
  echo "Chrome is running but without CDP enabled."
  echo ""
  echo "To enable CDP, Chrome needs to be restarted with the debugging flag."
  read -p "Quit Chrome and relaunch with CDP? (y/N) " -n 1 -r
  echo ""
  if [[ $REPLY =~ ^[Yy]$ ]]; then
    echo "Quitting Chrome..."
    osascript -e 'tell application "Google Chrome" to quit'
    sleep 2
  else
    echo "Aborted. You can also run this manually:"
    echo "  1. Quit Chrome"
    echo "  2. Run: open -a 'Google Chrome' --args --remote-debugging-port=$PORT"
    exit 1
  fi
fi

echo "Launching Chrome with CDP on port $PORT..."
open -a "Google Chrome" --args --remote-debugging-port="$PORT"

# Wait for Chrome to start
for i in $(seq 1 15); do
  if curl -s "http://localhost:$PORT/json/version" > /dev/null 2>&1; then
    echo "Chrome CDP ready on port $PORT"
    curl -s "http://localhost:$PORT/json/version" | python3 -c "import sys,json; d=json.load(sys.stdin); print(f'Browser: {d.get(\"Browser\",\"unknown\")}')"
    exit 0
  fi
  sleep 1
done

echo "Warning: Chrome started but CDP not responding on port $PORT"
echo "Chrome may need a moment to initialize."
exit 1
