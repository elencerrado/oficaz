/**
 * ChatBridge: External store for chat state that bridges auth/feature data
 * from the main React tree to the isolated chat root.
 * 
 * This allows the chat to access user/auth data without subscribing to React
 * contexts that cause re-renders on navigation.
 */

interface ChatBridgeState {
  userSummary: {
    id: number;
    fullName: string;
    role: string;
  } | null;
  hasChatAccess: boolean;
}

let chatBridgeState: ChatBridgeState = {
  userSummary: null,
  hasChatAccess: false,
};

// Navigation event for AI assistant to trigger SPA navigation
export function triggerAINavigation(url: string) {
  window.dispatchEvent(new CustomEvent('ai-assistant-navigate', { detail: { url } }));
}

// Cache last valid state to prevent unmounting during auth refetch
let lastValidState: ChatBridgeState | null = null;

const listeners = new Set<() => void>();

export const chatBridge = {
  getState: (): ChatBridgeState => chatBridgeState,
  
  setState: (newState: Partial<ChatBridgeState>) => {
    // CRITICAL: Don't clear state during auth loading - use cached state
    if (newState.userSummary && newState.hasChatAccess) {
      // Valid state - cache it
      lastValidState = { ...chatBridgeState, ...newState };
      chatBridgeState = lastValidState;
    } else if (lastValidState && !newState.userSummary && chatBridgeState.userSummary) {
      // Auth is temporarily null (refetching) - keep last valid state
      console.log("🔒 ChatBridge: Preserving cached state during auth reload");
      return; // DON'T update state or notify listeners
    } else {
      // First load or logout - update normally
      chatBridgeState = { ...chatBridgeState, ...newState };
    }
    
    listeners.forEach(listener => listener());
  },
  
  subscribe: (listener: () => void) => {
    listeners.add(listener);
    return () => {
      listeners.delete(listener);
    };
  },
};

// React hook to use bridge state
export function useChatBridge(): ChatBridgeState {
  const [state, setState] = React.useState(chatBridge.getState());
  
  React.useEffect(() => {
    const unsubscribe = chatBridge.subscribe(() => {
      setState(chatBridge.getState());
    });
    return unsubscribe;
  }, []);
  
  return state;
}

import * as React from "react";
