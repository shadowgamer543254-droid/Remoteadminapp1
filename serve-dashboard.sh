#!/bin/bash
# Serve the built dashboard on port 3000

echo "Serving dashboard at http://localhost:3000"
echo "Make sure server is running on port 3001"

npx serve dashboard/build -l 3000
