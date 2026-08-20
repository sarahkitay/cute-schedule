import React, { useEffect, useRef, useState } from "react";
import ReactDOM from "react-dom";
import { MenuIcon } from "../Icons";
import { computeDropdownPosition } from "../dropdownPosition";

/**
 * ⋯ menu with optional Edit and Delete actions (no trash icon).
 */
export function RowMoreMenu({
  onEdit,
  onDelete,
  editLabel = "Edit",
  deleteLabel = "Delete",
  ariaLabel = "More options",
  className = "",
  disabled = false,
}) {
  const [open, setOpen] = useState(false);
  const triggerRef = useRef(null);

  useEffect(() => {
    if (!open) return undefined;
    const close = (e) => {
      if (triggerRef.current?.contains(e.target)) return;
      if (e.target.closest(".row-more-menu-portal")) return;
      setOpen(false);
    };
    const t = window.setTimeout(() => document.addEventListener("click", close), 0);
    return () => {
      window.clearTimeout(t);
      document.removeEventListener("click", close);
    };
  }, [open]);

  const toggle = (e) => {
    e.stopPropagation();
    if (disabled) return;
    setOpen((v) => !v);
  };

  const close = () => setOpen(false);

  const portal =
    open && triggerRef.current
      ? ReactDOM.createPortal(
          (() => {
            const rect = triggerRef.current.getBoundingClientRect();
            const { left, top, width, maxHeight } = computeDropdownPosition(rect, {
              panelWidth: 200,
              maxHeight: 160,
            });
            return (
              <div
                className="task-dropdown-portal row-more-menu-portal"
                style={{
                  position: "fixed",
                  left,
                  top,
                  width,
                  maxHeight,
                  maxWidth:
                    "min(100vw - 32px, calc(100vw - env(safe-area-inset-left, 0px) - env(safe-area-inset-right, 0px) - 16px))",
                  zIndex: "calc(var(--z-modal) - 8)",
                }}
                onClick={(e) => e.stopPropagation()}
              >
                <div className="task-dropdown">
                  {typeof onEdit === "function" ? (
                    <button
                      type="button"
                      className="dropdown-item"
                      onClick={() => {
                        onEdit();
                        close();
                      }}
                    >
                      {editLabel}
                    </button>
                  ) : null}
                  {typeof onDelete === "function" ? (
                    <button
                      type="button"
                      className="dropdown-item dropdown-item-danger"
                      onClick={() => {
                        onDelete();
                        close();
                      }}
                    >
                      {deleteLabel}
                    </button>
                  ) : null}
                </div>
              </div>
            );
          })(),
          document.body
        )
      : null;

  return (
    <div className={["row-more-menu-wrap", className].filter(Boolean).join(" ")}>
      <button
        ref={triggerRef}
        type="button"
        className={`icon-btn list-row-action list-row-more${open ? " is-active" : ""}`}
        onClick={toggle}
        aria-label={ariaLabel}
        aria-expanded={open}
        disabled={disabled}
      >
        <MenuIcon style={{ width: 18, height: 18 }} />
      </button>
      {portal}
    </div>
  );
}

/** Plain text delete control for inline list rows (settings, routines). */
export function DeleteTextButton({ onClick, disabled = false, ariaLabel = "Delete", children = "Delete" }) {
  return (
    <button
      type="button"
      className="btn btn-ghost btn-sm row-delete-btn"
      onClick={onClick}
      disabled={disabled}
      aria-label={ariaLabel}
    >
      {children}
    </button>
  );
}
