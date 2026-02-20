import React, { createContext, useContext, useState, useCallback, useEffect } from "react";

interface PageToolbarContextType {
  toolbarContent: React.ReactNode;
  setToolbarContent: (content: React.ReactNode) => void;
}

const PageToolbarContext = createContext<PageToolbarContextType>({
  toolbarContent: null,
  setToolbarContent: () => {},
});

export const PageToolbarProvider = ({ children }: { children: React.ReactNode }) => {
  const [toolbarContent, setToolbarContent] = useState<React.ReactNode>(null);
  return (
    <PageToolbarContext.Provider value={{ toolbarContent, setToolbarContent }}>
      {children}
    </PageToolbarContext.Provider>
  );
};

export const usePageToolbar = (content: React.ReactNode, deps: any[] = []) => {
  const { setToolbarContent } = useContext(PageToolbarContext);
  
  useEffect(() => {
    setToolbarContent(content);
    return () => setToolbarContent(null);
  }, deps);
};

export const usePageToolbarContent = () => {
  const { toolbarContent } = useContext(PageToolbarContext);
  return toolbarContent;
};
