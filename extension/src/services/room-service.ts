import { Message } from '../protocol/messages';

export class RoomService {
  constructor(private ws: WebSocket) {}

  createRoom(): Promise<{ code: string; expiresAt: number }> {
    return new Promise((resolve, reject) => {
      const listener = (event: MessageEvent) => {
        try {
          const data: Message = JSON.parse(event.data);
          if (data.type === 'room_created') {
            this.ws.removeEventListener('message', listener);
            resolve(data.payload);
          }
        } catch (err) {}
      };
      
      this.ws.addEventListener('message', listener);
      
      const message: Message = {
        version: 1,
        type: 'create_room'
      };
      
      this.ws.send(JSON.stringify(message));
      
      setTimeout(() => {
        this.ws.removeEventListener('message', listener);
        reject(new Error('Timeout waiting for room creation'));
      }, 5000);
    });
  }

  joinRoom(code: string): Promise<{ expiresAt: number }> {
    return new Promise((resolve, reject) => {
      const listener = (event: MessageEvent) => {
        try {
          const data: Message = JSON.parse(event.data);
          if (data.type === 'join_success') {
            this.ws.removeEventListener('message', listener);
            resolve(data.payload);
          } else if (data.type === 'error') {
            this.ws.removeEventListener('message', listener);
            reject(new Error(data.payload.reason));
          }
        } catch (err) {}
      };
      
      this.ws.addEventListener('message', listener);
      
      const message: Message = {
        version: 1,
        type: 'join_room',
        payload: { code }
      };
      
      this.ws.send(JSON.stringify(message));
      
      setTimeout(() => {
        this.ws.removeEventListener('message', listener);
        reject(new Error('Timeout waiting for room join'));
      }, 5000);
    });
  }
}
