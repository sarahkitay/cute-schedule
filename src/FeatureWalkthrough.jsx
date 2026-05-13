import React, { useState } from "react";

const QUICK_SLIDES = [
  {
    title: "Today: your home base",
    body:
      "The Today tab is your timeline: tasks show by time of day. **Above the add field**, use **Type** for plain language (for example Call Sam 2pm) or **Details** to set **time**, **category**, **repeat**, and **energy** before you tap Add task. Under **Daily Progress**, a separate **Type / Details** switch only changes how full each task row is on the timeline: **Type** stays minimal; **Details** shows extra controls on each card (like energy).",
  },
  {
    title: "List & quick wins",
    body:
      "**List** shows everything still open for the day in one scrollable list, great for checking things off on the go. **Monthly Objectives** holds bigger goals without cluttering Today.",
  },
  {
    title: "Coach, notes & money",
    body:
      "**Coach** uses your real schedule and habits for gentle check-ins. **Notes** is for thoughts and ideas. **Finance** tracks bills and subscriptions and can surface due dates on your day.",
  },
  {
    title: "Settings & habits",
    body:
      "Open **Settings** (gear) for account, themes, habit check-ins and **reminders** (hourly or custom times), task types, routines, and notifications. You can revisit anything you set during setup.",
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
      "Each **time block** holds tasks by category. Tap the small **▸ / ▾** on a row to open details (including **private notes** for that task). Use **⋯** for move to tomorrow, edit time, shopping lists, and more; notes stay on the expand panel on Today. Every main tab has a small **Instructions** strip at the bottom for full help.",
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
    title: "List tab",
    body:
      "**List** is a single view of incomplete tasks for the selected day, sorted with heavier-energy items first. Check off here and it stays in sync with the timeline on Today.",
  },
  {
    title: "Monthly objectives",
    body:
      "**Monthly Objectives** is for a few big outcomes that should not crowd your hourly list. Check them off when done; they stay separate from Today's clock-based tasks.",
  },
  {
    title: "Coach",
    body:
      "The **Coach** tab can run a general check-in or help you plan or get unstuck. It reads anonymized summaries of your progress and habits; never judgment, always optional.",
  },
  {
    title: "Notes & Finance",
    body:
      "**Notes** is a lightweight inbox for ideas and snippets. **Finance** tracks bills and subscriptions; due items can appear as gentle reminders when you have configured them.",
  },
  {
    title: "Habits & reminders",
    body:
      "In **Settings → Habit check-ins**, define build/break habits. You can add **reminders**: **Hourly** (daytime hours) for nudges like water, or **Choose times** for specific clock times. In **Settings → Notifications**, use **Allow notifications and background reminders** (browser) or **Allow notifications and sync reminders** (app) so alerts and optional push work when your deployment supports it.",
  },
  {
    title: "Routines & capacity",
    body:
      "Morning and **wind-down** routines can appear on Today when enabled in Settings. **Today's Capacity** (mood and energy pills) nudges the coach and your self-awareness: optional metadata, not a grade.",
  },
  {
    title: "Instructions on each tab",
    body:
      "Longer help lives in the **Instructions** bar at the bottom of Today, List, Coach, Notes, Finance, and Health; open it anytime. This tour is the overview; combine both when you need detail.",
  },
  {
    title: "Sync & account",
    body:
      "With cloud sync configured and an account, your schedule, notes, finance, and settings can sync across devices. Guest mode keeps data on this browser until you link an account from Settings.",
  },
  {
    title: "You are ready",
    body:
      "Use the bottom bar to jump between areas. Everything from first setup can be changed in **Settings**. Tap **Done** below to close this tour. You will not see this full tour again unless you clear app data or we add a replay option later.",
  },
];

/**
 * One-time (or explicit) product tour after onboarding. `mode`: quick (4) vs full (12).
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
