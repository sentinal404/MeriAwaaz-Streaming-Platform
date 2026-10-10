import React, { createContext, useContext, useState, useEffect } from 'react';

export type LayoutStyle = 'layout-youtube' | 'layout-instagram' | 'layout-news';

interface LayoutContextType {
  layout: LayoutStyle;
  setLayout: (layout: LayoutStyle) => void;
}

const LayoutContext = createContext<LayoutContextType>({
  layout: 'layout-news',
  setLayout: () => {}
});

export const useLayout = () => useContext(LayoutContext);

export const LayoutProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [layout, setLayoutState] = useState<LayoutStyle>(() => {
    const saved = localStorage.getItem('app-layout') as LayoutStyle;
    return saved || 'layout-news';
  });

  useEffect(() => {
    localStorage.setItem('app-layout', layout);
  }, [layout]);

  return (
    <LayoutContext.Provider value={{ layout, setLayout: setLayoutState }}>
      {children}
    </LayoutContext.Provider>
  );
};
