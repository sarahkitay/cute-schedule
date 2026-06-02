# Deploy social / invite Firestore rules

Accountability (invite codes, friends, referrals) uses collections beyond `schedules/`. If **Generate my code** shows *Missing or insufficient permissions*, the app is signed in but your Firebase project still has old rules.

## One-time deploy

From the repo root (with [Firebase CLI](https://firebase.google.com/docs/cli) installed and logged in):

```bash
# Use the same project as VITE_FIREBASE_PROJECT_ID in .env.local
firebase use YOUR_PROJECT_ID

firebase deploy --only firestore
```

That publishes `firestore.rules` and `firestore.indexes.json`.

## Verify in Console

Firebase Console → Firestore → **Rules** should include `match /user_profiles/{uid}` with read/write for the signed-in owner, plus `friend_requests`, `friendships`, `share_snapshots`, `shared_tasks`, `referrals`, and `referral_rewards`.

After deploy, force-quit the app and try **Generate my code** again.
