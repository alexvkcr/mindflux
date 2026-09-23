import { createContext, useContext, type ReactNode } from "react";

interface ControlsPortalContextValue {
  node: ReactNode;
  setNode: (next: ReactNode) => void;
}

export const ControlsPortalContext = createContext<ControlsPortalContextValue | undefined>(undefined);

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
