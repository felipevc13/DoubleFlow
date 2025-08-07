import type { H3Event } from "h3";

interface PingResponse {
  ping: "pong";
  level: "survey_id";
  survey_id: string | undefined; // To include the actual survey_id from the route
  timestamp: string;
}

export default defineEventHandler((event: H3Event): PingResponse => {
  const surveyId = event.context.params?.survey_id;
  event.node.res.statusCode = 200; // OK
  return {
    ping: "pong",
    level: "survey_id",
    survey_id: surveyId,
    timestamp: new Date().toISOString(),
  };
});
