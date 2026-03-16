#!/usr/bin/env bash
set -e

echo "Building web app in production mode..."
pnpm --filter @lifekeeper/web build

echo "Starting production server in background..."
pnpm --filter @lifekeeper/web start &
WEB_PID=$!

echo "Waiting for server to be ready..."
for i in $(seq 1 30); do
  if curl -s -o /dev/null -w '' http://127.0.0.1:3000 2>/dev/null; then
    echo "Server is ready."
    break
  fi
  if [ "$i" -eq 30 ]; then
    echo "Server did not start within 30 seconds."
    kill $WEB_PID 2>/dev/null
    exit 1
  fi
  sleep 1
done

echo "Running benchmark..."
pnpm --filter @lifekeeper/web benchmark

echo "Stopping production server..."
kill $WEB_PID 2>/dev/null
wait $WEB_PID 2>/dev/null
echo "Done."
