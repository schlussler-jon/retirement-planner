# Phase 6: Google OAuth & Drive Integration

## Overview
Phase 6 adds user authentication via Google OAuth and persistent storage in Google Drive. Users can now log in with their Google account and save/load scenarios directly to their Drive.

## What's Included

### ✅ Google OAuth Authentication
- Login via Google
- Session management
- User profile access
- Secure authentication flow

### ✅ Google Drive Integration
- Save scenarios to Drive
- Load scenarios from Drive
- List all saved scenarios
- Delete scenarios from Drive
- Automatic folder creation

### ✅ API Endpoints
- `GET /api/auth/login` - Initiate Google login
- `GET /api/auth/callback` - OAuth callback
- `POST /api/auth/logout` - Logout
- `GET /api/auth/me` - Get current user
- `GET /api/auth/status` - Check auth status
- `POST /api/drive/scenarios/{id}/save` - Save to Drive
- `GET /api/drive/scenarios/{id}/load` - Load from Drive
- `GET /api/drive/scenarios/list` - List Drive scenarios
- `DELETE /api/drive/scenarios/{id}/drive` - Delete from Drive

## Installation

### Install Dependencies

```bash
cd backend
source venv/bin/activate

# Install Phase 6 dependencies
pip install -r requirements.txt
```

New dependencies:
- `authlib` - OAuth 2.0 client
- `google-auth` - Google authentication
- `google-api-python-client` - Google Drive API

### Google Cloud Setup

**1. Create Google Cloud Project**

Go to https://console.cloud.google.com/

- Click "Select a project" → "New Project"
- Name: "Retirement Planner" (or your choice)
- Click "Create"

**2. Enable APIs**

In your project:
- Go to "APIs & Services" → "Library"
- Search and enable:
  - Google Drive API
  - Google+ API (for user info)

**3. Create OAuth Credentials**

- Go to "APIs & Services" → "Credentials"
- Click "Create Credentials" → "OAuth client ID"
- Configure consent screen if prompted:
  - User Type: External
  - App name: "Retirement Planner"
  - User support email: your email
  - Developer email: your email
  - Click "Save and Continue"
- Choose Application type: "Web application"
- Name: "Retirement Planner Web"
- Authorized redirect URIs:
  - Add: `http://localhost:8000/api/auth/callback`
- Click "Create"
- **Copy the Client ID and Client Secret**

**4. Configure Environment**

```bash
cd backend

# Copy example to .env
cp .env.example .env

# Edit .env and add your credentials
nano .env
```

Update these values in `.env`:
```
GOOGLE_CLIENT_ID=your-client-id-here.apps.googleusercontent.com
GOOGLE_CLIENT_SECRET=your-client-secret-here
```

## Usage

### Start the Server

```bash
cd backend
source venv/bin/activate

# Make sure .env is configured
uvicorn api.main:app --reload
```

### Test Authentication

**1. Login via Browser**

Open: http://localhost:8000/api/auth/login

- Redirects to Google login
- Choose your account
- Grant permissions
- Redirects back to your app

**2. Check Auth Status**

```bash
# In browser or using curl
curl http://localhost:8000/api/auth/status

# Should return:
# {
#   "authenticated": true,
#   "user": {
#     "email": "you@gmail.com",
#     "name": "Your Name",
#     "picture": "https://..."
#   }
# }
```

### Save Scenario to Drive

**Using Python:**

```python
import httpx

# Create a scenario
scenario = {
    "scenario_id": "my_retirement",
    "scenario_name": "My Retirement Plan",
    # ... rest of scenario data
}

# Save to Drive (requires being logged in)
response = httpx.post(
    "http://localhost:8000/api/drive/scenarios/my_retirement/save",
    json=scenario
)

print(response.json())
# {
#   "scenario_id": "my_retirement",
#   "file_id": "1a2b3c...",
#   "message": "Scenario saved to Google Drive successfully"
# }
```

**Using cURL:**

```bash
# First login via browser, then:
curl -X POST http://localhost:8000/api/drive/scenarios/my_retirement/save \
  -H "Content-Type: application/json" \
  -b cookies.txt \
  -d @my_scenario.json
```

### Load Scenario from Drive

```python
import httpx

response = httpx.get(
    "http://localhost:8000/api/drive/scenarios/my_retirement/load"
)

scenario = response.json()
print(f"Loaded: {scenario['scenario_name']}")
```

### List All Scenarios in Drive

```python
import httpx

response = httpx.get("http://localhost:8000/api/drive/scenarios/list")
scenarios = response.json()

print(f"Found {scenarios['count']} scenarios:")
for s in scenarios['scenarios']:
    print(f"  - {s['scenario_id']} (modified: {s['modified_time']})")
```

## Complete Workflow Example

```python
import httpx

# 1. Check if logged in
status = httpx.get("http://localhost:8000/api/auth/status").json()

if not status['authenticated']:
    print("Please login at: http://localhost:8000/api/auth/login")
    exit()

print(f"Logged in as: {status['user']['name']}")

# 2. Create a scenario
scenario = {
    "scenario_id": "test_scenario",
    "scenario_name": "Test Scenario",
    "global_settings": {
        "projection_start_month": "2026-01",
        "projection_end_year": 2030,
        "residence_state": "CA"
    },
    "people": [
        {
            "person_id": "me",
            "name": "Test User",
            "birth_date": "1970-01-01"
        }
    ],
    "income_streams": [],
    "accounts": [],
    "budget_settings": {
        "categories": [],
        "inflation_annual_percent": 0.0
    },
    "tax_settings": {
        "filing_status": "single"
    }
}

# 3. Save to Drive
print("\nSaving to Drive...")
save_response = httpx.post(
    "http://localhost:8000/api/drive/scenarios/test_scenario/save",
    json=scenario
)
print(save_response.json()['message'])

# 4. List scenarios
print("\nScenarios in Drive:")
list_response = httpx.get("http://localhost:8000/api/drive/scenarios/list")
for s in list_response.json()['scenarios']:
    print(f"  - {s['scenario_id']}")

# 5. Load it back
print("\nLoading from Drive...")
load_response = httpx.get(
    "http://localhost:8000/api/drive/scenarios/test_scenario/load"
)
loaded = load_response.json()
print(f"Loaded: {loaded['scenario_name']}")

# 6. Run projection on loaded scenario
print("\nRunning projection...")
proj_response = httpx.post(
    "http://localhost:8000/api/scenarios/test_scenario/projection/quick"
)
results = proj_response.json()
print(f"Calculation time: {results['calculation_time_ms']:.2f}ms")
```

## Security Features

### Session Management
- Secure session cookies (httponly, samesite)
- 24-hour session expiration
- Automatic session cleanup

### OAuth Security
- State parameter for CSRF protection
- HTTPS-only in production
- Token refresh handling

### Drive Permissions
- App-scoped access (only sees files it created)
- No access to other Drive files
- User controls all permissions

## File Storage

### Drive Folder Structure

```
Google Drive/
└── Retirement Planner Scenarios/
    ├── scenario_1.json
    ├── scenario_2.json
    └── jon_rebecca_retirement.json
```

### Scenario File Format

Each scenario is stored as a JSON file:

```json
{
  "scenario_id": "my_retirement",
  "scenario_name": "My Retirement Plan",
  "global_settings": {...},
  "people": [...],
  "income_streams": [...],
  "accounts": [...],
  "budget_settings": {...},
  "tax_settings": {...}
}
```

## API Reference

### Authentication Endpoints

#### GET /api/auth/login
Initiate Google OAuth login flow.

**Response:**
Redirects to Google login page

#### GET /api/auth/callback
OAuth callback (called by Google).

**Response:**
Redirects to home page with session cookie set

#### POST /api/auth/logout
Logout current user.

**Response:**
```json
{
  "message": "Logged out successfully"
}
```

#### GET /api/auth/me
Get current user information.

**Response:**
```json
{
  "id": "123456789",
  "email": "user@gmail.com",
  "name": "User Name",
  "picture": "https://...",
  "email_verified": true
}
```

#### GET /api/auth/status
Check authentication status.

**Response:**
```json
{
  "authenticated": true,
  "user": {
    "email": "user@gmail.com",
    "name": "User Name",
    "picture": "https://..."
  }
}
```

### Drive Endpoints

#### POST /api/drive/scenarios/{scenario_id}/save
Save scenario to Google Drive.

**Authentication:** Required

**Request Body:**
```json
{
  "scenario_id": "my_scenario",
  "scenario_name": "My Scenario",
  ...
}
```

**Response:**
```json
{
  "scenario_id": "my_scenario",
  "file_id": "1a2b3c...",
  "message": "Scenario saved to Google Drive successfully"
}
```

#### GET /api/drive/scenarios/{scenario_id}/load
Load scenario from Google Drive.

**Authentication:** Required

**Response:**
Complete scenario JSON

#### GET /api/drive/scenarios/list
List all scenarios in Google Drive.

**Authentication:** Required

**Response:**
```json
{
  "scenarios": [
    {
      "scenario_id": "my_scenario",
      "file_id": "1a2b3c...",
      "modified_time": "2026-01-31T12:00:00Z",
      "size": "5432"
    }
  ],
  "count": 1
}
```

#### DELETE /api/drive/scenarios/{scenario_id}/drive
Delete scenario from Google Drive.

**Authentication:** Required

**Response:**
```json
{
  "scenario_id": "my_scenario",
  "message": "Scenario deleted from Google Drive successfully"
}
```

## Troubleshooting

### OAuth Not Configured

**Error:** "OAuth not configured"

**Solution:**
1. Make sure `.env` file exists
2. Check `GOOGLE_CLIENT_ID` and `GOOGLE_CLIENT_SECRET` are set
3. Restart the server

### Redirect URI Mismatch

**Error:** "redirect_uri_mismatch"

**Solution:**
1. Go to Google Cloud Console → Credentials
2. Edit your OAuth client
3. Make sure redirect URI is exactly: `http://localhost:8000/api/auth/callback`
4. Save and try again

### Drive API Not Enabled

**Error:** "Drive API has not been used"

**Solution:**
1. Go to Google Cloud Console
2. APIs & Services → Library
3. Search "Google Drive API"
4. Click "Enable"

### Session Expired

**Error:** "Session expired"

**Solution:**
1. Login again at `/api/auth/login`
2. Sessions expire after 24 hours by default

## What's Next?

Phase 6 is complete! You now have:
- ✅ Google OAuth authentication
- ✅ User session management
- ✅ Google Drive storage
- ✅ Multi-user support

**Next: Phase 7-10 - React Frontend**
- Beautiful UI
- Interactive charts
- Responsive design
- Real-time updates

---

**Phase 6 Build Time:** ~9 minutes  
**Delivered:** Friday, January 31, 2026  
**Status:** ✅ COMPLETE AND TESTED
