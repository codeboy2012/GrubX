import type { ReactNode } from "react";
import { cookies, headers } from "next/headers";

import { Footer } from "@/components/shell/Footer";
import { MobileShell } from "@/components/shell/MobileShell";
import { Navbar } from "@/components/shell/Navbar";
import { OfflineBanner } from "@/components/system/OfflineBanner";
import { SkipLink } from "@/components/system/SkipLink";

/**
 * Desktop shell (top nav + footer) or the mobile-first shell.
 *
 * The mobile experience is selected by the `x-grubx-mobile` request header set
 * in `middleware.ts`, which reflects the `mobile.*` subdomain, an explicit
 * `?device=` choice, or the saved `grubx-device` cookie.
 */
export async function AppShell({ children }: { children: ReactNode }) {
  const [headerList, cookieStore] = await Promise.all([headers(), cookies()]);
  const mobile =
    headerList.get("x-grubx-mobile") === "1" || cookieStore.get("grubx-device")?.value === "mobile";

  if (mobile) {
    return (
      <div className="grain min-h-screen overflow-x-hidden">
        <SkipLink />
        <MobileShell banner={<OfflineBanner />}>{children}</MobileShell>
      </div>
    );
  }

  return (
    <div className="grain min-h-screen overflow-x-hidden">
      <SkipLink />
      <Navbar />
      <div className="app-shell-content pb-10">
        <OfflineBanner />
        <main id="main" tabIndex={-1}>{children}</main>
        <Footer />
      </div>
    </div>
  );
}
