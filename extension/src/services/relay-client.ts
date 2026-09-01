import { Message, ErrorReason } from '../protocol/messages';
import { AppState } from '../state/app-state';
import { SERVER_URL } from './config';

export type StateListener = (state: AppState, data?: any) => void;

export class RelayClient {
  private ws: WebSocket | null = null;
  private state: AppState = AppState.DISCONNECTED;
  private listeners: StateListener[] = [];
  
  private currentRoomCode?: string;
  private currentExpiresAt?: number;
  private role?: 'sender' | 'receiver';
  
  private retryCount = 0;
  private maxRetries = 3;
  private isIntentionalClose = false;
  private expiryTimer: any;

  constructor(private serverUrl: string = SERVER_URL) {}

  onStateChange(listener: StateListener) {
    this.listeners.push(listener);
    // immediately fire with current state
    listener(this.state);
  }

  private setState(newState: AppState, data?: any) {
    this.state = newState;
    this.listeners.forEach(l => l(newState, data));
  }

  connect(): Promise<void> {
    this.isIntentionalClose = false;
    return new Promise((resolve, reject) => {
      this.ws = new WebSocket(this.serverUrl);
      
      this.ws.onopen = () => {
        this.retryCount = 0;
        if (this.state === AppState.DISCONNECTED || this.state === AppState.ERROR) {
          this.setState(AppState.IDLE);
        }
        resolve();
      };
      
      this.ws.onclose = () => {
        if (!this.isIntentionalClose) {
          this.setState(AppState.DISCONNECTED);
          this.attemptReconnect();
        }
      };
      
      this.ws.onerror = (err) => {
        if (this.state === AppState.DISCONNECTED && this.retryCount === 0) {
            reject(err);
        }
      };
      
      this.ws.onmessage = this.handleMessage.bind(this);
    });
  }

  private attemptReconnect() {
    if (this.retryCount >= this.maxRetries) {
      this.setState(AppState.ERROR, 'Connection lost. Max retries exceeded.');
      return;
    }
    
    this.retryCount++;
    const delay = this.retryCount * 1000;
    setTimeout(() => {
      this.connect().then(() => {
        this.setState(AppState.ERROR, 'Connection reset. Please start over.');
      }).catch(() => {});
    }, delay);
  }

  private handleMessage(event: MessageEvent) {
    try {
      const msg: Message = JSON.parse(event.data);
      
      switch (msg.type) {
        case 'room_created':
          this.currentRoomCode = msg.payload.code;
          this.currentExpiresAt = msg.payload.expiresAt;
          this.setState(AppState.WAITING, { code: msg.payload.code, expiresAt: msg.payload.expiresAt });
          this.startExpiryTimer(msg.payload.expiresAt);
          break;
        case 'join_success':
          this.currentExpiresAt = msg.payload.expiresAt;
          this.setState(AppState.CONNECTED, { role: this.role });
          this.startExpiryTimer(msg.payload.expiresAt);
          break;
        case 'peer_connected':
          this.setState(AppState.CONNECTED, { role: this.role });
          break;
        case 'peer_disconnected':
          if (this.role === 'sender') {
            this.setState(AppState.WAITING, { code: this.currentRoomCode, expiresAt: this.currentExpiresAt });
          } else {
            this.setState(AppState.ERROR, 'Sender disconnected. Room closed.');
          }
          break;
        case 'text_received':
          this.setState(AppState.RECEIVED, { text: msg.payload.text });
          // Optional: we can stay in RECEIVED, or auto-revert to CONNECTED
          break;
        case 'error':
          if (msg.payload.reason === 'invalid_code') this.setState(AppState.INVALID_CODE);
          else if (msg.payload.reason === 'expired') this.setState(AppState.ROOM_EXPIRED);
          else if (msg.payload.reason === 'text_too_large') this.setState(AppState.ERROR, 'Text is too large to send.');
          else if (msg.payload.reason === 'rate_limited') this.setState(AppState.ERROR, 'You are doing that too fast. Please wait a moment.');
          else if (msg.payload.reason === 'malformed_payload') this.setState(AppState.ERROR, 'An invalid message was sent to the server.');
          else this.setState(AppState.ERROR, 'An error occurred: ' + msg.payload.reason);
          break;
      }
    } catch (err) {}
  }

  private startExpiryTimer(expiresAt: number) {
    clearTimeout(this.expiryTimer);
    const msLeft = expiresAt - Date.now();
    if (msLeft <= 0) {
      this.setState(AppState.ROOM_EXPIRED);
    } else {
      this.expiryTimer = setTimeout(() => {
        this.setState(AppState.ROOM_EXPIRED);
      }, msLeft);
    }
  }

  createRoom() {
    this.role = 'sender';
    this.setState(AppState.CREATING);
    this.ws?.send(JSON.stringify({ version: 1, type: 'create_room' }));
  }

  joinRoom(code: string) {
    this.role = 'receiver';
    this.ws?.send(JSON.stringify({ version: 1, type: 'join_room', payload: { code } }));
  }

  sendText(text: string) {
    this.setState(AppState.SENDING);
    this.ws?.send(JSON.stringify({ version: 1, type: 'send_text', payload: { text } }));
    
    // Briefly show SENDING state then revert to CONNECTED
    setTimeout(() => {
      if (this.state === AppState.SENDING) {
        this.setState(AppState.CONNECTED, { role: this.role });
      }
    }, 400);
  }
}
