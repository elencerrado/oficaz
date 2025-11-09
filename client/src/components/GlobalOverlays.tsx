import * as React from "react";
import { Toaster } from "@/components/ui/toaster";
import { UserThemeManager } from "@/components/user-theme-manager";
import { GlobalDemoBanner } from "@/components/global-demo-banner";
import { AIAssistantChat } from "@/components/AIAssistantChat";
import CookieBanner from "@/components/CookieBanner";

/**
 * GlobalOverlays: Persistent UI elements that should never re-render due to routing.
 * This component is a sibling to RouterView, making it completely independent of page navigation.
 * 
 * Components here maintain their state (including scroll position) across all route changes.
 */
export const GlobalOverlays = React.memo(function GlobalOverlays() {
  return (
    <>
      <UserThemeManager />
      <GlobalDemoBanner />
      <Toaster />
      <AIAssistantChat />
      <CookieBanner />
    </>
  );
});
