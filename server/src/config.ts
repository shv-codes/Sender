export const ROOM_EXPIRY_MS = 10 * 60 * 1000; // 10 minutes
export const CLEANUP_INTERVAL_MS = 60 * 1000; // 1 minute

// 64KB max payload size. 
// Reasoning: 64KB is comfortably large enough for copying long articles, 
// blocks of code, or multiple paragraphs, but small enough to avoid 
// huge WebSocket frame allocations and memory bloat on our lightweight server.
export const MAX_TEXT_PAYLOAD_BYTES = 64 * 1024;

export const RATE_LIMITS = {
  // HIGHEST PRIORITY: Prevent brute-forcing of the 6-digit (1M combo) space.
  // 5 failed attempts per IP per 5 minutes.
  // Reasoning: A real user making typos might fail 1-3 times. 5 gives breathing room.
  // A 5 minute lockout limits an attacker to 1440 attempts/day per IP, rendering
  // a brute force attack entirely impractical without a massive botnet.
  JOIN_FAILURES: { max: 5, windowMs: 5 * 60 * 1000 },
  
  // Prevent spamming room creation (memory exhaustion & short-code space pressure).
  // 10 rooms per IP per hour. 
  // Reasoning: Normal usage is extremely unlikely to exceed 10 rooms an hour.
  ROOM_CREATION: { max: 10, windowMs: 60 * 60 * 1000 },
  
  // Prevent flooding text messages on the connection.
  // 100 messages per minute per connection.
  // Reasoning: Covers rapid typing/sending, but stops runaway scripts from burning CPU.
  SEND_TEXT: { max: 100, windowMs: 60 * 1000 }
};
