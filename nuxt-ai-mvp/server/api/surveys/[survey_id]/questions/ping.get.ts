import type { H3Event } from "h3";

interface PingResponse {
  ping: "pong";
  ok: boolean;
  level: "survey_id/questions";
  survey_id: string | undefined;
  timestamp: string;
}

export default defineEventHandler((event: H3Event): PingResponse => {
  const surveyId = event.context.params?.survey_id;
  event.node.res.statusCode = 200; // OK
  return {
    ping: "pong",
    ok: true,
    level: "survey_id/questions",
    survey_id: surveyId,
    timestamp: new Date().toISOString(),
  };
});
