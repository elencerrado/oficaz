import { useEffect } from "react";
import { useAuth } from "@/hooks/use-auth";
import { useFeatureCheck } from "@/hooks/use-feature-check";
import { chatBridge } from "@/lib/chat-bridge";

/**
 * ChatBridge Component: Watches auth/feature state and publishes to bridge store.
 * This allows the isolated chat root to access auth data without re-rendering.
 */
export function ChatBridge() {
  const { user } = useAuth();
  const { hasAccess } = useFeatureCheck();
  const hasChatAccess = Boolean(user && hasAccess('ai_assistant'));
  
  useEffect(() => {
    console.log("🔗 ChatBridge updating state:", { hasUser: !!user, hasChatAccess });
    chatBridge.setState({
      userSummary: user ? {
        id: user.id,
        fullName: user.fullName,
        role: user.role,
      } : null,
      hasChatAccess,
    });
  }, [user, hasChatAccess]);
  
  return null; // This component only syncs state
}
