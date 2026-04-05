import React, { createContext, useContext, useState, useEffect } from "react";

interface PageToolbarContextType {
  toolbarContent: React.ReactNode;
  setToolbarContent: (content: React.ReactNode) => void;
  headerActions: React.ReactNode;
  setHeaderActions: (content: React.ReactNode) => void;
}

const PageToolbarContext = createContext<PageToolbarContextType>({
  toolbarContent: null,
  setToolbarContent: () => {},
  headerActions: null,
  setHeaderActions: () => {},
});

export const PageToolbarProvider = ({ children }: { children: React.ReactNode }) => {
  const [toolbarContent, setToolbarContent] = useState<React.ReactNode>(null);
  const [headerActions, setHeaderActions] = useState<React.ReactNode>(null);
  return (
    <PageToolbarContext.Provider value={{ toolbarContent, setToolbarContent, headerActions, setHeaderActions }}>
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

export const useHeaderActions = (content: React.ReactNode, deps: any[] = []) => {
  const { setHeaderActions } = useContext(PageToolbarContext);

  useEffect(() => {
    setHeaderActions(content);
    return () => setHeaderActions(null);
  }, deps);
};

export const usePageToolbarContent = () => {
  const { toolbarContent } = useContext(PageToolbarContext);
  return toolbarContent;
};

export const useHeaderActionsContent = () => {
  const { headerActions } = useContext(PageToolbarContext);
  return headerActions;
};
