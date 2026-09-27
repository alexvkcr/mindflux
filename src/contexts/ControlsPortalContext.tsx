import { useCallback, useMemo, useState, type ReactNode } from "react";
import { ControlsPortalContext } from "./controlsPortal";

export function ControlsPortalProvider({ children }: { children: ReactNode }) {
  const [current, setCurrent] = useState<{ owner: symbol | null; node: ReactNode }>({ owner: null, node: null });
  const register = useCallback((owner: symbol, node: ReactNode) => {
    setCurrent(previous => {
      if (node !== null) return { owner, node };
      return previous.owner === owner ? { owner: null, node: null } : previous;
    });
  }, []);

  const value = useMemo(() => ({ node: current.node, register }), [current.node, register]);

  return <ControlsPortalContext.Provider value={value}>{children}</ControlsPortalContext.Provider>;
}
