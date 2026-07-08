#!/bin/bash
# RemoteAdmin Deployment Script
# Builds the dashboard and starts the server

set -e

echo "╔═══════════════════════════════════════════╗"
echo "║  RemoteAdmin Deployment                   ║"
echo "╚═══════════════════════════════════════════╝"

# Check prerequisites
command -v node >/dev/null 2>&1 || { echo "Error: Node.js is required. Install from https://nodejs.org"; exit 1; }
command -v npm >/dev/null 2>&1 || { echo "Error: npm is required."; exit 1; }

echo ""
echo "Step 1: Installing server dependencies..."
cd server
npm install
cd ..

echo ""
echo "Step 2: Installing dashboard dependencies..."
cd dashboard
npm install
cd ..

echo ""
echo "Step 3: Building dashboard for production..."
cd dashboard
npm run build
cd ..

echo ""
echo "Step 4: Starting signaling server..."
echo ""
echo "╔═══════════════════════════════════════════╗"
echo "║  Server starting on port 3001             ║"
echo "║  Dashboard build in dashboard/build/      ║"
echo "║                                           ║"
echo "║  To serve dashboard, run:                 ║"
echo "║  npx serve dashboard/build -l 3000        ║"
echo "║                                           ║"
echo "║  Or use: ./serve-dashboard.sh             ║"
echo "╚═══════════════════════════════════════════╝"
echo ""

cd server
node src/server.js
