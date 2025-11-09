import { AppProviders } from "@/components/AppProviders";
import { GlobalOverlays } from "@/components/GlobalOverlays";
import { RouterView } from "@/components/RouterView";

/**
 * App: Top-level component with proper architectural separation.
 * 
 * Structure:
 * - AppProviders: All context providers (Auth, Query, Theme, etc.)
 *   - GlobalOverlays: Persistent UI that never re-renders from routing (Chat, Toasts, Banners)
 *   - RouterView: All page routing logic
 * 
 * This architecture ensures GlobalOverlays (including AI Chat) are completely independent
 * of page navigation, maintaining their state and scroll position across route changes.
 */
function App() {
  return (
    <AppProviders>
      <GlobalOverlays />
      <RouterView />
    </AppProviders>
  );
}

export default App;
