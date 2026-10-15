"use client";

import { useState, type ReactNode } from "react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { Toaster } from "sonner";

import { AppBootstrap } from "@/components/system/AppBootstrap";
import { SettingsProvider } from "@/context/SettingsContext";
import { AccountProvider } from "@/context/AccountContext";
import { useAccountSync } from "@/hooks/useAccountSync";

/** Bridges the account sync hook (which needs AccountProvider context). */
function AccountSyncBridge() {
  useAccountSync();
  return null;
}

export default function Providers({ children }: { children: ReactNode }) {
  const [queryClient] = useState(
    () =>
      new QueryClient({
        defaultOptions: {
          queries: {
            refetchOnWindowFocus: false,
            retry: 1,
            staleTime: 1000 * 60 * 5,
          },
        },
      }),
  );

  return (
    <QueryClientProvider client={queryClient}>
      <AccountProvider>
        <SettingsProvider>
          <AppBootstrap />
          <AccountSyncBridge />
          {children}
          <Toaster richColors closeButton position="top-right" theme="dark" />
        </SettingsProvider>
      </AccountProvider>
    </QueryClientProvider>
  );
}
