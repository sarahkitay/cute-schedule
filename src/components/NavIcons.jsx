import React from "react";

export function NavIcons({ name, size = 22, className = "" }) {
  const props = { width: size, height: size, className, viewBox: "0 0 24 24", fill: "currentColor", stroke: "none" };

  switch (name) {
    case "home":
      return (
        <svg {...props}>
          <path d="M12 3L2 10.5V20a2 2 0 002 2h5v-7h6v7h5a2 2 0 002-2V10.5L12 3z" />
        </svg>
      );
    case "plan":
      return (
        <svg {...props}>
          <path d="M19 4h-1V3a1 1 0 00-2 0v1H8V3a1 1 0 00-2 0v1H5a2 2 0 00-2 2v14a2 2 0 002 2h14a2 2 0 002-2V6a2 2 0 00-2-2zm0 16H5V10h14v10z" />
          <rect x="7" y="12" width="3" height="3" rx="0.5" />
          <rect x="11" y="12" width="3" height="3" rx="0.5" opacity="0.6" />
        </svg>
      );
    case "sparkle":
      return (
        <svg {...props}>
          <path d="M12 2L13.8 8.2L20 10L13.8 11.8L12 18L10.2 11.8L4 10L10.2 8.2L12 2Z" />
          <path d="M19 15l.7 2.3L22 18l-2.3.7L19 21l-.7-2.3L16 18l2.3-.7L19 15z" opacity="0.6" />
        </svg>
      );
    case "insights":
      return (
        <svg {...props}>
          <path d="M5 20h2v-7H5v7zm4 0h2V9H9v11zm4 0h2v-5h-2v5zm4 0h2V4h-2v16z" />
          <path d="M3 21h18v1H3z" opacity="0.3" />
        </svg>
      );
    case "user":
      return (
        <svg {...props}>
          <circle cx="12" cy="8" r="4.5" />
          <path d="M4 21c0-4.4 3.6-8 8-8s8 3.6 8 8H4z" />
        </svg>
      );
    case "list":
      return (
        <svg {...props}>
          <path d="M4 5h2v2H4V5zm4 0h12v2H8V5zM4 11h2v2H4v-2zm4 0h12v2H8v-2zM4 17h2v2H4v-2zm4 0h12v2H8v-2z" />
        </svg>
      );
    case "target":
      return (
        <svg {...props}>
          <circle cx="12" cy="12" r="10" opacity="0.15" />
          <circle cx="12" cy="12" r="7" opacity="0.25" />
          <circle cx="12" cy="12" r="4" opacity="0.5" />
          <circle cx="12" cy="12" r="2" />
        </svg>
      );
    case "notes":
      return (
        <svg {...props}>
          <path d="M14 2H6a2 2 0 00-2 2v16a2 2 0 002 2h12a2 2 0 002-2V8l-6-6z" />
          <path d="M14 2v6h6" opacity="0.4" />
          <rect x="7" y="13" width="10" height="1.5" rx="0.75" opacity="0.5" />
          <rect x="7" y="17" width="7" height="1.5" rx="0.75" opacity="0.5" />
        </svg>
      );
    case "repeat":
      return (
        <svg {...props}>
          <path d="M17 1l4 4-4 4" opacity="0.6" />
          <path d="M3 11V9a4 4 0 014-4h14" />
          <path d="M7 23l-4-4 4-4" opacity="0.6" />
          <path d="M21 13v2a4 4 0 01-4 4H3" />
        </svg>
      );
    case "finance":
      return (
        <svg {...props}>
          <circle cx="12" cy="12" r="10" opacity="0.12" />
          <path d="M12 4v16M16 7h-5a3 3 0 000 6h2a3 3 0 010 6H8" />
        </svg>
      );
    case "health":
      return (
        <svg {...props}>
          <path d="M12 21.35l-1.45-1.32C5.4 15.36 2 12.28 2 8.5 2 5.42 4.42 3 7.5 3c1.74 0 3.41.81 4.5 2.09C13.09 3.81 14.76 3 16.5 3 19.58 3 22 5.42 22 8.5c0 3.78-3.4 6.86-8.55 11.54L12 21.35z" />
        </svg>
      );
    case "pill":
      return (
        <svg {...props}>
          <path d="M10.5 1.5l-8 8a4.95 4.95 0 007 7l8-8a4.95 4.95 0 00-7-7z" />
          <path d="M7 10l6-6" fill="none" stroke="currentColor" strokeWidth="1.5" opacity="0.4" />
        </svg>
      );
    case "timer":
      return (
        <svg {...props}>
          <circle cx="12" cy="13" r="8" />
          <path d="M10 2h4" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
          <rect x="11.5" y="7" width="1" height="5" rx="0.5" opacity="0.6" />
          <rect x="12" y="11.5" width="3" height="1" rx="0.5" opacity="0.6" />
        </svg>
      );
    case "alarm":
      return (
        <svg {...props}>
          <circle cx="12" cy="13" r="8" />
          <path d="M5 3L2 6M22 6l-3-3" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
          <rect x="11.5" y="8" width="1" height="4.5" rx="0.5" opacity="0.7" />
          <rect x="12" y="12" width="2.5" height="1" rx="0.5" opacity="0.7" />
        </svg>
      );
    case "calendar":
      return (
        <svg {...props}>
          <path d="M19 4h-1V3a1 1 0 00-2 0v1H8V3a1 1 0 00-2 0v1H5a2 2 0 00-2 2v14a2 2 0 002 2h14a2 2 0 002-2V6a2 2 0 00-2-2zm0 16H5V10h14v10z" />
        </svg>
      );
    case "settings":
      return (
        <svg {...props}>
          <path d="M19.14 12.94c.04-.3.06-.61.06-.94 0-.32-.02-.64-.07-.94l2.03-1.58a.49.49 0 00.12-.61l-1.92-3.32a.49.49 0 00-.59-.22l-2.39.96c-.5-.38-1.03-.7-1.62-.94l-.36-2.54a.48.48 0 00-.48-.41h-3.84a.48.48 0 00-.48.41l-.36 2.54c-.59.24-1.13.57-1.62.94l-2.39-.96a.49.49 0 00-.59.22L2.74 8.87a.48.48 0 00.12.61l2.03 1.58c-.05.3-.07.62-.07.94s.02.64.07.94l-2.03 1.58a.49.49 0 00-.12.61l1.92 3.32c.12.22.37.29.59.22l2.39-.96c.5.38 1.03.7 1.62.94l.36 2.54c.05.24.24.41.48.41h3.84c.24 0 .44-.17.47-.41l.36-2.54c.59-.24 1.13-.56 1.62-.94l2.39.96c.22.08.47 0 .59-.22l1.92-3.32c.12-.22.07-.47-.12-.61l-2.01-1.58zM12 15.6A3.61 3.61 0 018.4 12 3.61 3.61 0 0112 8.4a3.61 3.61 0 013.6 3.6 3.61 3.61 0 01-3.6 3.6z" />
        </svg>
      );
    case "check":
      return (
        <svg {...props}>
          <path d="M9 16.2L4.8 12l-1.4 1.4L9 19 21 7l-1.4-1.4L9 16.2z" />
        </svg>
      );
    case "close":
      return (
        <svg {...props}>
          <path d="M19 6.41L17.59 5 12 10.59 6.41 5 5 6.41 10.59 12 5 17.59 6.41 19 12 13.41 17.59 19 19 17.59 13.41 12z" />
        </svg>
      );
    case "plus":
      return (
        <svg {...props}>
          <path d="M19 13h-6v6h-2v-6H5v-2h6V5h2v6h6v2z" />
        </svg>
      );
    case "chevron-right":
      return (
        <svg {...props}>
          <path d="M10 6L8.59 7.41 13.17 12l-4.58 4.59L10 18l6-6z" />
        </svg>
      );
    case "fire":
      return (
        <svg {...props}>
          <path d="M12 23c-4.97 0-9-3.13-9-7.5 0-3 2-5.5 4-7.5.67-.67 1.5-1.33 2-2 .5.67 1 1.33 1.5 2 .33.44.67.89 1 1.5.33-.89.83-1.72 1.5-2.5 1-1.17 2-2.5 2-4.5 0 0 4 3 4 8 0 4.5-3.03 7.5-7 12.5z" />
        </svg>
      );
    default:
      return (
        <svg {...props}>
          <circle cx="12" cy="12" r="6" />
        </svg>
      );
  }
}
