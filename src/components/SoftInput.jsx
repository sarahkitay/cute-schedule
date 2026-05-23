import React from "react";

export function SoftInput({ placeholder, value, onChange, onSubmit, className = "", children, ...props }) {
  return (
    <div className={`py-input-group ${className}`}>
      <input
        className="py-input-group__field"
        placeholder={placeholder}
        value={value}
        onChange={onChange}
        onKeyDown={(e) => e.key === "Enter" && onSubmit?.()}
        {...props}
      />
      {children}
    </div>
  );
}

export function TextInput({ className = "", ...props }) {
  return <input className={`py-input ${className}`} {...props} />;
}
