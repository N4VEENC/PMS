import { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react';

const STORAGE_KEY = 'portfolio_color_mode';
const ColorModeContext = createContext({ mode: 'light', toggle: () => {} });

const readSaved = () => {
  try {
    return localStorage.getItem(STORAGE_KEY) === 'dark' ? 'dark' : 'light';
  } catch {
    return 'light';
  }
};

/** Default app theme is white; dark mode remains available only if explicitly restored from storage. */
export function ColorModeProvider({ children }) {
  const [mode, setMode] = useState(readSaved);

  useEffect(() => {
    document.documentElement.classList.toggle('dark', mode === 'dark');
    try { localStorage.setItem(STORAGE_KEY, mode); } catch { /* private mode: just don't remember it */ }
  }, [mode]);

  const toggle = useCallback(() => setMode((current) => (current === 'dark' ? 'light' : 'dark')), []);
  const value = useMemo(() => ({ mode, toggle }), [mode, toggle]);
  return <ColorModeContext.Provider value={value}>{children}</ColorModeContext.Provider>;
}

export const useColorMode = () => useContext(ColorModeContext);
