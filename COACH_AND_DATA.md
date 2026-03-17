# Coach data, Firebase persistence, and notifications

## What the coach reads (and how it all works together)

The coach receives one combined payload so it can give personalized, data-aware advice.

### 1. **Today (schedule + progress)**
- **`today`** – All time slots and tasks for the selected day (from `appState.days[tKey].hours`).
- **`progress`** – `{ total, done, pct }` for that day (how many tasks, how many done, completion %).
- **`completedToday` / `totalTasks`** – Same idea, used for copy and suggestions.
- **`energyBalance`** – Light vs medium vs heavy tasks so the coach can comment on load.
- **`timeOfDay`** – Morning / afternoon / evening (for tone and timing).
- **`emotionalState`** – Inferred from completion pattern (e.g. “on a roll”, “stuck”).

### 2. **List**
- The **list** view uses the same `today` data for the selected day (same `tKey`). The coach does not get a separate “list” feed; it already sees all tasks for the day in `today`.

### 3. **Monthly objectives**
- **`monthly`** – Array of `{ id, text, done }` for big-picture goals.
- The coach uses this to suggest what to prioritize today and to nudge unfinished objectives.

### 4. **Notes**
- **`notes`** – Up to 50 notes `{ text, createdAt }`.
- Used for context (e.g. “you wrote about X”) and to tie advice to what you’re thinking about.

### 5. **Finance**
- **`billsDueSoon`** – Bills with `dueDate >= today`, next 10.
- **`subscriptions`** – Name, amount, `dueDay` (so the coach can say “subscription Y is due soon”).
- **`finance`** – Aggregates for the current month and totals:
  - `incomeThisMonth`, `spentThisMonth`
  - `totalSavings`, `totalDebt`, `totalInvestments`
  - `wishList`, `bankStatementNotes` (trimmed)
- The coach uses this to remind about due dates and to tie habits to money (e.g. “you’re on track with spending this month”).

### 6. **Patterns (past behavior)**
- **`patterns`** – From `analyzePatterns()`:
  - **`bestTime`** – Time of day you complete most tasks.
  - **`leastCompletedCategory`** / **`leastCompletedRate`** – Category you complete least often.
  - **`todayCompletions`** / **`totalCompletions`** – Completion counts.
  - **`sleepCorrelation`** – Bedtime routine vs next-day completion (when data exists).
- The coach uses this to say things like “you do best in the morning” or “Work tasks often get left behind.”

### 7. **User profile (get-to-know-you)**
- **`userProfile`** – If the user has filled the “Get to know you” form:
  - `biggestChallenge`, `bestEnergyTime`, `oneGoal`
- Lets the coach personalize advice (e.g. “you said your biggest challenge is overcommitting”).

### How they work together
- The coach gets **today + list** (same day data), **monthly**, **notes**, **finance**, **patterns**, and **userProfile** in one request.
- The backend can cross-reference: e.g. “today is light, monthly has 2 unfinished goals, and you have a bill due tomorrow” → suggest one goal and one finance task.
- Optimizing = using patterns (best time, weak category), finance (due dates), and monthly (goals) to suggest what to do **today** and when.

---

## Making sure all tasks are saved (Firebase)

- **Current behavior:** All app state (including every day’s tasks in `appState.days`) is saved with **`saveState(appState)`** to **localStorage** under `STORAGE_KEY` (`cute_schedule_v3`). So tasks do **not** disappear the next day as long as the user uses the same browser/device.
- **To persist across devices and avoid loss on clear data:** Use **Firebase** (or another backend) and wire it into the same state.

### Option A – Use `cloudStorage.js` (recommended)
1. In **`src/cloudStorage.js`**:
   - In **`save(data)`**: after writing to localStorage, call your Firebase API (e.g. Firestore `set` for the current user’s document) with the same `data` (or with `{ categories: data }` if you keep the current shape).
   - In **`load()`**: try Firebase first; if it returns data, use it; otherwise fall back to `localStorage.getItem(this.storageKey)` as now.
2. In **`App.jsx`**:
   - Where **`saveState(appState)`** is called (in the `useEffect` that depends on `appState`), also call **`cloudStorage.save(appState)`** (and ensure the key matches what `load()` expects).
   - On init, if you want cloud-first: **`loadState()`** could call **`await cloudStorage.load()`** and, when not null, use that instead of localStorage for the initial `appState`.

Result: the same state (all days, all tasks) is stored in Firebase and optionally in localStorage as cache, so tasks don’t disappear and they sync across devices once you add auth.

### Option B – Replace `loadState` / `saveState` entirely
- **`loadState()`** becomes async and returns `await cloudStorage.load()` (with a fallback to localStorage if you want).
- **`saveState(state)`** calls `localStorage.setItem(...)` and `cloudStorage.save(state)` (or only Firebase if you prefer).
- App init must handle async load (e.g. show a short loading state until state is ready).

---

## Notifications when the app is closed (web / PWA)

- **In-app notifications** (e.g. “Next up: …”) work while the tab is open.
- **When the app is closed or in the background**, the browser (or PWA) can still show notifications only if:
  1. **Push is enabled** (e.g. via the “Enable Push Notifications” flow that uses `notificationService`), and  
  2. A **backend** sends push messages (e.g. Firebase Cloud Messaging, or your own push service).

So for “notifications when the app is closed and deployed as a web app”:

1. **Deploy as PWA** – So users can “Add to Home Screen” and the service worker can receive push.
2. **Backend job** – A cron or serverless function that:
   - Reads reminders / due tasks (from Firebase or your DB).
   - Sends push payloads (e.g. FCM) to the right user devices at the right time.
3. **Service worker** – Already set up to receive push and show notifications when the client uses the right VAPID keys and subscription.

The app’s **Settings → Push (PWA)** flow prepares the client; you still need the **server-side sender** (and, if you use Firebase, Firestore + Cloud Functions or similar) so that reminders actually fire when the app is closed.

---

## Summary

| Topic | What’s true now | What to do for your goals |
|--------|------------------|----------------------------|
| **Coach data** | Reads today, monthly, notes, finance, patterns, userProfile in one payload. | Use the same payload on the backend to optimize suggestions. |
| **Tasks saved** | Saved to localStorage only; they don’t disappear day-to-day on same device. | Wire `cloudStorage.save/load` to Firebase and call it from `saveState`/init so tasks persist and sync. |
| **Notifications when closed** | In-app only unless push is set up. | Add backend that sends push (e.g. FCM) on a schedule so reminders work when the app is closed. |
