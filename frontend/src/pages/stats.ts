import Redis from "ioredis"; // Cache

// Payload type
export type Stats = {
  last_slot: number;
  total: {
    blocks: number;
    payloads: number;
  };
  daily: {
    blocks: number;
    payloads: number;
  };
  relays: { name: string; value: number; count: number; avg_value: number }[];
  builders: {
    pubkey: string;
    count: number;
    value: number;
    avg_value: number;
    last_relay: string;
  }[];
};

// Setup redis
const redis = new Redis(import.meta.env.REDIS_URL);

export async function get() {
  // Collect stats from Redis
  const statsStr: string | null = await redis.get("stats");
  const stats: Stats = JSON.parse(statsStr ?? "");

  return new Response(JSON.stringify(stats), { status: 200 });
}
