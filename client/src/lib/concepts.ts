import { API_BASE_URL } from "@/lib/env";

interface ConceptResponseBody {
  summary?: string;
  description?: string;
  detail?: string;
  message?: string;
  concept?: string;
}

export const fetchConceptSummary = async (
  conceptName: string,
): Promise<string> => {
  const response = await fetch(
    `${API_BASE_URL}/concepts/${encodeURIComponent(conceptName)}`,
  );

  let body: ConceptResponseBody | string | undefined;

  try {
    body = (await response.json()) as ConceptResponseBody | string;
  } catch {
    body = undefined;
  }

  if (!response.ok) {
    const errorMessage =
      typeof body === "object" && body
        ? body.detail ?? body.message ?? "Failed to fetch concept summary"
        : "Failed to fetch concept summary";

    throw new Error(errorMessage);
  }

  if (typeof body === "string") {
    return body;
  }

  if (typeof body === "object" && body) {
    const summary = body.summary ?? body.description ?? body.detail ?? body.message;
    if (summary) {
      return summary;
    }
  }

  return "";
};
