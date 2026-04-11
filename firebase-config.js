// ── Climactix Global · Firebase Configuration ──────────────
// Setup steps:
// 1. Go to https://console.firebase.google.com
// 2. Create a project (e.g. "climatix-global")
// 3. Go to Project Settings → General → Your apps → Add app → Web (</>)
// 4. Copy the firebaseConfig object and paste your values below
// 5. In Firebase console: Authentication → Sign-in method → Enable "Email/Password"
// 6. In Firebase console: Authentication → Settings → Enable "Email link" (optional)

import { initializeApp } from "https://www.gstatic.com/firebasejs/10.12.0/firebase-app.js";
import { getAuth } from "https://www.gstatic.com/firebasejs/10.12.0/firebase-auth.js";

const firebaseConfig = {
  apiKey:            "YOUR_API_KEY",
  authDomain:        "YOUR_PROJECT.firebaseapp.com",
  projectId:         "YOUR_PROJECT_ID",
  storageBucket:     "YOUR_PROJECT.appspot.com",
  messagingSenderId: "YOUR_SENDER_ID",
  appId:             "YOUR_APP_ID"
};

const app  = initializeApp(firebaseConfig);
const auth = getAuth(app);

export { auth };
