"use client";

import {
  createContext,
  useCallback,
  useContext,
  useMemo,
  useState,
  type ReactNode,
} from "react";
import { AnimatePresence, motion } from "framer-motion";

interface Notice {
  id: number;
  message: string;
}

interface NotifyApi {
  notify: (message: string) => void;
}

const NotifyContext = createContext<NotifyApi | null>(null);

export function NotifyProvider({ children }: { children: ReactNode }) {
  const [notices, setNotices] = useState<Notice[]>([]);

  const notify = useCallback((message: string) => {
    const id = Date.now() + Math.random();
    setNotices((current) => [...current, { id, message }]);
    window.setTimeout(() => {
      setNotices((current) => current.filter((notice) => notice.id !== id));
    }, 3200);
  }, []);

  const value = useMemo(() => ({ notify }), [notify]);

  return (
    <NotifyContext.Provider value={value}>
      {children}
      <div className="pointer-events-none fixed top-4 right-4 z-50 flex w-80 flex-col gap-2">
        <AnimatePresence>
          {notices.map((notice) => (
            <motion.div
              key={notice.id}
              layout
              initial={{ opacity: 0, x: 24, scale: 0.96 }}
              animate={{ opacity: 1, x: 0, scale: 1 }}
              exit={{ opacity: 0, x: 24, scale: 0.96 }}
              transition={{ type: "spring", stiffness: 320, damping: 26 }}
              className="pointer-events-auto flex items-start gap-3 rounded-xl border border-[#dcc48a]/45 bg-[#1c130b]/92 px-4 py-3 text-sm text-[#f3ead8] shadow-[0_12px_30px_rgba(0,0,0,0.45)] backdrop-blur-sm"
              role="status"
            >
              <span aria-hidden="true" className="mt-0.5 h-2 w-2 shrink-0 rotate-45 bg-[#dcc48a] shadow-[0_0_8px_#dcc48a]" />
              <span>{notice.message}</span>
            </motion.div>
          ))}
        </AnimatePresence>
      </div>
    </NotifyContext.Provider>
  );
}

export function useNotify(): NotifyApi {
  const ctx = useContext(NotifyContext);
  if (!ctx) {
    throw new Error("useNotify must be used within NotifyProvider");
  }
  return ctx;
}
