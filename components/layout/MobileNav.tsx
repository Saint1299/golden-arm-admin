"use client";

import {
  createContext,
  useCallback,
  useContext,
  useState,
  type ReactNode,
} from "react";

type MobileNavContextValue = {
  isOpen: boolean;
  toggle: () => void;
  close: () => void;
};

const MobileNavContext = createContext<MobileNavContextValue | null>(null);

export function MobileNavProvider({ children }: { children: ReactNode }) {
  const [isOpen, setIsOpen] = useState(false);
  const toggle = useCallback(() => setIsOpen((v) => !v), []);
  const close = useCallback(() => setIsOpen(false), []);
  return (
    <MobileNavContext.Provider value={{ isOpen, toggle, close }}>
      {children}
    </MobileNavContext.Provider>
  );
}

export function useMobileNav(): MobileNavContextValue {
  const ctx = useContext(MobileNavContext);
  if (!ctx) {
    throw new Error("useMobileNav must be used inside <MobileNavProvider>");
  }
  return ctx;
}

export function MobileOverlay() {
  const { isOpen, close } = useMobileNav();
  if (!isOpen) return null;
  return <div className="mobile-overlay" onClick={close} aria-hidden />;
}
