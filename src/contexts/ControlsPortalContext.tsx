import { createContext, useContext, useMemo, useState, type ReactNode } from "react";

interface ControlsPortalContextValue {
  node: ReactNode;
  setNode: (next: ReactNode) => void;
}

const ControlsPortalContext = createContext<ControlsPortalContextValue | undefined>(undefined);

export function ControlsPortalProvider({ children }: { children: ReactNode }) {
  const [node, setNode] = useState<ReactNode>(null);

  const value = useMemo(() => ({ node, setNode }), [node]);

  return <ControlsPortalContext.Provider value={value}>{children}</ControlsPortalContext.Provider>;
}

function useControlsPortalContext() {
  const ctx = useContext(ControlsPortalContext);
  if (!ctx) {
    throw new Error("ControlsPortalContext is missing. Wrap the tree with ControlsPortalProvider.");
  }
  return ctx;
}

export function useControlsPortalNode() {
  return useControlsPortalContext().node;
}

export function useRegisterControlsPortal() {
  return useControlsPortalContext().setNode;
}
