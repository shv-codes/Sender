interface RateLimitOptions {
  max: number;
  windowMs: number;
}

export class RateLimiter {
  private records = new Map<string, { count: number; resetAt: number }>();

  constructor(private options: RateLimitOptions) {}

  /**
   * Checks if the key is within limits.
   * @param key The identifier (e.g., IP address or connection ID)
   * @param increment Whether to increment the counter. Default true.
   * @returns true if allowed, false if rate limited.
   */
  check(key: string, increment: boolean = true): boolean {
    const now = Date.now();
    let record = this.records.get(key);
    
    // If no record, or the time window has expired, reset it
    if (!record || now > record.resetAt) {
      record = { count: 0, resetAt: now + this.options.windowMs };
      this.records.set(key, record);
    }
    
    if (record.count >= this.options.max) {
      return false; // Rate limited
    }
    
    if (increment) {
      record.count++;
    }
    return true;
  }

  /** Periodically call this to avoid memory leaks from old entries */
  cleanup() {
    const now = Date.now();
    for (const [key, record] of this.records.entries()) {
      if (now > record.resetAt) {
        this.records.delete(key);
      }
    }
  }
}
