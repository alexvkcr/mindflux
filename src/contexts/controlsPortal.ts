import { createContext, useCallback, useContext, useRef, type ReactNode } from "react";

interface ControlsPortalContextValue {
  node: ReactNode;
  register: (owner: symbol, next: ReactNode) => void;
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
  const { register } = useControlsPortalContext();
  const owner = useRef(Symbol("controls-portal-owner"));
  return useCallback((next: ReactNode) => register(owner.current, next), [register]);
}
