import React from "react";

const INSTRUCTIONS = {
  today: (
    <>
      <p>
        <strong>Add tasks:</strong> Use <em>Type</em> with a time (e.g. 4pm), a range (e.g. <em>numen group 10am to 5pm</em>, <em>dinner 5-7pm</em>), and optional day (tomorrow, Friday, 3/26/26). <em>Details</em> uses the time picker, category, repeat, energy, and optional workout type.
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
        Tap a day on the <strong>month calendar</strong> to open a preview of what&apos;s planned, quick-add a task to that day, or <strong>Go to this day</strong> on Home.
      </p>
      <p>
        Double-tap a day to jump straight to Home for that date. While you&apos;re viewing another day on Home, use <strong>Back to today</strong> at the top.
      </p>
    </>
  ),
  coach: (
    <>
      <p>
        The Coach tab shows <strong>pattern insights</strong> (peak time, categories, sleep correlation) from your real usage, then the coach conversation below.
      </p>
      <p>Suggestions need your <strong>Approve</strong> before anything is added. Workout <em>programs</em> from Coach save under Health → My programs when approved, then the app opens the Health tab so you can edit or schedule them.</p>
      <p>
        <strong>Talk to Coach:</strong> Tap the mic and say everything you have to do (times included if you know them). Coach turns that into a timed schedule. Nothing is added until you tap <strong>Approve</strong> (or <strong>Approve all</strong>). You can also type. Use <strong>Read aloud</strong> to hear Coach’s reply.
      </p>
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
        <strong>Lists</strong> holds saved shopping and errand checklists, keyword triggers, and attaching a list to a task on Today. Save lists from a task&apos;s checklist modal or manage them here.
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
        <strong>Timer alerts:</strong> On iPhone with Alarms allowed for PROYOU, focus timers use the system alarm when time is up (like Clock). Allow Alarms in Settings. On older iOS or without alarm permission, notifications are used instead.
      </p>
      <p>
        <strong>Lock Screen countdown:</strong> To see the timer ticking on your Lock Screen while it runs, add a PROYOU <strong>home screen widget</strong> (Today&apos;s tasks, Habits, or Tasks &amp; habits) and turn on <strong>Live Activities</strong> for PROYOU in Settings. The in-app countdown always works without the widget.
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
        <strong>Macros:</strong> Set age, height, and weight, then use the calculator (Mifflin-St Jeor × activity, adjusted for goal) and <strong>Apply</strong> for tracker bars. Log meals per day; use <strong>Camera</strong> / <strong>Photos</strong> to estimate macros from a plated meal, or <strong>Scan label</strong> on the iPhone app to read P/C/F/calories from a package. <strong>Meal prep mode</strong> copies one meal to the week days you select. <strong>Weekly menu</strong> plans meals for each weekday; turn on <strong>View on home page</strong> to see today&apos;s menu on Today - use the serving picker for partial portions, or log anything different here in Macros. <strong>Ask Coach for weekly meal plan</strong> (in the calculator) sends your diet and protein targets to Coach; approve <strong>Add to weekly menu</strong> or <strong>Edit in Macros</strong>. <strong>Shopping lists</strong> can auto-fill from logged meals, suggested day plans, or coach grocery lines.
      </p>
      <p>
        <strong>Exercise overview</strong> (Workouts tab) tracks gym and program-linked tasks you add and complete vs your weekly goal. <strong>Macro overview</strong> (Macros tab) sums meals per day. Set <strong>Workouts per week</strong> under Programs. Pick a day at the top of Macros to log or edit that date.
      </p>
    </>
  ),
  settingsMain: (
    <>
      <p>
        <strong>Bottom navigation:</strong> <strong>Today</strong> stays first. Drag blocks to reorder. Use the ⋯ menu on a tab to remove it from the dock, add it back, or move it next to Today. The same editor lives under <strong>You → Navigation</strong>.
      </p>
      <p>
        <strong>Task completion messages:</strong> Optional pop-up when you check off a task; tap outside to dismiss. Turning affirmations off still saves the task. <strong>Tone</strong> shapes the wording.
      </p>
      <p>
        <strong>Task types:</strong> Categories used by quick-add and task rows (e.g. Work, Personal). Optional: <strong>Log missed tasks when a day ends</strong> records still-unchecked tasks after midnight for Coach and stats.
      </p>
      <p>
        <strong>Theme &amp; icon style:</strong> Accent palette and colorful vs metallic dock icons.
      </p>
      <p>
        <strong>Notifications &amp; reminders</strong> opens the full screen for permissions, task defaults, timing, habit cadence, quiet hours, and per-habit <strong>Remind</strong> toggles; see <strong>Instructions</strong> on that screen for platform details (iOS, Android, browser).
      </p>
      <p>
        <strong>Habits, routines, and lists</strong> are not edited here: add habits under <strong>You → Habits</strong> (including custom hourly or clock reminders when cadence is Custom), morning and wind-down routines under <strong>You → Routines</strong>, and shopping lists under <strong>Notes → Lists</strong>.
      </p>
      <p>
        <strong>Home screen widgets (iPhone):</strong> After building the native app, long-press your home screen → add widget → choose PROYOU. Options include <strong>Today&apos;s tasks</strong>, <strong>Habits</strong>, or <strong>Tasks &amp; habits</strong>. Widgets update when you open the app or change tasks and habits. They are also required for the focus timer Lock Screen countdown (see <strong>Timers</strong> instructions).
      </p>
      <p>
        <strong>Accountability:</strong> Open from Settings or the <strong>You</strong> tab to invite friends, share selected progress (opt-in), create shared tasks, and manage privacy. Referral rewards grant bonus Pro time when friends qualify - not a substitute for App Store billing. Nothing is shared by default; meds and private notes are never shareable.
      </p>
      <p>
        <strong>Guides &amp; tours:</strong> On first launch, choose <strong>Quick setup</strong> (name, theme, coach tone) or <strong>In-depth setup</strong> (modules, peak time, patterns, and more). Replay the quick tab overview or full walkthrough anytime here. Exiting a tour early does not mark it complete; finishing the last slide does.
      </p>
      <p>
        <strong>Account:</strong> With a cloud account, you sync across devices. <strong>Guest</strong> is this device only until you sign in. <strong>Delete account / guest data</strong> runs a short flow; removal is permanent, then this device reloads. <strong>Birthday</strong> as MMDD (e.g. 0315) for an in-app greeting.
      </p>
    </>
  ),
  you: (
    <>
      <p>
        <strong>You</strong> is your profile hub: <strong>Habits</strong> (add, remove, and custom reminder times when notifications cadence is Custom), <strong>Routines</strong> (morning and wind-down steps, show on Today toggles, weekday schedule), <strong>Navigation</strong> (dock tabs vs home-only modules), and <strong>Accountability</strong> (friends and shared tasks).
      </p>
      <p>
        After every habit is logged on Today, the habits card hides; open <strong>You → Habits</strong> to review or change that day&apos;s check-ins.
      </p>
      <p>
        Opening a module from here that is not in your bottom nav may offer <strong>Show in nav bar?</strong> at the top of that tab.
      </p>
      <p>
        <strong>Settings</strong> (gear card here or header) covers theme, task types, notifications, account, and guides - not habits, routines, or saved lists.
      </p>
    </>
  ),
  monthly: (
    <>
      <p>
        <strong>Monthly objectives</strong> are a few big outcomes for the calendar month. They do not appear on your hourly Today timeline until you break them into tasks.
      </p>
      <p>
        Unfinished objectives <strong>auto-carry</strong> into the new month. You&apos;ll get a notice that last month is over so you can <strong>Keep</strong> or <strong>Let go</strong> each one. Use <strong>Review month</strong> to browse older months.
      </p>
    </>
  ),
  accountability: (
    <>
      <p>
        Use the <strong>Invite</strong> tab to share your PY code or App Store link, or enter a friend&apos;s code to connect instantly.
      </p>
      <p>
        <strong>Privacy</strong> controls what friends can see (schedule, habits, fitness, and more). Nothing is shared until you opt in. Medications and private notes are never shared.
      </p>
      <p>
        <strong>Shared tasks</strong> let you and a friend track the same goal. Send one from Shared tasks; when they accept, it can land on their schedule labeled with your name. Tap a friend to see shared tasks and any progress they chose to share.
      </p>
      <p>
        <strong>Rewards:</strong> when someone you invited subscribes to ProYou Pro, you can earn bonus Pro time - see Rewards.
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
        <strong>Habit reminder cadence:</strong> Quiet hours apply to all modes. In-app habit checks run about every 20 seconds while the app is open. <strong>Custom</strong> uses each habit&apos;s hourly or clock list from <strong>You → Habits</strong>.
      </p>
      <p>
        <strong>Per-habit reminders:</strong> Turn off <strong>Remind</strong> for habits you don&apos;t want pinged. If the habit list is empty, add habits under <strong>You → Habits</strong>.
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
 * @param {string} [summary] - Collapsible summary label.
 */
export function PageInstructions({ tab, settingsSubView = "main", compact, summary = "Instructions" }) {
  let body;
  if (tab === "settings") {
    body = settingsSubView === "notifications" ? INSTRUCTIONS.settingsNotifications : INSTRUCTIONS.settingsMain;
  } else {
    body = INSTRUCTIONS[tab];
  }
  if (!body) return null;
  return (
    <details className={["page-instructions-bar", "surface-glass", compact ? "page-instructions-bar--compact" : ""].filter(Boolean).join(" ")}>
      <summary className="page-instructions-summary">{summary}</summary>
      <div className="page-instructions-panel">{body}</div>
    </details>
  );
}
