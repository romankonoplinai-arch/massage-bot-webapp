#!/bin/bash
# Manual script to update cache version in HTML files
# Usage: ./update-version.sh

# Get current timestamp as version
VERSION=$(date +%Y-%m-%d-%H%M)

echo "Updating cache version to: $VERSION"

# Update admin/index.html
if [ -f "admin/index.html" ]; then
    sed -i "s/schedule\.js?v=[^\"]*\"/schedule.js?v=$VERSION\"/g" admin/index.html
    echo "✅ Updated admin/index.html"
fi

# Update client/index.html
if [ -f "client/index.html" ]; then
    sed -i "s/app\.js?v=[^\"]*\"/app.js?v=$VERSION\"/g" client/index.html
    echo "✅ Updated client/index.html"
fi

echo ""
echo "Done! New version: $VERSION"
echo "Now commit and push these changes."
