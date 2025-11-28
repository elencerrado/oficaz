import * as React from "react";
import { Toaster } from "@/components/ui/toaster";
import { UserThemeManager } from "@/components/user-theme-manager";
import { GlobalDemoBanner } from "@/components/global-demo-banner";
import CookieBanner from "@/components/CookieBanner";
import { AdminWebSocketNotifications } from "@/components/AdminWebSocketNotifications";

/**
 * GlobalOverlays: Persistent UI elements that should never re-render due to routing.
 * This component is a sibling to RouterView, making it completely independent of page navigation.
 * 
 * NOTE: AIAssistantChat is now mounted in a separate React root (#chat-root)
 * to guarantee 100% isolation from route navigation.
 */
export const GlobalOverlays = React.memo(function GlobalOverlays() {
  return (
    <>
      <UserThemeManager />
      <GlobalDemoBanner />
      <Toaster />
      <CookieBanner />
      <AdminWebSocketNotifications />
    </>
  );
});
