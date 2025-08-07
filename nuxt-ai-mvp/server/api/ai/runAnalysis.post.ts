import { H3Event } from "h3";
import { ofetch } from "ofetch";

const EXTRACTION_SERVICE_URL =
  process.env.EXTRACTION_SERVICE_URL || "http://localhost:8000";

export default defineEventHandler(async (event: H3Event) => {
  try {
    const body = await readBody(event);

    // Forward the request to the extraction service
    const response = await ofetch(`${EXTRACTION_SERVICE_URL}/extract`, {
      method: "POST",
      body: {
        text_content: body.textContent,
        instructions: body.instructions,
        examples: body.examples || [],
        kpi_data: body.kpiData,
      },
      headers: {
        "Content-Type": "application/json",
        // Add any required authentication headers here
      },
    });

    return response;
  } catch (error: any) {
    console.error("Error in runAnalysis API:", error);

    // Return a more detailed error message
    return createError({
      statusCode: error.response?.status || 500,
      statusMessage: error.message || "Internal Server Error",
      data: error.data || {},
    });
  }
});
