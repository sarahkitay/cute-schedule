import React, { createContext, useContext, useMemo } from "react";
import { ICON_STYLE_COLORFUL, isDarkTheme, normalizeIconStyle, useSimpleIcons } from "./iconStyle";

const IconStyleContext = createContext({
  iconStyle: ICON_STYLE_COLORFUL,
  isDark: false,
  useSimpleIcons: false,
});

export function IconStyleProvider({ iconStyle, theme, children }) {
  const value = useMemo(() => {
    const normalized = normalizeIconStyle(iconStyle);
    const dark = isDarkTheme(theme);
    const simple = useSimpleIcons(normalized);
    return {
      iconStyle: normalized,
      isDark: dark,
      useSimpleIcons: simple,
      /** @deprecated use useSimpleIcons */
      useSimpleDark: simple,
    };
  }, [iconStyle, theme]);

  return <IconStyleContext.Provider value={value}>{children}</IconStyleContext.Provider>;
}

export function useIconStyle() {
  return useContext(IconStyleContext);
}
