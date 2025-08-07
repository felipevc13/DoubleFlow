import { runAnalysis } from "~/server/api/ai/runAnalysis";

export default defineEventHandler(async (event) => {
  try {
    const { analysisKey, nodeData } = await readBody(event);

    if (!analysisKey || !nodeData) {
      throw createError({
        statusCode: 400,
        statusMessage: "Missing analysisKey or nodeData in request body.",
      });
    }

    const result = await runAnalysis(analysisKey, nodeData);
    return result;
  } catch (error: any) {
    console.error("Error running analysis:", error);
    throw createError({
      statusCode: 500,
      statusMessage: error.message || "Failed to run analysis.",
    });
  }
});
