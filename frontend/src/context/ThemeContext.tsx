import React, { createContext, useContext, useState, useEffect } from 'react';

type Theme = 'theme-dark' | 'theme-light' | 'theme-vibrant';

interface ThemeContextType {
  theme: Theme;
  setTheme: (theme: Theme) => void;
}

const ThemeContext = createContext<ThemeContextType>({
  theme: 'theme-vibrant',
  setTheme: () => {}
});

export const useTheme = () => useContext(ThemeContext);

export const ThemeProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [theme, setThemeState] = useState<Theme>(() => {
    const saved = localStorage.getItem('app-theme') as Theme;
    return saved || 'theme-vibrant';
  });

  useEffect(() => {
    // Remove all possible theme classes
    document.documentElement.classList.remove('theme-dark', 'theme-light', 'theme-vibrant');
    // Add the selected theme class
    document.documentElement.classList.add(theme);
    localStorage.setItem('app-theme', theme);
  }, [theme]);

  return (
    <ThemeContext.Provider value={{ theme, setTheme: setThemeState }}>
      {children}
    </ThemeContext.Provider>
  );
};
