# Climactix Global — Auth Server Setup

## Prerequisites
- Node.js 18+ (https://nodejs.org)
- MongoDB Atlas free account (https://mongodb.com/atlas)
- Gmail account (for email — enable App Passwords)

---

## 1. Install dependencies
```bash
cd server
npm install
```

## 2. Configure environment
```bash
cp .env.example .env
# Edit .env with your values
```

### Required .env values:

| Variable | Description |
|---|---|
| `MONGODB_URI` | MongoDB Atlas connection string |
| `JWT_SECRET` | Random 64+ char secret. Run: `node -e "console.log(require('crypto').randomBytes(64).toString('hex'))"` |
| `EMAIL_USER` | Your Gmail address |
| `EMAIL_PASS` | Gmail App Password (NOT your login password) |
| `FRONTEND_URL` | Where your HTML files are served (e.g. `http://localhost:5500`) |

### Gmail App Password setup:
1. Go to Google Account → Security → 2-Step Verification (enable it)
2. Then Security → App Passwords → Create one for "Mail"
3. Use the 16-char code as `EMAIL_PASS`

---

## 3. MongoDB Atlas setup:
1. Create free cluster at mongodb.com/atlas
2. Create a database user (username + password)
3. Add your IP to Network Access (or allow 0.0.0.0/0 for dev)
4. Get connection string: Cluster → Connect → Drivers → Node.js
5. Replace `<password>` in the URI

---

## 4. Start the server
```bash
# Development (auto-restart on changes)
npm run dev

# Production
npm start
```

Server runs on: http://localhost:3001

---

## 5. Serve the frontend

Use VS Code Live Server (right-click index.html → Open with Live Server)
or:
```bash
npx serve /path/to/Climatix-global
```

Make sure `FRONTEND_URL` in .env matches where your site is served.

---

## API Endpoints

| Method | Endpoint | Description |
|---|---|---|
| POST | `/api/auth/signup` | Register new user |
| POST | `/api/auth/verify-email` | Verify email token |
| POST | `/api/auth/resend-verification` | Resend verification email |
| POST | `/api/auth/login` | Login |
| POST | `/api/auth/forgot-password` | Send reset email |
| POST | `/api/auth/reset-password` | Set new password |
| GET | `/api/auth/me` | Get current user (requires Bearer token) |
| POST | `/api/auth/logout` | Logout |
| GET | `/api/health` | Health check |

---

## Auth Flow

```
User visits assessment.html
  → JS checks localStorage for cx_auth token
  → If missing/expired → redirect to login.html
  → After login → token stored in localStorage → redirect back

Email verification:
  Signup → email sent → user clicks link → verify-email.html
  → POST /api/auth/verify-email → token stored → redirect to assessment
```

---

## Production deployment (Render.com — free tier)

1. Push `server/` folder to GitHub
2. Create new Web Service on render.com
3. Build command: `npm install`
4. Start command: `npm start`
5. Add all .env variables in Render dashboard
6. Update `FRONTEND_URL` to your production domain
7. Update `API` constant in all HTML files from `http://localhost:3001` to your Render URL
