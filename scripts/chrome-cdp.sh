#!/bin/bash
# Launch Chrome with CDP (Chrome DevTools Protocol) debugging enabled.
# Uses a copied Chrome profile so sessions/cookies carry over.
#
# Usage:
#   ./scripts/chrome-cdp.sh          # Launch Chrome with CDP on port 9222
#   ./scripts/chrome-cdp.sh 9333     # Use a custom port

PORT="${1:-9222}"
CHROME_DATA="$HOME/.opendispatch/chrome-data"

# Check if Chrome CDP is already running
if curl -s "http://localhost:$PORT/json/version" > /dev/null 2>&1; then
  echo "Chrome CDP already available on port $PORT"
  curl -s "http://localhost:$PORT/json/version" | python3 -c "import sys,json; d=json.load(sys.stdin); print(f'Browser: {d.get(\"Browser\",\"unknown\")}')"
  exit 0
fi

# Kill any existing Chrome
if pgrep -f "Google Chrome" > /dev/null 2>&1; then
  echo "Quitting Chrome..."
  pkill -f "Google Chrome"
  sleep 3
fi

# Copy Chrome profile if needed (preserves sessions/cookies)
mkdir -p "$CHROME_DATA"
if [ ! -d "$CHROME_DATA/Default" ] && [ -d "$HOME/Library/Application Support/Google/Chrome/Default" ]; then
  echo "Copying Chrome profile for CDP access..."
  cp -r "$HOME/Library/Application Support/Google/Chrome/Default" "$CHROME_DATA/Default" 2>/dev/null
  cp "$HOME/Library/Application Support/Google/Chrome/Local State" "$CHROME_DATA/Local State" 2>/dev/null
fi

echo "Launching Chrome with CDP on port $PORT..."
/Applications/Google\ Chrome.app/Contents/MacOS/Google\ Chrome \
  --remote-debugging-port="$PORT" \
  --user-data-dir="$CHROME_DATA" &

# Wait for CDP
for i in $(seq 1 15); do
  if curl -s "http://localhost:$PORT/json/version" > /dev/null 2>&1; then
    echo "Chrome CDP ready on port $PORT"
    curl -s "http://localhost:$PORT/json/version" | python3 -c "import sys,json; d=json.load(sys.stdin); print(f'Browser: {d.get(\"Browser\",\"unknown\")}')"
    exit 0
  fi
  sleep 1
done

echo "Warning: Chrome started but CDP not responding on port $PORT"
exit 1
