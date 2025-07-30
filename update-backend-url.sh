#!/bin/bash
# Quick script to update backend URL
# Replace YOUR_RENDER_URL with your actual Render URL

BACKEND_URL="YOUR_RENDER_URL"  # e.g., https://your-app-abc123.onrender.com

# Update .env.production
echo "REACT_APP_API_URL=${BACKEND_URL}/api" > frontend/.env.production

# Update api.ts
sed -i '' "s|https://medibudy-backend.onrender.com/api|${BACKEND_URL}/api|g" frontend/src/services/api.ts

# Commit and push
git add .
git commit -m "Update backend URL to ${BACKEND_URL}"
git push

echo "✅ Updated backend URL to: ${BACKEND_URL}/api"
echo "🚀 Netlify will auto-redeploy with new configuration"
