import * as React from "react";
import { useEffect, useRef } from "react";
import { useAuth } from "@/hooks/use-auth";
import { useToast } from "@/hooks/use-toast";
import { queryClient } from "@/lib/queryClient";
import { formatVacationPeriod } from "@/utils/dateUtils";

export function AdminWebSocketNotifications() {
  const { user } = useAuth();
  const { toast } = useToast();
  const wsRef = useRef<WebSocket | null>(null);
  const reconnectTimeoutRef = useRef<number | null>(null);

  useEffect(() => {
    const token = localStorage.getItem('token') || 
      JSON.parse(localStorage.getItem('authData') || '{}')?.token;
    
    if (!token || !user || (user.role !== 'admin' && user.role !== 'manager')) {
      return;
    }

    const connect = () => {
      if (wsRef.current?.readyState === WebSocket.OPEN) {
        return;
      }

      const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
      const host = window.location.host;
      const ws = new WebSocket(`${protocol}//${host}/ws/work-sessions?token=${token}`);
      wsRef.current = ws;

      ws.onopen = () => {
        console.log('🔔 Admin notifications WebSocket connected');
      };

      ws.onmessage = (event) => {
        try {
          const message = JSON.parse(event.data);
          console.log('📡 WebSocket notification:', message);

          if (message.type === 'message_received' && message.data) {
            toast({
              title: "💬 Nuevo mensaje",
              description: `${message.data.senderName} te ha enviado un mensaje`,
              duration: 8000
            });
            queryClient.invalidateQueries({ queryKey: ['/api/messages'] });
            queryClient.invalidateQueries({ queryKey: ['/api/messages/unread-count'] });
            queryClient.invalidateQueries({ queryKey: ['/api/admin/dashboard/summary'] });
          }
          
          if (message.type === 'document_uploaded' && message.data) {
            const docType = message.data.requestType ? ` (${message.data.requestType})` : '';
            toast({
              title: "📄 Documento subido",
              description: `${message.data.employeeName} ha subido un documento${docType}`,
              duration: 8000
            });
            queryClient.invalidateQueries({ queryKey: ['/api/documents'] });
            queryClient.invalidateQueries({ queryKey: ['/api/admin/dashboard/summary'] });
          }
          
          if (message.type === 'work_report_created' && message.data) {
            toast({
              title: "📋 Nuevo parte de trabajo",
              description: `${message.data.employeeName} ha enviado un parte desde ${message.data.location}`,
              duration: 8000
            });
            queryClient.invalidateQueries({ queryKey: ['/api/admin/work-reports'] });
            queryClient.invalidateQueries({ queryKey: ['/api/admin/dashboard/summary'] });
          }
          
          if (message.type === 'reminder_all_completed' && message.data) {
            toast({
              title: "✅ Recordatorio completado",
              description: `Todos (${message.data.completedCount}) han completado: ${message.data.title}`,
              duration: 8000
            });
            queryClient.invalidateQueries({ queryKey: ['/api/reminders'] });
            queryClient.invalidateQueries({ queryKey: ['/api/admin/dashboard/summary'] });
          }

          if (message.type === 'vacation_request_created' && message.data) {
            const { employeeName, startDate, endDate } = message.data;
            const periodText = startDate && endDate ? ` ${formatVacationPeriod(startDate, endDate)}` : '';
            toast({
              title: "📋 Nueva solicitud de vacaciones",
              description: employeeName 
                ? `${employeeName} ha solicitado vacaciones${periodText}`
                : "Se ha recibido una nueva solicitud de vacaciones",
              duration: 8000
            });
            queryClient.invalidateQueries({ queryKey: ['/api/vacation-requests'] });
            queryClient.invalidateQueries({ queryKey: ['/api/vacation-requests/company'] });
            queryClient.invalidateQueries({ queryKey: ['/api/admin/dashboard/summary'] });
          }

          if (message.type === 'modification_request_created' && message.data) {
            queryClient.invalidateQueries({ queryKey: ['/api/admin/work-sessions/modification-requests'] });
            queryClient.invalidateQueries({ queryKey: ['/api/admin/dashboard/summary'] });
          }

          if (message.type === 'work_session_created' || 
              message.type === 'work_session_updated' || 
              message.type === 'work_session_deleted') {
            queryClient.invalidateQueries({ queryKey: ['/api/work-sessions/company'] });
            queryClient.invalidateQueries({ queryKey: ['/api/admin/dashboard/summary'] });
          }
        } catch (error) {
          console.error('Error parsing WebSocket message:', error);
        }
      };

      ws.onerror = (error) => {
        console.error('WebSocket error:', error);
      };

      ws.onclose = () => {
        console.log('WebSocket disconnected, will reconnect in 5s...');
        wsRef.current = null;
        reconnectTimeoutRef.current = window.setTimeout(connect, 5000);
      };
    };

    connect();

    return () => {
      if (reconnectTimeoutRef.current) {
        clearTimeout(reconnectTimeoutRef.current);
      }
      if (wsRef.current) {
        wsRef.current.close();
        wsRef.current = null;
      }
    };
  }, [user, toast]);

  return null;
}
