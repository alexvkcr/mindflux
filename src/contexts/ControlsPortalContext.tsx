import { useMemo, useState, type ReactNode } from "react";
import { ControlsPortalContext } from "./controlsPortal";

export function ControlsPortalProvider({ children }: { children: ReactNode }) {
  const [node, setNode] = useState<ReactNode>(null);

  const value = useMemo(() => ({ node, setNode }), [node]);

  return <ControlsPortalContext.Provider value={value}>{children}</ControlsPortalContext.Provider>;
}
