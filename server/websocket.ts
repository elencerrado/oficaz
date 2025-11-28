import { WebSocketServer, WebSocket } from 'ws';
import type { Server } from 'http';
import jwt from 'jsonwebtoken';
import type { User } from '@shared/schema';
import { JWT_SECRET } from './utils/jwt-secret.js';

interface AuthenticatedWebSocket extends WebSocket {
  userId?: number;
  companyId?: number;
  role?: string;
}

interface WSMessage {
  type: 'work_session_updated' | 'work_session_created' | 'work_session_deleted' | 
        'vacation_request_created' | 'vacation_request_updated' | 
        'modification_request_created' | 'modification_request_updated' |
        'document_request_created' | 'document_uploaded' |
        'message_received' | 'work_report_created' | 'reminder_all_completed';
  companyId: number;
  data?: any;
}

class WorkSessionWebSocketServer {
  private wss: WebSocketServer;
  private clients: Map<number, Set<AuthenticatedWebSocket>> = new Map(); // companyId -> clients

  constructor(server: Server) {
    this.wss = new WebSocketServer({ 
      server, 
      path: '/ws/work-sessions' 
    });

    this.wss.on('connection', this.handleConnection.bind(this));
    console.log('✓ WebSocket server initialized at /ws/work-sessions');
  }

  private handleConnection(ws: AuthenticatedWebSocket, req: any) {
    const url = new URL(req.url || '', `http://${req.headers.host}`);
    const token = url.searchParams.get('token');

    if (!token) {
      ws.close(1008, 'Authentication required');
      return;
    }

    // Verify JWT token
    try {
      const decoded = jwt.verify(token, JWT_SECRET) as any;
      ws.userId = decoded.userId;
      ws.companyId = decoded.companyId;
      ws.role = decoded.role;

      // Only allow admin and manager roles
      if (!['admin', 'manager'].includes(ws.role || '')) {
        ws.close(1008, 'Insufficient permissions');
        return;
      }

      // Add client to company's set
      if (!this.clients.has(ws.companyId!)) {
        this.clients.set(ws.companyId!, new Set());
      }
      this.clients.get(ws.companyId!)!.add(ws);

      console.log(`✓ WebSocket client connected: userId=${ws.userId}, companyId=${ws.companyId}`);

      // Send welcome message
      ws.send(JSON.stringify({ type: 'connected', message: 'WebSocket connection established' }));

      // Handle client messages
      ws.on('message', (message: string) => {
        try {
          const data = JSON.parse(message.toString());
          this.handleMessage(ws, data);
        } catch (error) {
          console.error('Error parsing WebSocket message:', error);
        }
      });

      // Handle disconnection
      ws.on('close', () => {
        this.removeClient(ws);
        console.log(`✗ WebSocket client disconnected: userId=${ws.userId}, companyId=${ws.companyId}`);
      });

      // Handle errors
      ws.on('error', (error) => {
        console.error('WebSocket error:', error);
        this.removeClient(ws);
      });

    } catch (error) {
      console.error('WebSocket authentication error:', error);
      ws.close(1008, 'Invalid token');
    }
  }

  private handleMessage(ws: AuthenticatedWebSocket, message: any) {
    // Handle ping/pong for keepalive
    if (message.type === 'ping') {
      ws.send(JSON.stringify({ type: 'pong' }));
    }
  }

  private removeClient(ws: AuthenticatedWebSocket) {
    if (ws.companyId && this.clients.has(ws.companyId)) {
      this.clients.get(ws.companyId)!.delete(ws);
      
      // Clean up empty company sets
      if (this.clients.get(ws.companyId)!.size === 0) {
        this.clients.delete(ws.companyId);
      }
    }
  }

  // Public method to broadcast updates to all clients in a company
  public broadcastToCompany(companyId: number, message: WSMessage) {
    const companyClients = this.clients.get(companyId);
    
    if (!companyClients || companyClients.size === 0) {
      return; // No clients connected for this company
    }

    const messageStr = JSON.stringify(message);
    let sentCount = 0;

    companyClients.forEach((client) => {
      if (client.readyState === WebSocket.OPEN) {
        client.send(messageStr);
        sentCount++;
      }
    });

    console.log(`📡 Broadcast to company ${companyId}: ${message.type} (${sentCount} clients)`);
  }

  // Get connected clients count for a company
  public getCompanyClientCount(companyId: number): number {
    return this.clients.get(companyId)?.size || 0;
  }
}

// Singleton instance
let wsServer: WorkSessionWebSocketServer | null = null;

export function initializeWebSocketServer(server: Server): WorkSessionWebSocketServer {
  if (!wsServer) {
    wsServer = new WorkSessionWebSocketServer(server);
  }
  return wsServer;
}

export function getWebSocketServer(): WorkSessionWebSocketServer | null {
  return wsServer;
}
