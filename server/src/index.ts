import { IncomingMessage } from 'http';
import { WebSocketServer, WebSocket } from 'ws';
import { Message } from './protocol.js';
import { roomManager } from './rooms.js';
import { CLEANUP_INTERVAL_MS, RATE_LIMITS } from './config.js';
import { RateLimiter } from './rate-limit.js';

const PORT = 8080;
const wss = new WebSocketServer({ port: PORT });

const joinFailureLimiter = new RateLimiter(RATE_LIMITS.JOIN_FAILURES);
const roomCreationLimiter = new RateLimiter(RATE_LIMITS.ROOM_CREATION);
const sendTextLimiter = new RateLimiter(RATE_LIMITS.SEND_TEXT);

// Set up periodic cleanup of expired rooms and old rate limit records
setInterval(() => {
  roomManager.cleanupExpiredRooms();
  joinFailureLimiter.cleanup();
  roomCreationLimiter.cleanup();
  sendTextLimiter.cleanup();
}, CLEANUP_INTERVAL_MS);

// Helper to get client IP cleanly, respecting standard proxies
function getClientIp(req: IncomingMessage): string {
  const forwarded = req.headers['x-forwarded-for'];
  const ip = Array.isArray(forwarded) ? forwarded[0] : forwarded?.split(',')[0].trim();
  return ip || req.socket.remoteAddress || 'unknown';
}

wss.on('connection', (ws: WebSocket, req: IncomingMessage) => {
  const ip = getClientIp(req);
  const connectionId = Math.random().toString(36).substring(2); // ephemeral ID for this specific socket
  
  console.log('Client connected'); // Non-sensitive operational log

  ws.on('message', (data: Buffer) => {
    let message: any;
    
    // 1. Input Validation: Strict JSON parse
    try {
      message = JSON.parse(data.toString());
    } catch (err) {
      ws.send(JSON.stringify({ version: 1, type: 'error', payload: { reason: 'malformed_payload' } }));
      return;
    }

    // 2. Input Validation: Type check
    if (!message || typeof message.type !== 'string') {
      ws.send(JSON.stringify({ version: 1, type: 'error', payload: { reason: 'malformed_payload' } }));
      return;
    }

    // Process valid messages
    try {
      if (message.type === 'create_room') {
        if (!roomCreationLimiter.check(ip)) {
          ws.send(JSON.stringify({ version: 1, type: 'error', payload: { reason: 'rate_limited' } }));
          return;
        }

        const room = roomManager.createRoom(ws);
        
        const response: Message = {
          version: 1,
          type: 'room_created',
          payload: { code: room.code, expiresAt: room.expiresAt }
        };
        ws.send(JSON.stringify(response));
        console.log('Room created.'); // Explicitly NOT logging the code or token
      } 
      else if (message.type === 'join_room') {
        const code = message.payload?.code;
        
        // Input validation: Must be exactly a 6-digit string
        if (typeof code !== 'string' || !/^\d{6}$/.test(code)) {
          ws.send(JSON.stringify({ version: 1, type: 'error', payload: { reason: 'invalid_code' } }));
          return;
        }

        // Check for brute-force lock out BEFORE attempting join
        if (!joinFailureLimiter.check(ip, false)) {
          ws.send(JSON.stringify({ version: 1, type: 'error', payload: { reason: 'rate_limited' } }));
          return;
        }

        const result = roomManager.joinRoom(code, ws);
        
        if (result.success) {
          const response: Message = {
            version: 1,
            type: 'join_success',
            payload: { expiresAt: result.expiresAt }
          };
          ws.send(JSON.stringify(response));
          console.log('Client joined a room successfully.');
          
          const notifySender: Message = { version: 1, type: 'peer_connected' };
          if (result.senderWs.readyState === WebSocket.OPEN) {
             result.senderWs.send(JSON.stringify(notifySender));
          }
        } else {
          // Join failed (invalid or expired) -> Count towards brute-force limit
          if (result.reason === 'invalid_code' || result.reason === 'expired') {
            joinFailureLimiter.check(ip, true); // increment failure count
          }
          
          const errorResponse: Message = {
            version: 1,
            type: 'error',
            payload: { reason: result.reason }
          };
          ws.send(JSON.stringify(errorResponse));
          console.log(`Join attempt failed: ${result.reason}`);
        }
      }
      else if (message.type === 'send_text') {
        if (!sendTextLimiter.check(connectionId)) {
          ws.send(JSON.stringify({ version: 1, type: 'error', payload: { reason: 'rate_limited' } }));
          return;
        }

        if (typeof message.payload?.text !== 'string') {
          ws.send(JSON.stringify({ version: 1, type: 'error', payload: { reason: 'malformed_payload' } }));
          return;
        }

        const result = roomManager.relayText(ws, message.payload.text);
        
        if (result.success) {
          const relayMsg: Message = {
            version: 1,
            type: 'text_received',
            payload: { text: message.payload.text }
          };
          if (result.receiverWs.readyState === WebSocket.OPEN) {
            result.receiverWs.send(JSON.stringify(relayMsg));
          }
        } else {
          const errorMsg: Message = {
            version: 1,
            type: 'error',
            payload: { reason: result.reason }
          };
          ws.send(JSON.stringify(errorMsg));
          console.log(`Text relay failed: ${result.reason}`);
        }
      }
      else if (message.type === 'TEST_MESSAGE') {
        const response: Message = {
          version: 1,
          type: 'TEST_RESPONSE',
          payload: { received: message, timestamp: Date.now() }
        };
        ws.send(JSON.stringify(response));
      }
    } catch (err) {
      console.error('Unexpected error processing message', err);
    }
  });

  ws.on('close', () => {
    console.log('Client disconnected');
    const { peerWs } = roomManager.handleDisconnect(ws);
    if (peerWs && peerWs.readyState === WebSocket.OPEN) {
      const msg: Message = { version: 1, type: 'peer_disconnected' };
      peerWs.send(JSON.stringify(msg));
    }
  });
});

console.log(`Relay server started on ws://localhost:${PORT}`);
