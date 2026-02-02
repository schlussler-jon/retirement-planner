# Railway Deployment Guide

This guide covers migrating from local development to production deployment on Railway.

## Phase 16 Changes

### What Changed

1. **Session Storage**: Redis replaces in-memory dict
   - Sessions persist across backend restarts
   - Works correctly with multiple backend instances
   - Automatic expiry via Redis TTL

2. **Scenario Storage**: PostgreSQL replaces in-memory dict
   - Scenarios persist across restarts
   - Proper multi-user isolation (user_id + scenario_id composite key)
   - Automatic table creation on first run

3. **Environment-Driven Config**: CORS and OAuth already support production URLs via env vars

### Migration Path

**Option A: Gradual (Recommended for Testing)**
1. Keep using in-memory storage locally
2. Deploy to Railway with Redis + PostgreSQL
3. Test production, then switch local dev to databases if desired

**Option B: Full Local Migration**
1. Run local Redis: `docker run -d -p 6379:6379 redis:alpine`
2. Run local PostgreSQL: `docker run -d -p 5432:5432 -e POSTGRES_PASSWORD=dev postgres:15-alpine`
3. Set `.env` vars: `REDIS_URL=redis://localhost:6379`, `DATABASE_URL=postgresql://user:dev@localhost:5432/retirement`
4. Restart backend - storage switches automatically

### Backward Compatibility

The new code **gracefully falls back** to in-memory storage when database URLs are missing:
- `session_redis.py`: Falls back to `InMemorySessionStore` if `REDIS_URL` not set
- `models.py`: Raises clear error if `DATABASE_URL` not set (prevents silent data loss)

**Local development continues to work** without any changes to `.env` — in-memory storage is still the default.

---

## Railway Deployment Steps

### Prerequisites

1. **GitHub Repository**
   ```bash
   cd retirement-planner
   git init
   git add .
   git commit -m "Initial commit - ready for Railway"
   git remote add origin https://github.com/your-username/retirement-planner.git
   git push -u origin main
   ```

2. **Google Cloud Console Updates**
   - Go to https://console.cloud.google.com/apis/credentials
   - Edit your OAuth 2.0 Client ID
   - Add authorized redirect URI: `https://your-backend.railway.app/auth/callback`
     (You'll get the exact URL after deploying backend)
   - Update authorized JavaScript origins if needed

### Railway Setup

1. **Create Project**
   - Go to https://railway.app
   - Click "New Project" → "Deploy from GitHub repo"
   - Select your retirement-planner repo
   - Railway creates a project

2. **Add Backend Service**
   - Click "+ New" → "GitHub Repo"
   - Select your repo again
   - Click "Add Variables" and configure:
     ```bash
     # Root path (important!)
     RAILWAY_SERVICE_DIRECTORY=backend
     
     # Port
     PORT=8000
     
     # OAuth (from Google Cloud Console)
     GOOGLE_CLIENT_ID=your-id.apps.googleusercontent.com
     GOOGLE_CLIENT_SECRET=your-secret
     GOOGLE_REDIRECT_URI=https://your-backend.railway.app/auth/callback
     
     # Session
     SESSION_SECRET_KEY=<generate-with-openssl-rand-hex-32>
     
     # CORS (will be frontend URL after you deploy it)
     FRONTEND_URL=https://your-frontend.railway.app
     
     # Optional
     DEBUG=False
     DRIVE_FOLDER_NAME=Retirement Planner Scenarios
     ```
   - Railway auto-detects `/backend/Dockerfile` and builds
   - Once deployed, copy the backend URL (e.g., `https://retirement-backend-production.up.railway.app`)

3. **Add Redis Plugin**
   - In Railway project, click "+ New" → "Database" → "Add Redis"
   - Railway automatically injects `REDIS_URL` into backend service
   - No additional config needed

4. **Add PostgreSQL Plugin**
   - Click "+ New" → "Database" → "Add PostgreSQL"
   - Railway automatically injects `DATABASE_URL` into backend service
   - Schema auto-creates on first backend startup

5. **Add Frontend Service**
   - Click "+ New" → "GitHub Repo" → select repo again
   - Configure variables:
     ```bash
     # Root path (important!)
     RAILWAY_SERVICE_DIRECTORY=frontend
     
     # Port
     PORT=80
     ```
   - Railway auto-detects `/frontend/Dockerfile` and builds
   - Frontend nginx config proxies `/api/*` → backend service
   - Copy frontend URL after deploy

6. **Update Backend Environment Variables**
   - Go to backend service settings
   - Update `FRONTEND_URL` with the actual frontend URL
   - Update `GOOGLE_REDIRECT_URI` with the actual backend URL
   - Backend redeploys automatically

7. **Update Google Cloud Console**
   - Add the actual backend URL to authorized redirect URIs
   - E.g., `https://retirement-backend-production.up.railway.app/auth/callback`

### Verification

1. Visit frontend URL (e.g., `https://retirement-frontend-production.up.railway.app`)
2. Click "Sign in with Google" — should redirect to Google OAuth
3. After auth, you're redirected back and logged in
4. Create a scenario — saves to PostgreSQL (persists after backend restart)
5. Restart backend service in Railway dashboard — session persists (Redis), scenarios persist (PostgreSQL)

---

## Environment Variables Reference

### Backend Service

| Variable | Required | Description | Example |
|----------|----------|-------------|---------|
| `RAILWAY_SERVICE_DIRECTORY` | Yes | Path to backend code | `backend` |
| `PORT` | Yes | Backend port | `8000` |
| `GOOGLE_CLIENT_ID` | Yes | OAuth client ID | `123.apps.googleusercontent.com` |
| `GOOGLE_CLIENT_SECRET` | Yes | OAuth secret | `GOCSPX-...` |
| `GOOGLE_REDIRECT_URI` | Yes | OAuth callback URL | `https://backend.railway.app/auth/callback` |
| `SESSION_SECRET_KEY` | Yes | Session signing key | 32-byte hex string |
| `FRONTEND_URL` | Yes | Frontend domain (CORS) | `https://frontend.railway.app` |
| `REDIS_URL` | Auto | Redis connection | Railway injects |
| `DATABASE_URL` | Auto | PostgreSQL connection | Railway injects |
| `DEBUG` | No | Enable debug mode | `False` |
| `DRIVE_FOLDER_NAME` | No | Drive folder name | `Retirement Planner Scenarios` |

### Frontend Service

| Variable | Required | Description | Example |
|----------|----------|-------------|---------|
| `RAILWAY_SERVICE_DIRECTORY` | Yes | Path to frontend code | `frontend` |
| `PORT` | Yes | Frontend port | `80` |

---

## Troubleshooting

### "Not authenticated" errors
- Check `GOOGLE_REDIRECT_URI` matches Google Cloud Console
- Check `FRONTEND_URL` is correct in backend env vars
- Check cookies are being set (browser dev tools → Application → Cookies)

### "Database connection failed"
- PostgreSQL plugin added? Check Railway dashboard
- `DATABASE_URL` injected? Check backend service env vars
- Connection string starts with `postgresql://` (Railway uses `postgres://` but code auto-converts)

### "Session expired" on every request
- Redis plugin added? Check Railway dashboard
- `REDIS_URL` injected? Check backend service env vars
- Check backend logs for "Connected to Redis" message

### CORS errors in browser console
- `FRONTEND_URL` set correctly in backend env vars?
- Matches the actual frontend domain?
- Backend redeployed after changing env vars?

### OAuth redirect loop
- Google Cloud Console authorized redirect URIs include production backend URL?
- `GOOGLE_REDIRECT_URI` env var matches Google Cloud Console exactly?

---

## Cost Estimate

Railway pricing (as of 2024):
- **Hobby Plan**: $5/month for 500 hours + $0.000231/GB-hour RAM
- **Redis Plugin**: ~$1-2/month for 256MB
- **PostgreSQL Plugin**: ~$2-3/month for 1GB
- **Total**: ~$8-10/month for a personal project

Free tier available: $5/month credit, enough to run the app if traffic is low.

---

## Rollback Plan

If production deployment fails, local development continues working unchanged (in-memory storage). To rollback:

1. Delete Railway services
2. Continue local development with existing setup
3. No code changes needed — fallback is automatic
