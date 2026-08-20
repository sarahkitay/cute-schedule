import React, { useState } from "react";

const QUICK_SLIDES = [
  {
    title: "Today: your home base",
    body:
      "The Today tab is your timeline: tasks show by time of day. **Above the add field**, use **Type** for plain language (for example Call Sam 2pm) or **Details** to set **time**, **category**, **repeat**, and **energy** before you tap Add task. Under **Daily Progress**, a separate **Type / Details** switch only changes how full each task row is on the timeline: **Type** stays minimal; **Details** shows extra controls on each card (like energy).",
  },
  {
    title: "Plan & quick wins",
    body:
      "**Plan** holds a scrollable task list for the day plus a **month calendar** at the bottom to change days - great for checking things off without the full Today timeline. Monthly objectives also live on **Goals** and at the top of Plan.",
  },
  {
    title: "Coach, notes & money",
    body:
      "**Coach** uses your real schedule and habits for gentle check-ins. **Notes** uses **This day**, **All notes**, or **Lists** (saved shopping checklists). **Finance** tracks bills and subscriptions and can surface due dates on your day.",
  },
  {
    title: "You & Settings",
    body:
      "**You** is where you add **habits**, **routines**, and customize **navigation**. **Settings** covers theme, task types, notifications, account, and guides. On first launch, pick **Quick setup** or **In-depth setup** - you can change everything later.",
  },
];

const FULL_SLIDES = [
  {
    title: "What PROYOU is for",
    body:
      "PROYOU is a day planner with kindness built in: tasks by time, habits you build or break, optional coach prompts, and space for notes and money reminders, all in one calm layout.",
  },
  {
    title: "Today tab & the timeline",
    body:
      "Each **time block** holds tasks by category. Tap the small **▸ / ▾** on a row to open details (including **private notes** for that task). Use **⋯** for move to another day, edit time, shopping lists, and more; notes stay on the expand panel on Today. Every main tab has a small **Instructions** strip at the bottom for full help.",
  },
  {
    title: "Adding tasks: Type vs Details (top bar)",
    body:
      "At the top of Today, switch **Type** to speak naturally (for example Water plants 4pm Work). Switch **Details** on that same bar to use the **time** field, **category**, **repeat** menu (none, daily, weekly, or optional repeat), and **energy** pills before you tap **Add task**.",
  },
  {
    title: "Daily Progress: Type vs Details (timeline)",
    body:
      "Under **Daily Progress**, **Type** keeps each timeline row simple so you can check tasks off quickly. **Details** shows more on each card (energy controls, delete, and similar) while you arrange the day. This is separate from **Details** on the add bar, which is only for new tasks.",
  },
  {
    title: "Plan tab",
    body:
      "**Plan** combines **monthly objectives** with a **today's list** view: a flat checklist for the selected day, sorted with heavier-energy items first. Check off here and it stays in sync with Today, without repeating the full home timeline.",
  },
  {
    title: "Monthly objectives",
    body:
      "In **Plan**, monthly objectives sit above your daily list: a few big outcomes that should not crowd your hourly schedule on Today.",
  },
  {
    title: "Coach",
    body:
      "The **Coach** tab uses your patterns and picks a focus: **Schedule**, **Fitness**, or **Finance**. Tap the big coach button for that mode, or ask a follow-up question. Suggestions need your approval before anything is added.",
  },
  {
    title: "Notes, lists & Finance",
    body:
      "**Notes**: **This day** pins entries to the calendar day on Today; **All notes** keeps workspace-wide reflections; **Lists** stores shopping and errand checklists. **Finance** tracks bills and subscriptions; due items can appear as gentle reminders when configured.",
  },
  {
    title: "Timers",
    body: "**Timers** (when in your nav) covers focus presets with iOS notification sounds when time is up - even if PROYOU is in the background. Allow notifications for PROYOU in Settings.",
  },
  {
    title: "Habits & reminders",
    body:
      "Add build/break habits under **You → Habits**. When notifications cadence is **Custom**, set hourly or clock times per habit there. In **Settings → Notifications**, turn **Remind** on or off per habit and allow notifications so alerts work on your device.",
  },
  {
    title: "You tab: routines & nav",
    body:
      "**You → Routines** edits morning and wind-down steps, **Show on Today** toggles, and which weekdays they run. **You → Navigation** matches Settings dock editing. **Accountability** (friends, shared tasks) also lives on You.",
  },
  {
    title: "Routines & capacity",
    body:
      "Morning and **wind-down** routines appear on Today when enabled from **You → Routines**. **Today's Capacity** (mood and energy pills) nudges the coach and your self-awareness: optional metadata, not a grade.",
  },
  {
    title: "Instructions on each tab",
    body:
      "Longer help lives in the **Instructions** bar at the bottom of each main tab (Today, Plan, Goals, Coach, Notes, Finance, Health, Timers, Meds, You, Insights, and more); open it anytime. This tour is the overview; combine both when you need detail.",
  },
  {
    title: "Sync & account",
    body:
      "With cloud sync configured and an account, your schedule, notes, finance, and settings can sync across devices. Guest mode keeps data on this browser until you link an account from Settings.",
  },
  {
    title: "You are ready",
    body:
      "Use the bottom bar to jump between areas. Habits and routines live under **You**; saved lists under **Notes → Lists**; theme, notifications, and account under **Settings**. Tap **Done** below to close this tour - you can replay it anytime from **Settings → Guides & tours**.",
  },
];

/**
 * One-time (or explicit) product tour after onboarding. `mode`: quick (4) vs full (15).
 */
export function FeatureWalkthrough({ mode, onComplete, onDismiss }) {
  const slides = mode === "full" ? FULL_SLIDES : QUICK_SLIDES;
  const total = slides.length;
  const [step, setStep] = useState(0);
  const s = slides[step];
  const progress = `${step + 1} / ${total}`;
  const isLast = step >= total - 1;

  function goNext() {
    if (isLast) {
      onComplete();
      return;
    }
    setStep((x) => x + 1);
  }

  function goBack() {
    setStep((x) => Math.max(0, x - 1));
  }

  return (
    <div className="onboarding-root" role="dialog" aria-modal="true" aria-labelledby="walkthrough-title">
      <div className="onboarding-card surface-glass feature-walkthrough-card">
        <p className="onboarding-progress">{progress}</p>
        <p className="feature-walkthrough-badge">{mode === "full" ? "Full walkthrough" : "Quick tour"}</p>
        <h2 id="walkthrough-title" className="onboarding-title">
          {s.title}
        </h2>
        <div className="onboarding-lead feature-walkthrough-body">
          {s.body.split("\n").map((para, i) => (
            <p key={i} className="feature-walkthrough-para">
              {para.split("**").map((chunk, j) =>
                j % 2 === 1 ? (
                  <strong key={`${i}-${j}`}>{chunk}</strong>
                ) : (
                  <React.Fragment key={`${i}-${j}`}>{chunk}</React.Fragment>
                )
              )}
            </p>
          ))}
        </div>
        <div className="onboarding-actions feature-walkthrough-actions">
          {step > 0 && (
            <button type="button" className="btn btn-ghost" onClick={goBack}>
              Back
            </button>
          )}
          <button type="button" className="btn btn-ghost" onClick={onDismiss}>
            {isLast ? "Close without finishing" : "Exit tour"}
          </button>
          <button type="button" className="btn btn-primary" onClick={goNext}>
            {isLast ? "Done" : "Next"}
          </button>
        </div>
      </div>
    </div>
  );
}
