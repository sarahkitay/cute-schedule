import React from "react";

export function NavIcons({ name, size = 22, className = "" }) {
  const props = { width: size, height: size, className, viewBox: "0 0 24 24", fill: "none", stroke: "currentColor", strokeWidth: 1.8, strokeLinecap: "round", strokeLinejoin: "round" };

  switch (name) {
    case "home":
      return (
        <svg {...props}>
          <path d="M3 9.5L12 3l9 6.5V20a1 1 0 01-1 1H4a1 1 0 01-1-1V9.5z" />
          <path d="M9 21V12h6v9" />
        </svg>
      );
    case "plan":
      return (
        <svg {...props}>
          <rect x="3" y="4" width="18" height="18" rx="2" />
          <path d="M16 2v4M8 2v4M3 10h18" />
          <path d="M8 14h2M14 14h2M8 18h2" />
        </svg>
      );
    case "sparkle":
      return (
        <svg {...props} fill="currentColor" stroke="none">
          <path d="M12 2L13.8 8.2L20 10L13.8 11.8L12 18L10.2 11.8L4 10L10.2 8.2L12 2Z" />
          <path d="M19 15l.7 2.3L22 18l-2.3.7L19 21l-.7-2.3L16 18l2.3-.7L19 15z" opacity="0.6" />
        </svg>
      );
    case "insights":
      return (
        <svg {...props}>
          <path d="M3 20h18" />
          <path d="M6 16v4M10 12v8M14 8v12M18 4v16" />
        </svg>
      );
    case "user":
      return (
        <svg {...props}>
          <circle cx="12" cy="8" r="4" />
          <path d="M4 21c0-4.4 3.6-8 8-8s8 3.6 8 8" />
        </svg>
      );
    case "list":
      return (
        <svg {...props}>
          <path d="M8 6h13M8 12h13M8 18h13M3 6h.01M3 12h.01M3 18h.01" />
        </svg>
      );
    case "target":
      return (
        <svg {...props}>
          <circle cx="12" cy="12" r="9" />
          <circle cx="12" cy="12" r="5" />
          <circle cx="12" cy="12" r="1" fill="currentColor" />
        </svg>
      );
    case "notes":
      return (
        <svg {...props}>
          <path d="M14 2H6a2 2 0 00-2 2v16a2 2 0 002 2h12a2 2 0 002-2V8z" />
          <path d="M14 2v6h6M8 13h8M8 17h6" />
        </svg>
      );
    case "repeat":
      return (
        <svg {...props}>
          <path d="M17 2l4 4-4 4" />
          <path d="M3 11V9a4 4 0 014-4h14" />
          <path d="M7 22l-4-4 4-4" />
          <path d="M21 13v2a4 4 0 01-4 4H3" />
        </svg>
      );
    case "finance":
      return (
        <svg {...props}>
          <path d="M12 2v20M17 5H9.5a3.5 3.5 0 000 7h5a3.5 3.5 0 010 7H6" />
        </svg>
      );
    case "health":
      return (
        <svg {...props}>
          <path d="M18 4a4 4 0 00-4 4 4 4 0 00-4-4C7.2 4 5 6.2 5 9c0 5 7 9 7 9s7-4 7-9c0-2.8-2.2-5-5-5z" fill="none" />
          <path d="M12 13l2-3h-4l2-3" />
        </svg>
      );
    case "pill":
      return (
        <svg {...props}>
          <path d="M10.5 1.5l-8 8a4.95 4.95 0 007 7l8-8a4.95 4.95 0 00-7-7z" />
          <path d="M7 10l6-6" />
        </svg>
      );
    case "timer":
      return (
        <svg {...props}>
          <circle cx="12" cy="13" r="8" />
          <path d="M12 9v4l2.5 2.5M10 2h4M12 2v2" />
        </svg>
      );
    case "alarm":
      return (
        <svg {...props}>
          <path d="M12 5a7 7 0 107 7" />
          <path d="M12 9v4l3 2M5 3L2 6M22 6l-3-3M6 19l-2 2M18 19l2 2" />
        </svg>
      );
    case "calendar":
      return (
        <svg {...props}>
          <rect x="3" y="4" width="18" height="18" rx="2" />
          <path d="M16 2v4M8 2v4M3 10h18" />
        </svg>
      );
    case "settings":
      return (
        <svg {...props}>
          <circle cx="12" cy="12" r="3" />
          <path d="M19.4 15a1.65 1.65 0 00.33 1.82l.06.06a2 2 0 01-2.83 2.83l-.06-.06a1.65 1.65 0 00-1.82-.33 1.65 1.65 0 00-1 1.51V21a2 2 0 01-4 0v-.09A1.65 1.65 0 009 19.4a1.65 1.65 0 00-1.82.33l-.06.06a2 2 0 01-2.83-2.83l.06-.06A1.65 1.65 0 004.68 15a1.65 1.65 0 00-1.51-1H3a2 2 0 010-4h.09A1.65 1.65 0 004.6 9a1.65 1.65 0 00-.33-1.82l-.06-.06a2 2 0 012.83-2.83l.06.06A1.65 1.65 0 009 4.68a1.65 1.65 0 001-1.51V3a2 2 0 014 0v.09a1.65 1.65 0 001 1.51 1.65 1.65 0 001.82-.33l.06-.06a2 2 0 012.83 2.83l-.06.06A1.65 1.65 0 0019.4 9a1.65 1.65 0 001.51 1H21a2 2 0 010 4h-.09a1.65 1.65 0 00-1.51 1z" />
        </svg>
      );
    case "check":
      return (
        <svg {...props}>
          <path d="M20 6L9 17l-5-5" />
        </svg>
      );
    case "close":
      return (
        <svg {...props}>
          <path d="M18 6L6 18M6 6l12 12" />
        </svg>
      );
    case "plus":
      return (
        <svg {...props}>
          <path d="M12 5v14M5 12h14" />
        </svg>
      );
    case "chevron-right":
      return (
        <svg {...props}>
          <path d="M9 18l6-6-6-6" />
        </svg>
      );
    case "fire":
      return (
        <svg {...props} fill="currentColor" stroke="none">
          <path d="M12 23c-4.97 0-9-3.13-9-7.5 0-3 2-5.5 4-7.5.67-.67 1.5-1.33 2-2 .5.67 1 1.33 1.5 2 .33.44.67.89 1 1.5.33-.89.83-1.72 1.5-2.5 1-1.17 2-2.5 2-4.5 0 0 4 3 4 8 0 4.5-3.03 7.5-7 12.5z" opacity="0.9" />
        </svg>
      );
    default:
      return (
        <svg {...props}>
          <circle cx="12" cy="12" r="4" />
        </svg>
      );
  }
}
