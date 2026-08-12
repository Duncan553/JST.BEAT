const store = new Map<string, { count: number; resetTime: number }>();

export function rateLimit(key: string, max: number, windowMs: number): { success: boolean; retryAfter?: number } {
  const now = Date.now();
  const record = store.get(key);
  if (!record || now > record.resetTime) {
    store.set(key, { count: 1, resetTime: now + windowMs });
    return { success: true };
  }
  if (record.count >= max) {
    return { success: false, retryAfter: Math.ceil((record.resetTime - now) / 1000) };
  }
  record.count++;
  return { success: true };
}
