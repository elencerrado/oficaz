import { useEffect } from "react";
import { useAuth } from "@/hooks/use-auth";
import { useToast } from "@/hooks/use-toast";
import { getAdminToastFromRealtimeEvent, subscribeRealtimeEvents } from "@/lib/realtime-events";

export function AdminWebSocketNotifications() {
  const { user } = useAuth();
  const { toast } = useToast();

  useEffect(() => {
    if (!user || (user.role !== "admin" && user.role !== "manager")) {
      return;
    }

    const unsubscribe = subscribeRealtimeEvents((event) => {
      const toastPayload = getAdminToastFromRealtimeEvent(event, user.id);
      if (toastPayload) {
        toast(toastPayload);
      }
    });

    return unsubscribe;
  }, [user?.id, user?.role, toast]);

  return null;
}
