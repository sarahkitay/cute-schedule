// Luxury Editorial SVG Icons - Thin strokes, rounded ends

import { TODAY_ICON_PATHS } from "./icons/todayIconPaths.js";

/** Highlight fills inside dock tab artwork (set on .bottom-nav-item in CSS). */
const DOCK_ICON_PAPER = "var(--dock-icon-paper, var(--surface-solid))";

function dockTabClass(className = "", extra = "") {
  return ["dock-tab-icon", extra, className].filter(Boolean).join(" ");
}

export function StarIcon({ filled = false, className = "" }) {
  return (
    <svg
      className={className}
      width="18"
      height="18"
      viewBox="0 0 24 24"
      fill={filled ? "var(--rose-quartz, #E79AB5)" : "none"}
      stroke="var(--rose-quartz, #E79AB5)"
      strokeWidth="1.5"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2" />
    </svg>
  );
}

export function StarEmptyIcon({ className = "" }) {
  return (
    <svg
      className={className}
      width="18"
      height="18"
      viewBox="0 0 24 24"
      fill="none"
      stroke="var(--dusty-mauve, #E6A7BC)"
      strokeWidth="1.5"
      strokeLinecap="round"
      strokeLinejoin="round"
      opacity="0.5"
    >
      <polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2" />
    </svg>
  );
}

export function TrashIcon({ className = "" }) {
  return (
    <svg
      className={className}
      width="16"
      height="16"
      viewBox="0 0 24 24"
      fill="none"
      stroke="var(--soft-charcoal, #3A3A3A)"
      strokeWidth="1.5"
      strokeLinecap="round"
      strokeLinejoin="round"
      opacity="0.6"
    >
      <polyline points="3 6 5 6 21 6" />
      <path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2" />
    </svg>
  );
}

export function SparkleIcon({ className = "", style = {} }) {
  return (
    <svg
      className={className}
      width="16"
      height="16"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.5"
      strokeLinecap="round"
      strokeLinejoin="round"
      opacity="0.85"
      style={style}
    >
      <path d="M12 2L13.5 8.5L20 10L13.5 11.5L12 18L10.5 11.5L4 10L10.5 8.5L12 2Z" />
    </svg>
  );
}

/** Coach tab: custom mascot artwork (currentColor). */
export function CoachIcon({ className = "", style = {} }) {
  return (
    <svg
      className={dockTabClass(className, "dock-tab-icon--portrait dock-tab-icon--coach")}
      viewBox="355 628 325 235"
      preserveAspectRatio="xMidYMax meet"
      fill="currentColor"
      style={style}
      aria-hidden
    >
      <path
        d="M495,635c8.7.9,18.1.9,26.8-.1,3,2.1,6.4,3.6,10.2.5,1.7,3.5,3.9,1.6,6,1.8,8.3.8,17,1.5,24.6,4.3,3.2,1.2,4.8,1.9,8.3,2.2,5.7.4,11.6,3.5,17,5.4,3.1,1.1,3.8,4.7,2.9,7.3-.7,1.9-4,3.5-6.7,2.5-19-7.5-38.6-10.6-58.8-12.5-3.5-1.2-9.3-1.2-13.4-.3h-5.4c-5.9-.6-12-.6-18.1-.2,1.1-.7,1.2-.5.3.7-31.1,2.7-61.6,9.5-90.1,23.2-7.7,3.7-14.6,7.6-20.4,13.8-6.7,7.2-9.9,17.2-9.9,27.2-.3,1.3-.6,1.5-.7.6-.6,5-.7,39.9.6,41.5.2.3.3.7.3,1.1,1.3,13.3,3.6,26.3,7.5,39,14.7,48.2,54.9,85.8,97.8,110,11,6.2,22,9.6,34.5,13.3,12.3-.5,24.6-4.3,36.4-10.7,41.8-22.4,81.9-59.4,99.6-104.1,7.2-18.1,9.5-36.7,11.2-56,.8-10.3,1.2-21.3,1.1-33.1,1-2.7,3-3.5,5.6-2.4,3,1.6,3.7,4,3.7,7-.8,7.6-.9,15.8,0,23.4,0,2.4-.7,4.1-.8,6.3-1.1,2.8-1.1,8-.4,11.7-2,14.5-4.2,28.6-9.1,42.5-7.5,21.1-18.6,39.8-33.3,56.6-23.7,26.9-53.9,49.9-87,63.9-14.1,6-28.8,6.5-43.1,1.3-25.7-9.3-51.9-26.5-71.7-45.2l-6.3-5.9c-36-33.8-52.7-72.2-56.5-121.6l-.9-11c1-7.2.9-15.2.1-22.5l1.8-14.7c1.2-10,5.2-19.4,12.6-26.5,22.8-21.8,68.9-33.7,100.7-37.9,3-.4,5-.2,8.4-1,2.2-.6,6.2,2.2,9,0,1.7-1.2,3.7-1.5,5.4-1.5h0Z"
        opacity="0.82"
      />
      <path
        d="M528.3,789.4c-15,20-8.4,41.4-15.8,42.7-3,.6-4.6-1.2-5.2-4.5l-3.6-20.2c-4.4-15.5-14.9-27.4-30.1-33-13.9-5.1-25-2.5-24.7-9,.2-4.5,6.2-3.3,15.5-5,17.5-3.2,31.5-14.4,37.9-31.2,5.8-15.3,3-29.2,10.2-28.3,2.2.3,3.6,2.3,3.9,4.8,3,25.5,11.5,46.3,37.6,53.4,3.1.8,5.4,3.2,9.4,2.1,3.1-.8,7.6,0,9.9,2.3,1.3,1.3.5,3.2,0,4.2-3,5.1-29,.3-45,21.7h0Z"
        opacity="0.82"
      />
      <path
        d="M601.4,689c-.5-5.2-.5-10.3,0-15.5,3.8-12.2,16-19.8,28.6-17.8s21.9,12.8,21.9,25.6-9.4,23.6-22,25.5-24.8-5.7-28.6-17.9h0Z"
        opacity="0.72"
      />
      <path d="M368.6,753.9c-.8.4-1.6,0-1.6-.9v-42c0-.9.8-1.3,1.5-.4v43.3c.1,0,.1,0,.1,0Z" opacity="0.65" />
      <path d="M662.3,710c-1.6-.1-2.9.2-3.9.9-1.1.9-1.5,2.3-1.5,4v30c0,.8-.6,1.2-1.3.6l.5-33.4c0-1.6,1.6-2.6,2.6-3,1.5-.6,2.3.2,3.6.8h0Z" opacity="0.7" />
      <path d="M521.8,634.9c-1,.8-1.7,1.2-2.8,1.2h-22.1c-1.1,0-1.8-.4-2-1.1h26.8c0-.1,0-.1,0-.1Z" opacity="0.88" />
      <path d="M666.1,740.4c-.8-.5-1.1-1.3-1.1-2.3v-19.1c0-1.1.4-1.8,1-1.9v23.4c0,0,0,0,0,0Z" opacity="0.78" />
      <path d="M357,739v-22.5c.7.6,1.1,1.3,1.1,2.4v18.1c0,1.1-.4,1.8-1.1,1.9h0Z" opacity="0.76" />
      <path d="M601.4,689c-1.6-5-1.5-10.4,0-15.5l.6,14.4c-.2.7-.5,1-.6,1h0Z" opacity="0.7" />
      <path d="M506.6,646l-17.8.4c-.3.2-1-1.3-.6-1.3l16.9-.2c1.1,0,1.9.4,1.6,1.1Z" opacity="0.68" />
      <path d="M525.4,646.3l-13.4-.3c.1-.7.9-1.1,1.9-1.1h14.2c-.5,1.5-1.7,1.2-2.7,1.4h0Z" opacity="0.75" />
      <path d="M665.3,746.7l-.4,11.7c-.6-.5-1-1.2-1-2.3l.2-13.2c1.3,1,1,2.4,1.1,3.8h0Z" opacity="0.78" />
    </svg>
  );
}

export function RepeatIcon({ className = "" }) {
  return (
    <svg
      className={className}
      width="16"
      height="16"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.5"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <polyline points="23 4 23 10 17 10" />
      <polyline points="1 20 1 14 7 14" />
      <path d="M3.51 9a9 9 0 0 1 14.85-3.36L23 10M1 14l4.64 4.36A9 9 0 0 0 20.49 15" />
    </svg>
  );
}

/** Today tab: custom mascot artwork (currentColor). */
export function TodayIcon({ className = "", style = {} }) {
  return (
    <svg
      className={dockTabClass(className, "dock-tab-icon--portrait")}
      viewBox="0 0 1024 1536"
      fill="currentColor"
      style={style}
      aria-hidden
    >
      {TODAY_ICON_PATHS.map((d, i) => (
        <path key={i} d={d} />
      ))}
    </svg>
  );
}

/** Monthly tab: calendar / planner mark (custom artwork). */
export function MonthlyIcon({ className = "", style = {} }) {
  return (
    <svg
      className={dockTabClass(className)}
      viewBox="0 0 455.53 474.17"
      fill="currentColor"
      style={style}
      aria-hidden
    >
      <path
        d="M386.65,473.34l-1.48-.66c-103.44.2-206.97.18-310.62-.08l-5.42.66c-36.72-2.39-65.36-31.54-68.74-68.5L0,111.07C-.05,70.83,28.7,36.41,69.73,33.91l46.7-.37.21-30.45c.02-2.28,2.89-3.14,4.36-3.08,1.54.07,3.99,1.06,4.01,3.31l.28,30.34,209.32.03.22-30.61c.02-2.45,3.47-3.35,5.03-3.01,2.17.46,3.62,2.26,3.62,4.94l.09,28.57,42.92.31c40.65,2.51,69.15,37.23,69.04,77.19l-.77,292.67c-.1,37.15-32.72,67.52-68.12,69.6h0Z"
        opacity="0.82"
      />
      <path
        d="M386.65,473.34l-4.2.25c-5.12-.59-10.14-1.31-15.29-.08s-10.24.14-15.58-.67l-11.87,1.08c-5.53-1.29-9.91-1.07-15.27-.29-6.41.92-12.87.27-19.48-.15-4.98-.31-10.84,1.75-15.84-.06-4.3-1.56-7.55.46-11.68.45l-95.46-.36c-8.14-.03-15.29-.93-23.43.16-7.07.94-14.57.33-21.81-.24-9.01.51-17.95,1.32-27.05-.78-7.09,2.1-14.12,1.71-21.09.24l-13.81.38c-2.12.06-3.57.64-5.67,0,.4-.59.54-1.27,1.7-1.33h314.48c1.17.06,1.3.75,1.34,1.41h.01Z"
        opacity="0.76"
      />
      <path
        d="M385.61,464.58H71.3c-35.99-1.98-62.42-31.98-62.4-67.76l.14-240.86h437.69l-.48,245.81c-.06,33.47-27.95,60.18-60.66,62.81h.02Z"
        fill={DOCK_ICON_PAPER}
        stroke="none"
      />
      <path
        d="M326.69,113.33c13.64,7.72,30.36.9,35.38-13.08,5.1-14.19-3.25-29.72-18.51-33.07l-.09-24.55,44.18.56c33.52,2.74,59.01,31.34,59.06,64.79l.06,38.99-437.72-.02.03-38.19c.03-35.04,27.19-64.5,62.45-65.83l45.01-.19-.22,24.55c-13.09,2.45-21.12,14.07-20.38,26.1.8,12.96,11.56,22.85,24.18,23.17,12.49.31,23.34-9.02,24.96-21.35,1.67-12.67-5.89-24.81-19.6-27.89l-.25-24.56,209.35.03.06,24.34c-10.13,2.37-17.72,9.98-19.59,19.07-2.2,10.73,1.71,21.51,11.65,27.13h-.01Z"
        fill={DOCK_ICON_PAPER}
        stroke="none"
      />
      <circle cx="120.61" cy="91.73" r="16.07" fill={DOCK_ICON_PAPER} stroke="none" />
      <circle cx="338.96" cy="91.78" r="16.02" fill={DOCK_ICON_PAPER} stroke="none" />
      <path
        d="M312.5,337.7c2.85-1.98,4.94-2.36,7.13-.42,1.85,1.64,1.67,3.59.57,6.09-13.97,31.66-43.51,52.58-76.85,55.14-35.32,2.7-68.25-14.5-86.38-44.89-18.7-31.34-17.92-69.65,2.34-100.03,11.38-17.06,27.86-29.23,47.39-35.64,2.01-.66,4.16.26,5.03,1.34.8,1,1.71,3.8.52,5.23-29.46,35.37-21.78,88.89,16.96,113.85,25.44,16.39,58.22,16.7,83.3-.68h-.01Z"
        opacity="0.78"
      />
      <path
        d="M313.45,269.24c-.31,2.65-1.82,3.92-3.4,4.05-2.39.19-3.61-1.61-3.87-4.07-1.42-13.41-11.39-23.28-24.77-24.95-2.12-.26-3.61-1.02-3.91-2.87-.28-1.72.85-4.11,3.23-4.34,13.81-1.31,24.05-11.52,25.45-25.4.21-2.1,1.2-3.5,2.96-3.79s4.13.79,4.37,3.22c1.36,13.63,11.36,24.12,25.07,25.82,2.29.28,3.79,1.7,3.87,3.58s-1.33,3.57-3.63,3.84c-13.25,1.56-23.74,11.13-25.37,24.92h0Z"
        opacity="0.74"
      />
      <path
        d="M304.66,352.62c-16.21,25.84-45.24,39.1-75.1,36.98-28.44-2.02-54.13-18.79-67.64-45.17-12.77-24.94-12.84-54.52.83-79.26,7.39-13.38,17.72-25.09,32.52-31.75-20.11,39.51-8.53,86.11,26.94,110.89,24.19,16.9,53.62,19.85,82.44,8.31h0Z"
        fill={DOCK_ICON_PAPER}
        stroke="none"
      />
    </svg>
  );
}

/** Calendar (generic): line-art for buttons and date actions. */
export function CalendarIcon({ className = "", style = {} }) {
  return (
    <svg
      className={className}
      width="16"
      height="16"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.5"
      strokeLinecap="round"
      strokeLinejoin="round"
      opacity="0.85"
      style={style}
    >
      <rect x="3" y="4" width="18" height="18" rx="2" ry="2" />
      <line x1="16" y1="2" x2="16" y2="6" />
      <line x1="8" y1="2" x2="8" y2="6" />
      <line x1="3" y1="10" x2="21" y2="10" />
    </svg>
  );
}

/** Notes tab: notebook and pen (custom artwork). */
export function NotesIcon({ className = "", style = {} }) {
  return (
    <svg
      className={dockTabClass(className)}
      viewBox="0 0 462.21 497.37"
      fill="currentColor"
      style={style}
      aria-hidden
    >
      <path
        d="M8.98,69.41l-.93,10.14-.05,265.63.35,97.07c.09,25.98,22.9,46.97,48.69,46.98l268.91.16c26.33.02,48.87-19.66,50.32-46.52l.85-96.42c1.62-5,4.51-9.8,7.2-14.59l-.26,109.25c-.08,32.63-27.42,56.07-59.48,56.09l-266.4.17c-1.37,0-1.86-.47-2.31-1.04.54-.91-.36-.17-1.1.44-28.67-1.36-53.96-24.83-54.12-54.83l-.45-86.79L0,78.49c0-2.24-.11-3.22.84-4.35,2.08.29,2.86,2.67,2.34,7.11,4.28-.76,1.05-6.69-1.16-9.2-.99-4.64,3.43,1.21-1.13.45.1-4.22,1.53-8.45,2.91-12.35,2.97,1.83,5.26,5.65,5.18,9.26h0Z"
        opacity="0.82"
      />
      <path
        d="M328.77,387.42c-1.47,1.58-2.64,2.12-4.11,1.8s-2.93-1.91-2.63-3.92l8.06-54.04,95.37-197.27c4.69-9.69,16.76-11.25,25.06-7.49,11.25,5.1,14.44,16.25,9.31,26.89l-93.18,193.42-37.89,40.61h.01Z"
        opacity="0.8"
      />
      <path
        d="M8.98,69.41l-2.69-3.34c-1.56-2.04-2.64-3.63-2.49-5.92,8.02-22.78,29.4-38.06,54.33-38.05l245.65.06c2.42,0,2.65,3.4,2.36,4.62s-.84,2.92-3.31,2.93l-246.25.22c-23.79.02-42.88,17.53-47.6,39.49h0Z"
        opacity="0.76"
      />
      <rect x="66.08" y="277.8" width="252.51" height="5.33" opacity="0.78" />
      <rect x="66.05" y="196.97" width="252.56" height="5.25" opacity="0.78" />
      <rect x="66.1" y="358.86" width="240.59" height="5.31" opacity="0.78" />
      <path
        d="M364.69,80.25c-2.18-4.23-1.79-8.43-2.81-12.7-3.39-14.18-13.62-24.7-28.13-26.93-3.46-.53-6.86-.67-9.98-2.13,13.66-.14,26-4.9,33.5-15.9,4.59-6.72,5.05-14.3,7.15-22.59,2.27,25.02,13.72,37.1,39.73,38.59-3.47,1.74-7.26,1.62-11.21,2.53-19.88,4.56-27.34,19.14-28.26,39.12h.01Z"
        opacity="0.74"
      />
      <path d="M384.25,196.82l-7.29,14.8-.2-110.25c0-2.91,1.58-4.12,3.76-4.15s3.86,1.27,3.86,4.15l-.13,95.45Z" opacity="0.8" />
      <path
        d="M.85,74.14l.04-1.64,1.59-2.73c.6,2.18,2.17,3.48,4.52,4.86l-.15,115.73c-1.35-2.95,0-6.18-4.58-6.66l-.27,14.1c-.21.37-.52.56-.92.6l-.1-103.92,4.99-.46c-.1-3.34.66-6.84-.51-9.8-.71-.7-2.34-1.1-2.67-.68l-1.41,1.83-.53-11.24h0Z"
        opacity="0.76"
      />
      <path d="M55.87,496.34c-.21.36-.71.45-1.1.44.38-.9.6-1.49,2.41-1.49l267.3.02c.28.16.59.52.72.97l-269.34.06h.01Z" opacity="0.7" />
      <path
        d="M1.17,241.42c1.59,2.46.55,4.54,1.02,5.91.33.98,1.89,1.73,4.21,1.84l-.33-13.6c-2.32-.53-3.48.22-4.95,1.69l.19-27.17c1.2,1.67,2.2,3.13,4.72,3.26v-15.55c.19-.34.5-.56.94-.62l.06,148.62c0,.32-.54.56-.61.51-1-1.9.12-4.76-.83-7.01-.28-.66-2.58-1.04-2.65-.34l-1.8,16.45.03-114.01v.02Z"
        opacity="0.76"
      />
      <polygon
        points="361.28 342.99 329.89 376.92 336.65 332.92 419 162.07 443 173.4 424.48 211.96 361.28 342.99"
        fill={DOCK_ICON_PAPER}
        stroke="none"
      />
      <path
        d="M445.59,167.56l-23.65-11.35,8.36-17.59c1.74-3.66,5.05-5.92,7.83-6.93,4.64-1.69,8.41-.1,12.15,2.35,5.07,3.33,7.08,9.34,4.37,14.92l-9.05,18.6h-.01Z"
        fill={DOCK_ICON_PAPER}
        stroke="none"
      />
      <path
        d="M364.47,57.59c-4.19-8.82-9.48-15.51-18.81-18.53,8.48-3.29,14.54-8.66,18.5-17.64,3.72,8.9,9.74,14.27,18.45,17.68-9.61,3.45-15.54,9.78-18.14,18.49h0Z"
        fill={DOCK_ICON_PAPER}
        stroke="none"
      />
      <path d="M6.45,322.67c-.14.31-1.92.64-3.93.52l-.38-10.76c-.04-1.12.85-2.04,1.42-2.26s2.46.16,2.48.92l.4,11.58h0Z" opacity="0.82" />
    </svg>
  );
}

/** Moon (generic): wind-down / night UI. */
export function MoonIcon({ className = "", style = {} }) {
  return (
    <svg
      className={className}
      width="20"
      height="20"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.5"
      strokeLinecap="round"
      strokeLinejoin="round"
      style={style}
    >
      <path d="M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79z" />
    </svg>
  );
}

export function CelebrateIcon({ className = "", style = {} }) {
  return (
    <svg
      className={className}
      width="18"
      height="18"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.5"
      strokeLinecap="round"
      strokeLinejoin="round"
      style={style}
    >
      <circle cx="12" cy="12" r="10" />
      <path d="M12 6v6l4 2" />
    </svg>
  );
}

export function WindDownIcon({ className = "" }) {
  return (
    <svg
      className={className}
      width="20"
      height="20"
      viewBox="0 0 24 24"
      fill="none"
      stroke="var(--rose-quartz, #E79AB5)"
      strokeWidth="1.5"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <path d="M12 2v4M12 18v4M4.93 4.93l2.83 2.83M16.24 16.24l2.83 2.83M2 12h4M18 12h4M4.93 19.07l2.83-2.83M16.24 7.76l2.83-2.83" />
      <circle cx="12" cy="12" r="4" />
    </svg>
  );
}

export function SettingsIcon({ className = "" }) {
  return (
    <svg
      className={className}
      width="18"
      height="18"
      viewBox="0 0 24 24"
      fill="none"
      stroke="var(--soft-charcoal, #3A3A3A)"
      strokeWidth="1.5"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <path d="M12 15a3 3 0 1 0 0-6 3 3 0 0 0 0 6Z" />
      <path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1 0 2.83 2 2 0 0 1-2.83 0l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-2 2 2 2 0 0 1-2-2v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83 0 2 2 0 0 1 0-2.83l.06-.06a1.65 1.65 0 0 0 .33-1.82 1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1-2-2 2 2 0 0 1 2-2h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 0-2.83 2 2 0 0 1 2.83 0l.06.06a1.65 1.65 0 0 0 1.82.33H9a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 2-2 2 2 0 0 1 2 2v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 0 2 2 0 0 1 0 2.83l-.06.06a1.65 1.65 0 0 0-.33 1.82V9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 2 2 2 2 0 0 1-2 2h-.09a1.65 1.65 0 0 0-1.51 1Z" />
    </svg>
  );
}

export function CloseIcon({ className = "" }) {
  return (
    <svg
      className={className}
      width="16"
      height="16"
      viewBox="0 0 24 24"
      fill="none"
      stroke="var(--soft-charcoal, #3A3A3A)"
      strokeWidth="1.5"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <line x1="18" y1="6" x2="6" y2="18" />
      <line x1="6" y1="6" x2="18" y2="18" />
    </svg>
  );
}

export function ChevronLeftIcon({ className = "" }) {
  return (
    <svg
      className={className}
      width="18"
      height="18"
      viewBox="0 0 24 24"
      fill="none"
      stroke="var(--soft-charcoal, #3A3A3A)"
      strokeWidth="1.5"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <polyline points="15 18 9 12 15 6" />
    </svg>
  );
}

export function ChevronRightIcon({ className = "" }) {
  return (
    <svg
      className={className}
      width="18"
      height="18"
      viewBox="0 0 24 24"
      fill="none"
      stroke="var(--soft-charcoal, #3A3A3A)"
      strokeWidth="1.5"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <polyline points="9 18 15 12 9 6" />
    </svg>
  );
}

export function LightEnergyIcon({ className = "" }) {
  return (
    <svg
      className={className}
      width="16"
      height="16"
      viewBox="0 0 24 24"
      fill="none"
      stroke="#90EE90"
      strokeWidth="1.5"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <path d="M12 2v4M12 18v4M4.93 4.93l2.83 2.83M16.24 16.24l2.83 2.83M2 12h4M18 12h4" />
    </svg>
  );
}

export function MediumEnergyIcon({ className = "" }) {
  return (
    <svg
      className={className}
      width="16"
      height="16"
      viewBox="0 0 24 24"
      fill="none"
      stroke="#FFD700"
      strokeWidth="1.5"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <circle cx="12" cy="12" r="10" />
      <line x1="12" y1="2" x2="12" y2="6" />
      <line x1="12" y1="18" x2="12" y2="22" />
      <line x1="4.93" y1="4.93" x2="7.76" y2="7.76" />
      <line x1="16.24" y1="16.24" x2="19.07" y2="19.07" />
    </svg>
  );
}

export function HeavyEnergyIcon({ className = "" }) {
  return (
    <svg
      className={className}
      width="16"
      height="16"
      viewBox="0 0 24 24"
      fill="none"
      stroke="#FF6B6B"
      strokeWidth="1.5"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <rect x="6" y="6" width="12" height="12" rx="2" />
      <rect x="9" y="9" width="6" height="6" />
    </svg>
  );
}

export function GoodFeelingIcon({ className = "" }) {
  return (
    <svg
      className={className}
      width="20"
      height="20"
      viewBox="0 0 24 24"
      fill="none"
      stroke="var(--muted-sage, #C9D6CF)"
      strokeWidth="1.5"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <circle cx="12" cy="12" r="10" />
      <path d="M8 14s1.5 2 4 2 4-2 4-2" />
      <line x1="9" y1="9" x2="9.01" y2="9" />
      <line x1="15" y1="9" x2="15.01" y2="9" />
    </svg>
  );
}

export function NeutralFeelingIcon({ className = "" }) {
  return (
    <svg
      className={className}
      width="20"
      height="20"
      viewBox="0 0 24 24"
      fill="none"
      stroke="var(--dusty-mauve, #E6A7BC)"
      strokeWidth="1.5"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <circle cx="12" cy="12" r="10" />
      <line x1="8" y1="12" x2="16" y2="12" />
      <line x1="9" y1="9" x2="9.01" y2="9" />
      <line x1="15" y1="9" x2="15.01" y2="9" />
    </svg>
  );
}

export function HardFeelingIcon({ className = "" }) {
  return (
    <svg
      className={className}
      width="20"
      height="20"
      viewBox="0 0 24 24"
      fill="none"
      stroke="var(--rose-quartz, #E79AB5)"
      strokeWidth="1.5"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <circle cx="12" cy="12" r="10" />
      <path d="M8 10s1.5-2 4-2 4 2 4 2M8 14s1.5 2 4 2 4-2 4-2" />
      <line x1="9" y1="9" x2="9.01" y2="9" />
      <line x1="15" y1="9" x2="15.01" y2="9" />
    </svg>
  );
}

export function FireIcon({ className = "" }) {
  return (
    <svg
      className={className}
      width="16"
      height="16"
      viewBox="0 0 24 24"
      fill="none"
      stroke="#FF6B6B"
      strokeWidth="1.5"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <path d="M12 2a6 6 0 0 1 6 6c0 4-3 7-6 10a6 6 0 0 1-6-6V8a6 6 0 0 1 6-6z" />
      <path d="M8 12a4 4 0 1 0 8 0 4 4 0 0 0-8 0z" />
    </svg>
  );
}

/** Health tab: heartbeat / activity mark (custom artwork, currentColor). */
export function HealthIcon({ className = "", style = {} }) {
  return (
    <svg
      className={dockTabClass(className)}
      viewBox="0 0 1254 1254"
      fill="currentColor"
      style={style}
      aria-hidden
    >
      <path d="M644.4,642.5c3.5-11.4,11.6-19,23.7-19.4h108.8c3.8,0,6,1.9,6.6,5.3.5,2.7-1.5,6.5-5.6,6.5h-109.7c-7.1,0-10.8,3.8-12.7,10.2l-24.5,80.3c-.9,2.9-5,3-6.9,2.5-3.2-.9-3.7-2.9-4.6-6.3l-47.1-167.7-21.4,71.4c-3.1,10.4-9.9,18.4-21,20.2h-121.5c38.2,63.9,94.3,115.6,154.4,155.7,10.7,6.9,20.6,13,32.3,17.8,21.1,8.7,44,8.2,65-.7,11-4.7,20.3-10.2,30.3-16.9,41.2-27.2,78.4-59.5,111.1-96.5,2.7-3,6-3.8,8.8-1.5,3,2.5,2.5,6.4,0,9.1l-37.3,38.7c-26.2,24.2-53.6,46-83.8,64.9-45.3,28.4-81.5,27.7-126.4-1-59.3-37.9-118.6-92.5-157.1-151.6-16.9-25.9-29.4-53.4-36.4-83.5-10.1-43.4-2-87.6,23.4-124.1,19-27.2,46.1-46.9,78.3-55.6,41-11.1,79.2,1,113,25,15,10.7,27.9,23,40.4,36.5,1.2,1.3,3.2,2.3,4.8.6,11.8-12.8,24.1-24.4,38.2-34.7,45.5-33.3,98.4-43.5,148.7-14.4,40,23.2,65.7,64.3,70.5,110.3,2.2,21.2-.5,41.6-5.9,62.2-.9,3.4-2.2,5.5-5.5,6-2.5.3-7.3-1.9-6.3-5.5,3.7-14.7,6.5-28.7,6.8-44.1,1-53.8-28.3-102.9-77.8-124.7-24.2-10.7-50.2-12.3-75.5-4.7-34.1,10.3-59.4,31-83.6,56.3-3.5,3.7-7.3,6-12.2,5.9s-8.7-3.1-12.4-7c-15.7-16.5-32.2-31.5-52.2-42.6-20.5-11.5-42.3-18.5-66.1-17.1-27.5,1.6-53.1,13.1-73.4,31.5-40.3,36.3-54.9,92.2-40.3,144.1,4.9,17.5,11,33.6,19.6,49.8l127.1-.2c5.9,0,9.3-5.8,10.8-10.7l26.3-90.3c1-3.6,3.1-6,6.4-5.9,4.1,0,5.3,3,6.4,7l47.2,168.4,18.3-59.8h0Z" />
      <ellipse cx="829.1" cy="630.1" rx="27.7" ry="27.6" />
    </svg>
  );
}

/** Workouts / training: dumbbell line-art (currentColor, 1.5 stroke). */
export function DumbbellIcon({ className = "", style = {} }) {
  return (
    <svg
      className={className}
      width="22"
      height="22"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.5"
      strokeLinecap="round"
      strokeLinejoin="round"
      opacity="0.85"
      style={style}
    >
      <rect x="3" y="8" width="5" height="8" rx="2" ry="2" />
      <line x1="8" y1="12" x2="16" y2="12" />
      <rect x="16" y="8" width="5" height="8" rx="2" ry="2" />
    </svg>
  );
}

/** Macro / TDEE calculator: grid keypad silhouette (currentColor). */
export function MacroCalculatorIcon({ className = "", style = {} }) {
  return (
    <svg
      className={className}
      width="22"
      height="22"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.5"
      strokeLinecap="round"
      strokeLinejoin="round"
      opacity="0.9"
      style={style}
    >
      <rect x="4" y="3" width="16" height="18" rx="3" ry="3" />
      <rect x="7" y="6" width="3" height="3" rx="0.5" fill="currentColor" stroke="none" opacity="0.35" />
      <rect x="11" y="6" width="3" height="3" rx="0.5" fill="currentColor" stroke="none" opacity="0.35" />
      <rect x="15" y="6" width="3" height="3" rx="0.5" fill="currentColor" stroke="none" opacity="0.35" />
      <rect x="7" y="11" width="3" height="3" rx="0.5" fill="currentColor" stroke="none" opacity="0.35" />
      <rect x="11" y="11" width="3" height="3" rx="0.5" fill="currentColor" stroke="none" opacity="0.35" />
      <rect x="15" y="11" width="3" height="3" rx="0.5" fill="currentColor" stroke="none" opacity="0.35" />
      <rect x="7" y="16" width="11" height="3" rx="0.5" fill="currentColor" stroke="none" opacity="0.45" />
    </svg>
  );
}

/** List tab: checklist with lines (custom artwork, currentColor). */
export function ListIcon({ className = "", style = {} }) {
  return (
    <svg
      className={dockTabClass(className)}
      viewBox="0 0 1254 1254"
      fill="currentColor"
      style={style}
      aria-hidden
    >
      <path d="M407,465.4l.2,108.5v38.3c0,0,.3,176.6.3,176.6,0,48.1,39.8,85.8,87.5,84.2,4.1-.1,6.7,2.1,7.2,5.6.4,2.6-.9,6.7-4.6,6.9-53.3,3.1-101.7-38.8-101.9-93l-.6-172.4v-35.3c.1,0,0-134.7,0-134.7,0-3.2.6-6.6.9-8.9,1.5-1.6,2.8-1.1,3,1v144.9c.8-3.7,2.4-6.6,4.9-8.8l.3-130.3c.6-.8,1.5-1.7,2.4-1.9,1.2-.3,1.4,17.4.5,19.2h0Z" opacity="0.72" />
      <rect x="591.2" y="440.4" width="300.8" height="12.8" opacity="0.88" />
      <rect x="591.1" y="612.4" width="299.1" height="12.8" opacity="0.8" />
      <rect x="591.1" y="788" width="298.9" height="12.7" opacity="0.76" />
      <path d="M407,465.4c-.5-6,1-12-.8-18.5l-.3,133.4c-7,1.3-.5,8.3-8.9,10.5v-148.7c0-.9-.7-1.2-1-1,5.5-52.9,51.6-91.3,105.1-87.3,4.8.4,8.6.7,8.4,6.7-.1,3.4-3,6.4-7.6,6.1-22-1.4-43.3,3.8-61,17.3-19.2,14.6-30.9,36.8-33,60.9l.2,16.2c0,1.7.2,3.2-1,4.3Z" opacity="0.88" />
      <circle cx="507.4" cy="618.7" r="34" transform="translate(-145.7298 1080.9059) rotate(-85.9349)" opacity="0.78" />
      <path d="M523.3,807.3c-7.2,6.8-7.6,17.6-14,18.8-10.3,1.9-9.3-9.5-16.7-17.7s-18.9-8-18.9-15.9c0-3.4,2.1-6.8,5.6-8.2,21.9-8.6,17.5-26.3,28.1-26.1,3.9,0,6.6,2.6,8.1,6.4,8,20.6,24.2,17.3,25.4,26.1,1.4,9.3-9.8,9.3-17.6,16.6h0Z" opacity="0.74" />
      <circle cx="507.4" cy="447.5" r="18.1" opacity="0.9" />
      <path d="M405.4,601.6c.4,3.7,1.7,10.3-.1,13.9-3.1,6.1-5.9,11.5-8,18.8l-.4-41.2c2.9.7,1.1,4.8,3.4,7.1.7.7,3.2.9,5,1.5Z" opacity="0.88" />
    </svg>
  );
}

/** Overflow / options menu (three dots). */
export function MenuIcon({ className = "", style = {} }) {
  return (
    <svg
      className={className}
      width="16"
      height="16"
      viewBox="0 0 24 24"
      fill="none"
      stroke="var(--soft-charcoal, #3A3A3A)"
      strokeWidth="1.5"
      strokeLinecap="round"
      strokeLinejoin="round"
      opacity="0.6"
      style={style}
    >
      <circle cx="12" cy="5" r="1" />
      <circle cx="12" cy="12" r="1" />
      <circle cx="12" cy="19" r="1" />
    </svg>
  );
}

/** Checkmark - line-art, for selected state / success */
export function CheckIcon({ className = "", style = {} }) {
  return (
    <svg
      className={className}
      width="16"
      height="16"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2.5"
      strokeLinecap="round"
      strokeLinejoin="round"
      style={style}
    >
      <polyline points="20 6 9 17 4 12" />
    </svg>
  );
}

/** Arrow right - for "next" / flow */
export function ArrowRightIcon({ className = "", style = {} }) {
  return (
    <svg
      className={className}
      width="16"
      height="16"
      viewBox="0 0 24 24"
      fill="none"
      stroke="var(--soft-charcoal, #3A3A3A)"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      style={style}
    >
      <line x1="5" y1="12" x2="19" y2="12" />
      <polyline points="12 5 19 12 12 19" />
    </svg>
  );
}

/** Finance tab: piggy / savings mark (custom artwork, currentColor). */
export function FinanceIcon({ className = "", style = {} }) {
  return (
    <svg
      className={dockTabClass(className)}
      viewBox="0 0 1254 1254"
      fill="currentColor"
      style={style}
      aria-hidden
    >
      <path d="M504.5,787c72.2,44.4,160,44.6,232.6,3,3-1.7,7.2,1.1,7.7,3.6.8,3.4-.6,5.6-3.9,7.4-93.2,52.5-203.1,38.7-281.2-33.5-59.1-54.6-86.2-136.5-70.8-215.6,19.6-100.1,98-174.8,198.5-191.4,52.4-8.7,105.6,1.3,151.3,27.7,3,1.7,3.4,5,2.2,7.3-1.3,2.4-4.8,4.5-8,2.7-48.8-27.7-105.7-35.8-160.6-22.6-71.4,17.2-129.8,65.7-158.3,133.6-43.4,103.4-4.8,219.3,90.4,277.9h0Z" opacity="0.88" />
      <path d="M842.4,706.6c-30.4-14.5-68.1-13.5-99.5-1.7-17.1,6.4-31.7,15.6-47.6,24.3l-40.1,22c-22,10.4-44.7,17.2-69.1,18.8-35.2,2.4-69.2-6.7-97.2-27.8-2.9-2.2-3.7-5.3-2-8.1,1.9-3,6.2-3.5,9-.9.9.8,1.7,1.9,3.5,1.6l.4-89.6c0-14.7,13.9-22.8,27.3-22.9,15.3-.1,27.6,10,27.6,25.7v109.3c51.5,6.7,92-12.1,134.9-38,15.1-9.2,29.6-17.4,46-24,30.8-12.5,63.9-14.7,95.9-5.6l15.9,6c3.3,1.2,4.3,4.6,3.5,7.5-1,3.4-4.8,4.9-8.3,3.3h0Z" opacity="0.76" />
      <path d="M734.5,519.8c0-10.1-8-14-16.6-14-8,0-16.5,4.2-16.5,13.6l-.2,177.5c0,3.3-3.5,4.5-5.7,4.4-2.5-.2-5.2-2-5.2-5.5l.2-177.3c0-15.5,14.2-24.2,28.4-23.8,13.4.3,26.2,8.6,26.3,23.4l.3,156.8c0,4-2.2,6.4-5.2,6.5-3.8.1-5.8-2.3-5.8-6.4v-155.1q0,0,0,0Z" opacity="0.88" />
      <path d="M639.1,586.6c0-10.4-7-14.9-16.3-14.9-7.2,0-16.9,3.2-16.9,12.4l-.3,156.6c0,3.4-2.8,4.9-5.3,5-2.2.1-5.7-1.5-5.6-4.9l.5-158.7c0-14.3,15.5-21.8,27.5-21.8,16.1,0,27.4,10.8,27.4,26.8l-.2,137.7c0,3.5-1.9,5.1-4.5,5.5s-6.2-.9-6.2-4.6v-139.1c-.1,0-.1,0-.1,0Z" opacity="0.88" />
      <path d="M846.8,653c-1,4.1-3.2,5.2-6.3,5.2-2.3,0-6.2-2.5-5.3-6.1,13.1-49.8,8.3-101.6-12.7-148.6-1.3-3-.7-6.4,1.2-7.9s6.6-2.5,8.1.7c23.1,48.9,28.4,103.9,15,156.7h0Z" opacity="0.76" />
      <circle cx="790.8" cy="447.1" r="27.7" opacity="0.82" />
      <circle cx="790.7" cy="447.2" r="16.4" fill={DOCK_ICON_PAPER} stroke="none" />
    </svg>
  );
}

/** Bullet / dot - subtle separator */
export function BulletIcon({ className = "", style = {} }) {
  return (
    <svg
      className={className}
      width="6"
      height="6"
      viewBox="0 0 8 8"
      fill="var(--text-soft, #888)"
      style={style}
    >
      <circle cx="4" cy="4" r="2" />
    </svg>
  );
}
