"use client";

import type { ReactNode } from "react";
import { NotifyProvider } from "@/components/providers/NotifyProvider";
import {
  HydrateSettings,
  SettingsProvider,
} from "@/components/providers/SettingsProvider";

export function AppProviders({ children }: { children: ReactNode }) {
  return (
    <SettingsProvider>
      <HydrateSettings />
      <NotifyProvider>{children}</NotifyProvider>
    </SettingsProvider>
  );
}
