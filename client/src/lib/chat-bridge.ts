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

const listeners = new Set<() => void>();

export const chatBridge = {
  getState: (): ChatBridgeState => chatBridgeState,
  
  setState: (newState: Partial<ChatBridgeState>) => {
    chatBridgeState = { ...chatBridgeState, ...newState };
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
