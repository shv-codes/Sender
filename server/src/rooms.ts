import crypto from 'crypto';
import { WebSocket } from 'ws';
import { ROOM_EXPIRY_MS, MAX_TEXT_PAYLOAD_BYTES } from './config.js';
import { ErrorReason } from './protocol.js';

export interface Room {
  token: string;
  code: string;
  expiresAt: number;
  senderWs: WebSocket;
  receiverWs?: WebSocket;
}

export type JoinResult = 
  | { success: true; expiresAt: number; senderWs: WebSocket }
  | { success: false; reason: ErrorReason };

export type RelayResult = 
  | { success: true; receiverWs: WebSocket }
  | { success: false; reason: ErrorReason };

export class RoomManager {
  private roomsByToken = new Map<string, Room>();
  private codesToTokens = new Map<string, string>();
  private wsToToken = new Map<WebSocket, string>();

  createRoom(senderWs: WebSocket): Room {
    const token = crypto.randomBytes(32).toString('hex');
    const expiresAt = Date.now() + ROOM_EXPIRY_MS;
    
    let code = '';
    let attempts = 0;
    do {
      const num = crypto.randomInt(0, 1000000);
      code = num.toString().padStart(6, '0');
      attempts++;
      if (attempts > 100) {
        throw new Error('Failed to generate a unique room code');
      }
    } while (this.codesToTokens.has(code));

    const room: Room = { token, code, expiresAt, senderWs };
    this.roomsByToken.set(token, room);
    this.codesToTokens.set(code, token);
    this.wsToToken.set(senderWs, token);
    
    return room;
  }

  joinRoom(code: string, receiverWs: WebSocket): JoinResult {
    const token = this.codesToTokens.get(code);
    if (!token) return { success: false, reason: 'invalid_code' };
    
    const room = this.roomsByToken.get(token);
    if (!room) return { success: false, reason: 'invalid_code' };

    if (room.expiresAt <= Date.now()) return { success: false, reason: 'expired' };
    if (room.receiverWs) return { success: false, reason: 'room_full' };

    room.receiverWs = receiverWs;
    this.wsToToken.set(receiverWs, token);
    return { success: true, expiresAt: room.expiresAt, senderWs: room.senderWs };
  }

  relayText(senderWs: WebSocket, text: string): RelayResult {
    const token = this.wsToToken.get(senderWs);
    if (!token) return { success: false, reason: 'not_sender' };
    
    const room = this.roomsByToken.get(token);
    if (!room || room.senderWs !== senderWs) return { success: false, reason: 'not_sender' };
    
    if (!room.receiverWs) return { success: false, reason: 'no_receiver' };
    
    // Check byte length to safely enforce MAX_TEXT_PAYLOAD_BYTES
    if (Buffer.byteLength(text, 'utf8') > MAX_TEXT_PAYLOAD_BYTES) {
      return { success: false, reason: 'text_too_large' };
    }

    return { success: true, receiverWs: room.receiverWs };
  }

  handleDisconnect(ws: WebSocket): { peerWs?: WebSocket } {
    const token = this.wsToToken.get(ws);
    if (!token) return {};

    const room = this.roomsByToken.get(token);
    if (!room) {
      this.wsToToken.delete(ws);
      return {};
    }

    let peerWs: WebSocket | undefined;
    
    if (room.senderWs === ws) {
      peerWs = room.receiverWs;
      // Sender disconnected: room is dead. Cleanup everything.
      this.roomsByToken.delete(token);
      this.codesToTokens.delete(room.code);
      this.wsToToken.delete(ws);
      if (peerWs) this.wsToToken.delete(peerWs);
    } else if (room.receiverWs === ws) {
      peerWs = room.senderWs;
      // Receiver disconnected: sender is still active, room stays alive, waiting for receiver.
      room.receiverWs = undefined;
      this.wsToToken.delete(ws);
    }

    return { peerWs };
  }

  cleanupExpiredRooms() {
    const now = Date.now();
    for (const [token, room] of this.roomsByToken.entries()) {
      if (room.expiresAt <= now) {
        this.roomsByToken.delete(token);
        this.codesToTokens.delete(room.code);
        this.wsToToken.delete(room.senderWs);
        if (room.receiverWs) this.wsToToken.delete(room.receiverWs);
        
        // Notify peers if still open before dropping references
        const disconnectMsg = JSON.stringify({ version: 1, type: 'peer_disconnected' });
        if (room.senderWs.readyState === WebSocket.OPEN) {
          room.senderWs.send(disconnectMsg);
        }
        if (room.receiverWs && room.receiverWs.readyState === WebSocket.OPEN) {
          room.receiverWs.send(disconnectMsg);
        }
      }
    }
  }
}

export const roomManager = new RoomManager();
