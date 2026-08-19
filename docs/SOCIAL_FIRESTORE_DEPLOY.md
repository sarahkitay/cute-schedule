# Deploy social / invite Firestore rules

Accountability (invite codes, instant friends, shared task invites, referrals) uses collections beyond `schedules/`. If **Add friend** or **Generate my code** shows *Missing or insufficient permissions*, deploy the latest Firestore rules (see below).

## One-time deploy

From the repo root (with [Firebase CLI](https://firebase.google.com/docs/cli) installed and logged in):

```bash
# Use the same project as VITE_FIREBASE_PROJECT_ID in .env.local
firebase use YOUR_PROJECT_ID

firebase deploy --only firestore
```

That publishes `firestore.rules` and `firestore.indexes.json`.

## Verify in Console

Firebase Console → Firestore → **Rules** should include `match /user_profiles/{uid}` (get for owner and friends only; no collection list), `invite_codes` (signed-in get by code), plus `friend_requests`, `friendships` (create only with an accepted incoming request or the other user's invite code), `share_snapshots`, `shared_tasks` (membership starts as creator-only), `referrals`, and `referral_rewards` (create only for a real referral you own as referrer).

After deploy, force-quit the app and try **Generate my code** again.
