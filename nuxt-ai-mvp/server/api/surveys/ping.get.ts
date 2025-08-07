import type { H3Event } from "h3";

interface PingResponse {
  ping: "pong";
  ok: boolean;
  timestamp: string; // Added timestamp for more robust ping
}

export default defineEventHandler((event: H3Event): PingResponse => {
  event.node.res.statusCode = 200; // OK
  return {
    ping: "pong",
    ok: true,
    timestamp: new Date().toISOString(),
  };
});
