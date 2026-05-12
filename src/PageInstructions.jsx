import React from "react";

const INSTRUCTIONS = {
  today: (
    <>
      <p>
        <strong>Add tasks:</strong> Use <em>Type</em> with a time (e.g. 4pm) and optional day (tomorrow, Friday, 3/26/26). <em>Details</em> uses the time picker, category, repeat, energy, and optional workout type.
      </p>
      <p>
        <strong>Task notes:</strong> On Today, tap the small <strong>▸ / ▾</strong> arrow on a task row to open details — notes live there only. The <strong>⋯</strong> menu is for move, delete, time, lists, etc.
      </p>
      <p>
        When you open Today, the schedule scrolls to your <strong>next incomplete</strong> task and highlights it. Habits, routines, and dock cards stay above the timeline.
      </p>
      <p>
        <strong>Today’s Capacity bars:</strong> Percentages reflect completes, moved to tomorrow, deletes, unchecking, and (if enabled) missed-at-day-end logs — plus your all-done streak and whether your last seven scheduled days were all finished.
      </p>
    </>
  ),
  list: (
    <p>
      Incomplete tasks for the selected day, sorted with heavier energy first. Use <strong>⋯</strong> for options; task notes are in that menu on List (there is no expand row here).
    </p>
  ),
  monthly: <p>Set month-level objectives; they stay out of your daily timeline until you work them into tasks.</p>,
  coach: (
    <>
      <p>Suggestions need your <strong>Approve</strong> before anything is added. Workout <em>programs</em> from Coach save under Health → My programs when approved.</p>
      <p>Structured modes (plan / unstuck / review) may return timebox or reorder actions — apply from the buttons shown.</p>
      <p>
        Optional <strong>Get to know you</strong> fields (expand on Coach) give the coach stable context; update anytime.
      </p>
    </>
  ),
  notes: <p>Search filters the list; add notes with the form at the top. Tap a search result to jump to that note.</p>,
  finance: (
    <>
      <p>
        Quick-add: <strong>+amount</strong> for income, <strong>-amount</strong> or &quot;50 label&quot; for spending. Coach uses what you log — not medical or investment advice.
      </p>
      <p>
        <strong>Savings &amp; debt:</strong> totals are the sum of listed accounts; update balances when you pay debt down. <strong>Credit score</strong> log is optional.
      </p>
      <p>
        <strong>Subscriptions:</strong> due day 1–31 surfaces a pay reminder on your schedule that day each month. <strong>Bills:</strong> due date drives the reminder.
      </p>
      <p>
        <strong>Bank / statement notes</strong> give Coach context for patterns. When the calendar month rolls over, last month&apos;s income and spending roll into a saved overview.
      </p>
    </>
  ),
  health: (
    <>
      <p>
        <strong>Programs:</strong> Open <em>Build a program</em> to add exercises and save to My programs. <strong>Weekly routine order</strong> plus <em>Repeat in order</em> or <em>Shuffle</em> controls
        auto / queue workout picks. Coach can suggest a program — approve in the Coach tab and it appears here.
      </p>
      <p>
        <strong>Macros:</strong> Set age, height, and weight, then use the calculator (Mifflin–St Jeor × activity, adjusted for goal) and <strong>Apply</strong> for tracker bars. Log meals per day; <strong>Meal prep mode</strong> copies one meal to the week days you select.
      </p>
      <p>
        <strong>Macro overview</strong> sums all meals saved per day. Pick a day at the top of Macros to log or edit that date. Fill profile fields to unlock <strong>Workout</strong> in Today&apos;s quick-add Details.
      </p>
    </>
  ),
  settingsMain: (
    <>
      <p>
        <strong>Habit tracker:</strong> Habits are build or break; Today asks once per day. <strong>Reminder nudges</strong> (cadence, quiet hours, on/off per habit) live under <strong>Notifications &amp; reminders</strong>. When that screen is set to <strong>Custom</strong>, you can choose hourly vs clock times per habit here; otherwise nudges follow the global cadence there.
      </p>
      <p>
        <strong>Bottom navigation:</strong> <strong>Today</strong> stays first. Drag blocks to reorder. Use the ⋯ menu on a tab to remove it from the dock, add it back, or move it next to Today.
      </p>
      <p>
        <strong>Task completion messages:</strong> Optional pop-up when you check off a task; tap outside to dismiss. Turning affirmations off still saves the task. <strong>Tone</strong> shapes the wording.
      </p>
      <p>
        <strong>Morning / wind-down routines:</strong> Optional steps that can appear on Today; use the day chips to choose which weekdays (or every day).
      </p>
      <p>
        <strong>Task types:</strong> Categories used by quick-add and task rows (e.g. Work, Personal).
      </p>
      <p>
        <strong>Shopping &amp; errand lists:</strong> When a task title contains a <strong>whole-word</strong> keyword (comma-separated list), the app can offer a checklist. Defaults are similar to grocery / store / errand. <strong>Saved lists</strong> come from the checklist modal or the attach flow below. <strong>Log missed tasks when a day ends</strong> records still-unchecked tasks after midnight for Coach and stats (optional).
      </p>
      <p>
        <strong>Attach a saved list:</strong> Pick a task on real today and a saved list — <strong>Apply</strong> replaces that task&apos;s checklist lines.
      </p>
      <p>
        <strong>Shopping prompt (matching tasks):</strong> If a task matches your keywords, you can attach a checklist; keywords are editable here under Shopping &amp; errand lists.
      </p>
      <p>
        <strong>Theme:</strong> Accent / palette for the app.
      </p>
      <p>
        <strong>Notifications &amp; reminders</strong> opens the full screen for permissions, task defaults, timing, habit cadence, quiet hours, and per-habit toggles — see <strong>Instructions</strong> on that screen for platform details (iOS, Android, browser).
      </p>
      <p>
        <strong>Guides &amp; tours:</strong> Replay the quick tab overview or the full walkthrough. Exiting early does not mark complete; finishing the last slide does.
      </p>
      <p>
        <strong>Account:</strong> With Firebase enabled, you sync across devices. <strong>Guest</strong> is this browser only until you link an account. <strong>Delete account / guest data</strong> runs a short flow — removal is permanent, then this device reloads. <strong>Birthday</strong> as MMDD (e.g. 0315) for an in-app greeting.
      </p>
    </>
  ),
  settingsNotifications: (
    <>
      <p>
        On the <strong>native app</strong>, use <strong>Allow notifications and sync reminders</strong> once to schedule on-device task alerts (where supported), allow remote delivery, and sync your reminder list. Use <strong>Open system settings</strong> if you previously chose Don&apos;t allow.
      </p>
      <p>
        <strong>iPhone:</strong> Task times use scheduled local alerts for each task with Remind me (before start and/or at start). Remote registration is a backup path when the app is not in the foreground; behavior depends on iOS and battery settings.
      </p>
      <p>
        <strong>Android:</strong> Task reminders use push and system notification settings; battery saver can delay delivery.
      </p>
      <p>
        <strong>Browser:</strong> <strong>Allow notifications and background reminders</strong> requests permission plus optional push when your deployment supports it. In-browser reminders still need the tab or site allowed by the browser.
      </p>
      <p>
        <strong>Master switches</strong> control task delivery and habit nudges. <strong>Default reminders for new tasks</strong> sets what new tasks start with; change any task under Details → Remind me.
      </p>
      <p>
        <strong>Delivery summary:</strong> iPhone schedules local reminder times when Remind me is on. Android follows push and permission. Browser depends on permission and push. <strong>Habits</strong> use the cadence and quiet hours here for in-app nudges while you use the app; the same schedule is stored for backup pings when you are away. Frequent habit modes can be batched or delayed by the OS when the app is closed; quiet hours still apply.
      </p>
      <p>
        <strong>Task reminder timing</strong> syncs preferences to the server and drives on-device scheduling on iPhone when Remind me is on. Per-task overrides stay on the task card. <strong>Apply as defaults for new tasks</strong> copies the current timing section into the defaults above.
      </p>
      <p>
        <strong>Habit reminder cadence:</strong> Quiet hours apply to all modes. In-app habit checks run about every 20 seconds while the app is open. <strong>Custom</strong> uses each habit&apos;s hourly or clock list from Settings → Customization → Habit tracker.
      </p>
      <p>
        <strong>Per-habit reminders:</strong> Turn off <strong>Remind</strong> for habits you don&apos;t want pinged. If the habit list is empty, add habits under Customization → Habit tracker.
      </p>
      <p>
        <strong>Background reminders (browser):</strong> Optional push connects this device to your deployment so pings can arrive after you close the tab. On iPhone Safari, add the app from the Share menu first. After connecting, use <strong>Send test</strong> to confirm.
      </p>
    </>
  ),
};

/**
 * Collapsible help strip at the bottom of a scroll area (main tabs or Settings modal).
 * @param {string} tab — Main tab id, or `"settings"` with `settingsSubView`.
 * @param {"main"|"notifications"} [settingsSubView] — When `tab === "settings"`, which copy to show.
 * @param {boolean} [compact] — Tighter spacing (e.g. inside Settings modal).
 */
export function PageInstructions({ tab, settingsSubView = "main", compact }) {
  let body;
  if (tab === "settings") {
    body = settingsSubView === "notifications" ? INSTRUCTIONS.settingsNotifications : INSTRUCTIONS.settingsMain;
  } else {
    body = INSTRUCTIONS[tab];
  }
  if (!body) return null;
  return (
    <details className={["page-instructions-bar", "surface-glass", compact ? "page-instructions-bar--compact" : ""].filter(Boolean).join(" ")}>
      <summary className="page-instructions-summary">Instructions</summary>
      <div className="page-instructions-panel">{body}</div>
    </details>
  );
}
