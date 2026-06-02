import React from "react";

const INSTRUCTIONS = {
  today: (
    <>
      <p>
        <strong>Add tasks:</strong> Use <em>Type</em> with a time (e.g. 4pm) and optional day (tomorrow, Friday, 3/26/26). <em>Details</em> uses the time picker, category, repeat, energy, and optional workout type.
      </p>
      <p>
        <strong>Task notes:</strong> On Today, tap the small <strong>▸ / ▾</strong> arrow on a task row to open details; notes live there only. The <strong>⋯</strong> menu is for move, delete, time, lists, etc.
      </p>
      <p>
        <strong>Navigation:</strong> Use the <strong>Navigation</strong> section to choose what appears in the bottom nav bar vs on Home only. Drag between sections, tap × to remove from the nav, or tap <strong>Add to nav</strong>. Toggle <strong>Nav labels</strong> to show or hide names under dock icons.
      </p>
      <p>
        When you open Today, the schedule scrolls to your <strong>next incomplete</strong> task and highlights it. Routines, medications (when enabled), and dock cards stay above the timeline. Use the <strong>Plan</strong> tab and its month calendar to pick another day.
      </p>
      <p>
        <strong>Habits on Today:</strong> Each habit disappears from the card after you tap <strong>Did it</strong> / <strong>Not today</strong> (or <strong>Avoided</strong> / <strong>Slip</strong> for break habits). When every habit is logged for that day, the whole Habits section hides on home. While some are still open, tap the <strong>▾</strong> at the bottom of the card to view or change ones you already marked. After the card is gone, open <strong>You → Habits</strong> to review or edit that day&apos;s log.
      </p>
      <p>
        <strong>Today&apos;s menu:</strong> If you turned on <strong>View on home page</strong> under Health → Macros → Weekly menu, today&apos;s planned meals appear here with a serving picker. Log anything different in <strong>Health → Macros</strong>; partial portions use the serving picker before <strong>I had this</strong>.
      </p>
      <p>
        <strong>Weekly repeat:</strong> For tasks set to repeat weekly, use <strong>⋯ → Repeat on days</strong> to choose which weekdays they appear (not every day of the week unless you want that).
      </p>
      <p>
        <strong>Today’s Capacity bars:</strong> Percentages reflect completes, moved to tomorrow, deletes, unchecking, and (if enabled) missed-at-day-end logs, plus your all-done streak and whether your last seven scheduled days were all finished.
      </p>
    </>
  ),
  plan: (
    <>
      <p>
        <strong>Monthly objectives</strong> also live on the Goals tab; here on Plan they stay separate from your hourly timeline until you turn them into tasks.
      </p>
      <p>
        <strong>Today&apos;s list</strong> (or the day you pick in the <strong>month calendar</strong> at the bottom) is a flat checklist of incomplete tasks, sorted with heavier energy first. No timeline or quick-add here; that lives on Today. Use <strong>⋯</strong> for options; tap a date on the calendar to change days.
      </p>
    </>
  ),
  coach: (
    <>
      <p>
        The Coach tab shows <strong>pattern insights</strong> (peak time, categories, sleep correlation) from your real usage, then the coach conversation below.
      </p>
      <p>Suggestions need your <strong>Approve</strong> before anything is added. Workout <em>programs</em> from Coach save under Health → My programs when approved, then the app opens the Health tab so you can edit or schedule them.</p>
      <p>Choose <strong>Schedule</strong>, <strong>Fitness</strong>, or <strong>Finance</strong>, then tap the main coach button. Schedule mode can apply timeline actions; fitness and finance return suggestions you approve (including wish list items, grocery lines, and savings).</p>
      <p>
        Optional <strong>Get to know you</strong> fields (expand on Coach) give the coach stable context; update anytime. Your first 30 days include unlimited coach prompts; after that, free includes 2 per day and Pro is unlimited.
      </p>
    </>
  ),
  notes: (
    <>
      <p>
        Use <strong>This day</strong> for notes tied to the calendar day you have selected on Today (reflections, logs, or anything day-specific). Use <strong>All notes</strong> for workspace-wide entries not tied to a calendar day.
      </p>
      <p>
        Pick a <strong>subject</strong> when adding (or change it from the ⋯ menu) and filter the list with <em>Organize by subject</em>. Check the circle to cross off a note and move it to <strong>Archive</strong>; open Archive and uncheck to restore.
      </p>
      <p>Search still filters the current view. Tap a search result to jump to that note.</p>
    </>
  ),
  timers: (
    <>
      <p>
        <strong>Focus timer:</strong> Choose a preset, start a session, and pause or reset anytime. From a task’s <strong>⋯</strong> menu, <strong>Start timer</strong> links the session to that task. Completed sessions appear under <strong>History</strong> with the task name, whether you checked the task off, and how long the timer was set for.
      </p>
      <p>
        <strong>Alarms:</strong> Pick a built-in sound or <strong>Your music</strong> (MP3/M4A from Files). On iPhone, Music → Share → Save to Files, then import in Timers. Re-save the alarm after changing sound so the system alarm uses your clip.
      </p>
      <p>
        When an alarm fires, PROYOU opens to a full-screen wake-up screen. <strong>Math wake-up</strong> and <strong>Writing wake-up</strong> keep the alarm sounding until you complete the challenge. Standard and Gentle can be dismissed with one tap once the app is open. Tap the notification to open PROYOU if the app was in the background.
      </p>
    </>
  ),
  finance: (
    <>
      <p>
        Quick-add: <strong>+amount</strong> for income, <strong>-amount</strong> or &quot;50 label&quot; for spending. Coach uses what you log, not medical or investment advice.
      </p>
      <p>
        Below the month snapshot, each block (savings through month summaries) is a collapsible section: tap the row to expand or collapse.
      </p>
      <p>
        <strong>Savings &amp; debt:</strong> totals are the sum of listed accounts; update balances when you pay debt down. <strong>Credit score</strong> log is optional.
      </p>
      <p>
        <strong>Subscriptions:</strong> due day 1-31 surfaces a pay reminder on your schedule that day each month. <strong>Bills:</strong> due date drives the reminder.
      </p>
      <p>
        <strong>Bank / statement notes</strong> give Coach context for patterns. When the calendar month rolls over, last month&apos;s income and spending roll into a saved overview.
      </p>
    </>
  ),
  health: (
    <>
      <p>
        <strong>Programs:</strong> Open <em>Build a program</em> to add exercises and save to My programs. Use the <strong>My programs</strong> dropdown to pick one program at a time (search inside the menu). Under <strong>Weekly routine order</strong>, stack programs for rotation; saving a plan keeps them as separate programs (not one merged list). Programs in your weekly order use <strong>Add to this week</strong> to schedule on the calendar. Gym tasks: <strong>Next in weekly routine</strong> follows that order; <strong>Auto-pick</strong> picks a random program. <strong>Begin workout</strong> sits under the task on Today. Coach can suggest a program; approve in the Coach tab and it appears here.
      </p>
      <p>
        <strong>Macros:</strong> Set age, height, and weight, then use the calculator (Mifflin-St Jeor × activity, adjusted for goal) and <strong>Apply</strong> for tracker bars. Log meals per day; use <strong>Scan nutrition label</strong> on the iPhone app to read P/C/F/calories from a package photo. <strong>Meal prep mode</strong> copies one meal to the week days you select. <strong>Weekly menu</strong> plans meals for each weekday; turn on <strong>View on home page</strong> to see today&apos;s menu on Today - use the serving picker for partial portions, or log anything different here in Macros. <strong>Ask Coach for weekly meal plan</strong> (in the calculator) sends your diet and protein targets to Coach; approve <strong>Add to weekly menu</strong> or <strong>Edit in Macros</strong>. <strong>Shopping lists</strong> can auto-fill from logged meals, suggested day plans, or coach grocery lines.
      </p>
      <p>
        <strong>Exercise overview</strong> (Workouts tab) tracks gym and program-linked tasks you add and complete vs your weekly goal. <strong>Macro overview</strong> (Macros tab) sums meals per day. Set <strong>Workouts per week</strong> under Programs. Pick a day at the top of Macros to log or edit that date.
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
        <strong>Attach a saved list:</strong> Pick a task on real today and a saved list; <strong>Apply</strong> replaces that task&apos;s checklist lines.
      </p>
      <p>
        <strong>Shopping prompt (matching tasks):</strong> If a task matches your keywords, you can attach a checklist; keywords are editable here under Shopping &amp; errand lists.
      </p>
      <p>
        <strong>Theme:</strong> Accent / palette for the app.
      </p>
      <p>
        <strong>Notifications &amp; reminders</strong> opens the full screen for permissions, task defaults, timing, habit cadence, quiet hours, and per-habit toggles; see <strong>Instructions</strong> on that screen for platform details (iOS, Android, browser).
      </p>
      <p>
        <strong>Home screen widgets (iPhone):</strong> After building the native app, long-press your home screen → add widget → choose PROYOU. Options include <strong>Today&apos;s tasks</strong>, <strong>Habits</strong>, or <strong>Tasks &amp; habits</strong>. Widgets update when you open the app or change tasks and habits.
      </p>
      <p>
        <strong>Accountability:</strong> Open from Settings or the <strong>You</strong> tab to invite friends, share selected progress (opt-in), create shared tasks, and manage privacy. Referral rewards grant bonus Pro time when friends qualify - not a substitute for App Store billing. Nothing is shared by default; meds and private notes are never shareable.
      </p>
      <p>
        <strong>Guides &amp; tours:</strong> Replay the quick tab overview or the full walkthrough anytime. Exiting early does not mark complete; finishing the last slide does.
      </p>
      <p>
        <strong>Account:</strong> With Firebase enabled, you sync across devices. <strong>Guest</strong> is this browser only until you link an account. <strong>Delete account / guest data</strong> runs a short flow; removal is permanent, then this device reloads. <strong>Birthday</strong> as MMDD (e.g. 0315) for an in-app greeting.
      </p>
    </>
  ),
  you: (
    <>
      <p>
        <strong>You</strong> is your profile hub: habits (add, edit, and change today&apos;s check-ins when the Today habits card is hidden), morning and wind-down routines, and <strong>Navigation</strong> (same controls as Settings → Customization) to choose dock tabs vs home-only modules.
      </p>
      <p>
        Opening a module from here that is not in your bottom nav may offer <strong>Show in nav bar?</strong> at the top of that tab.
      </p>
      <p>
        <strong>Accountability</strong> (friends, invites, shared tasks, privacy, referrals) lives here and under Settings. Sign in with cloud sync to use it; the rest of ProYou works fully without friends.
      </p>
    </>
  ),
  monthly: (
    <>
      <p>
        <strong>Monthly objectives</strong> are a few big outcomes for the calendar month. They do not appear on your hourly Today timeline until you break them into tasks.
      </p>
      <p>
        The same objectives also appear at the top of <strong>Plan</strong>. Coach can reference neglected goals when suggesting next steps.
      </p>
    </>
  ),
  medications: (
    <>
      <p>
        Add medications with name, dose notes, and schedule slots (morning, afternoon, evening, bedtime). Tap ⋯ on a med to edit or remove it. Set reminder times per med when Pro or your app trial includes meds.
      </p>
      <p>
        On <strong>Today</strong>, due meds for the real calendar day show as a checklist you can mark taken or skip. This is for your own tracking - not medical advice; confirm schedules with a clinician.
      </p>
      <p>
        Medication details are private and are never included in accountability sharing.
      </p>
    </>
  ),
  insights: (
    <>
      <p>
        <strong>Insights</strong> charts completion trends, streaks, and patterns from your last two weeks of scheduled tasks (when you have logged days).
      </p>
      <p>
        Pattern cards on the <strong>Coach</strong> tab (peak time, categories, sleep) use the same underlying data for quick reads without opening this tab.
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
 * @param {string} tab - Main tab id, or `"settings"` with `settingsSubView`.
 * @param {"main"|"notifications"} [settingsSubView] - When `tab === "settings"`, which copy to show.
 * @param {boolean} [compact] - Tighter spacing (e.g. inside Settings modal).
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
