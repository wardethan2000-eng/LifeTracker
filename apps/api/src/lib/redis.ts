const redisUrl = process.env.REDIS_URL ?? "redis://localhost:6379";

export interface RedisConnectionOptions {
  host: string;
  port: number;
  username: string | undefined;
  password: string | undefined;
  db: number | undefined;
  maxRetriesPerRequest: null;
  tls: Record<string, never> | undefined;
}

export const getRedisConnectionOptions = (): RedisConnectionOptions => {
  const parsed = new URL(redisUrl);
  const username = parsed.username || undefined;
  const password = parsed.password || undefined;
  const database = parsed.pathname.length > 1 ? Number(parsed.pathname.slice(1)) : undefined;

  return {
    host: parsed.hostname,
    port: parsed.port ? Number(parsed.port) : 6379,
    username,
    password,
    db: Number.isFinite(database) ? database : undefined,
    maxRetriesPerRequest: null,
    tls: parsed.protocol === "rediss:" ? {} : undefined
  };
};