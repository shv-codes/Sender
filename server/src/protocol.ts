export type ErrorReason = 
  | 'invalid_code' 
  | 'expired' 
  | 'room_full' 
  | 'text_too_large' 
  | 'not_sender' 
  | 'no_receiver' 
  | 'rate_limited' 
  | 'malformed_payload';

export type Message = 
  | { version: 1; type: 'TEST_MESSAGE'; payload: { text: string } }
  | { version: 1; type: 'TEST_RESPONSE'; payload: any }
  | { version: 1; type: 'create_room'; payload?: undefined }
  | { version: 1; type: 'room_created'; payload: { code: string; expiresAt: number } }
  | { version: 1; type: 'join_room'; payload: { code: string } }
  | { version: 1; type: 'join_success'; payload: { expiresAt: number } }
  | { version: 1; type: 'error'; payload: { reason: ErrorReason } }
  | { version: 1; type: 'peer_connected'; payload?: undefined }
  | { version: 1; type: 'peer_disconnected'; payload?: undefined }
  | { version: 1; type: 'send_text'; payload: { text: string } }
  | { version: 1; type: 'text_received'; payload: { text: string } };
