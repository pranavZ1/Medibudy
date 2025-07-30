# MediBudy Deployment Guide

## Overview
This guide will help you deploy the MediBudy application with:
- **Frontend**: React app deployed to Netlify
- **Backend**: Node.js/Express API deployed to Render or Heroku
- **Database**: MongoDB Atlas (cloud database)

## Prerequisites
1. GitHub account
2. Netlify account
3. Render account (or Heroku account)
4. MongoDB Atlas account

## Step 1: Setup MongoDB Atlas

1. Go to [MongoDB Atlas](https://www.mongodb.com/atlas)
2. Create a free account and cluster
3. Create a database user
4. Get your connection string (replace password and database name)
5. Whitelist your IP address (or use 0.0.0.0/0 for all IPs)

## Step 2: Deploy Backend to Render

1. **Push code to GitHub** (if not already done):
   ```bash
   git add .
   git commit -m "Prepare for deployment"
   git push origin main
   ```

2. **Create Render account** at [render.com](https://render.com)

3. **Create a new Web Service**:
   - Connect your GitHub repository
   - Select the MediBudy repository
   - Use these settings:
     - **Environment**: Node
     - **Build Command**: `npm install`
     - **Start Command**: `npm start`
     - **Node Version**: 18

4. **Add Environment Variables** in Render dashboard:
   ```
   NODE_ENV=production
   MONGODB_URI=your_mongodb_atlas_connection_string
   JWT_SECRET=your_strong_jwt_secret_here
   GOOGLE_AI_API_KEY=your_google_ai_api_key
   FRONTEND_URL=https://your-netlify-app.netlify.app
   ```

5. **Deploy** - Render will automatically deploy your backend

## Step 3: Deploy Frontend to Netlify

1. **Update production API URL**:
   Edit `frontend/.env.production` and replace with your Render backend URL:
   ```
   REACT_APP_API_URL=https://your-backend-url.onrender.com/api
   ```

2. **Create Netlify account** at [netlify.com](https://netlify.com)

3. **Deploy from GitHub**:
   - Click "New site from Git"
   - Connect to GitHub and select your repository
   - Use these build settings:
     - **Base directory**: `frontend`
     - **Build command**: `npm run build`
     - **Publish directory**: `frontend/build`

4. **Add Environment Variables** in Netlify dashboard:
   ```
   REACT_APP_API_URL=https://your-backend-url.onrender.com/api
   ```

5. **Deploy** - Netlify will build and deploy your frontend

## Step 4: Update CORS Settings

Update your backend's CORS configuration to include your Netlify domain:

In your `server.js` or CORS middleware, add:
```javascript
const allowedOrigins = [
  'http://localhost:3000',
  'https://your-netlify-app.netlify.app'
];
```

## Step 5: Custom Domain (Optional)

1. **For Netlify**: Go to Domain settings and add your custom domain
2. **For Render**: Go to Settings > Custom Domains

## Alternative: Deploy Backend to Heroku

If you prefer Heroku over Render:

1. Install Heroku CLI
2. Login: `heroku login`
3. Create app: `heroku create your-app-name`
4. Add MongoDB addon: `heroku addons:create mongolab:sandbox`
5. Set environment variables: `heroku config:set VARIABLE_NAME=value`
6. Deploy: `git push heroku main`

## Environment Variables Summary

### Backend (.env):
```
NODE_ENV=production
MONGODB_URI=mongodb+srv://username:password@cluster.mongodb.net/medibudy
JWT_SECRET=your_super_secret_jwt_key_here
GOOGLE_AI_API_KEY=your_google_ai_api_key
FRONTEND_URL=https://your-netlify-app.netlify.app
PORT=5000
```

### Frontend (.env.production):
```
REACT_APP_API_URL=https://your-backend-url.onrender.com/api
```

## Post-Deployment Testing

1. Test all API endpoints
2. Test user registration/login
3. Test AI features
4. Test hospital/doctor search
5. Test responsive design

## Troubleshooting

### Common Issues:
1. **CORS errors**: Check your CORS configuration includes your frontend domain
2. **API not found**: Verify environment variables are set correctly
3. **Database connection**: Check MongoDB Atlas IP whitelist and connection string
4. **Build failures**: Check build logs for missing dependencies

### Logs:
- **Render**: View logs in dashboard
- **Netlify**: View deploy logs in dashboard
- **Heroku**: `heroku logs --tail`

## Security Checklist

- [ ] Environment variables are set (not hardcoded)
- [ ] JWT secret is strong and secure
- [ ] MongoDB Atlas has proper authentication
- [ ] CORS is configured correctly
- [ ] HTTPS is enabled (automatic on Netlify/Render)
- [ ] API rate limiting is enabled

## Support

If you encounter issues:
1. Check the logs first
2. Verify environment variables
3. Test API endpoints directly
4. Check database connectivity
