// ── Climactix Global · Firebase Configuration ──────────────
//
// HOW TO SET UP (5 minutes):
// 1. Go to https://console.firebase.google.com
// 2. Click "Add project" → name it "climatix-global" → Create
// 3. In the project: click the </> (Web) icon → register app → copy the config
// 4. Replace the values below with YOUR config values
// 5. Go to Authentication → Sign-in method → Enable "Email/Password"
// 6. Go to Authentication → Settings → Authorized domains → add your domain
//
// The config values are NOT secret — they are safe to commit to git.
// Security is enforced by Firebase Security Rules, not by hiding the config.

export const firebaseConfig = {
  apiKey:            "YOUR_API_KEY",
  authDomain:        "YOUR_PROJECT_ID.firebaseapp.com",
  projectId:         "YOUR_PROJECT_ID",
  storageBucket:     "YOUR_PROJECT_ID.appspot.com",
  messagingSenderId: "YOUR_SENDER_ID",
  appId:             "YOUR_APP_ID"
};
