import { queryClient } from "@/lib/queryClient";
import { QueryClientProvider } from "@tanstack/react-query";
import { TooltipProvider } from "@/components/ui/tooltip";
import { AuthProvider } from "@/hooks/use-auth";
import { ThemeProvider } from "@/lib/theme-provider";
import { ChatBridge } from "@/components/ChatBridge";
import { EmployeeViewModeProvider } from "@/hooks/use-employee-view-mode";
import { SidebarScrollProvider } from "@/hooks/use-sidebar-scroll";

export function AppProviders({ children }: { children: React.ReactNode }) {
  return (
    <ThemeProvider defaultTheme="system" storageKey="oficaz-theme">
      <QueryClientProvider client={queryClient}>
        <AuthProvider>
          <EmployeeViewModeProvider>
            <SidebarScrollProvider>
              <ChatBridge />
              <TooltipProvider>
                {children}
              </TooltipProvider>
            </SidebarScrollProvider>
          </EmployeeViewModeProvider>
        </AuthProvider>
      </QueryClientProvider>
    </ThemeProvider>
  );
}
