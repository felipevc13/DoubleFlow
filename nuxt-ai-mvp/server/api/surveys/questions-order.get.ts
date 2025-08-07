import type { H3Event } from "h3";

interface QuestionsOrderGetResponse {
  ok: boolean;
  msg: string;
  timestamp: string;
}

export default defineEventHandler(
  (event: H3Event): QuestionsOrderGetResponse => {
    event.node.res.statusCode = 200; // OK
    return {
      ok: true,
      msg: "GET questions-order funcionando!",
      timestamp: new Date().toISOString(),
    };
  }
);
