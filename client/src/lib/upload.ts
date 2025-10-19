import type { FileWithPath } from "react-dropzone";

import { API_BASE_URL } from "@/lib/env";
import type { ForceGraphData } from "@/lib/graph";

export const createFileKey = (file: FileWithPath) =>
  `${file.path ?? file.name}-${file.lastModified}-${file.size}`;

export const mergeFiles = (
  existingFiles: FileWithPath[],
  newFiles: FileWithPath[],
) => {
  const fileMap = new Map(
    existingFiles.map((file) => [createFileKey(file), file]),
  );

  newFiles.forEach((file) => {
    fileMap.set(createFileKey(file), file);
  });

  return Array.from(fileMap.values());
};

export const removeFile = (
  existingFiles: FileWithPath[],
  fileToRemove: FileWithPath,
) =>
  existingFiles.filter(
    (file) => createFileKey(file) !== createFileKey(fileToRemove),
  );

interface StatusResponseBody {
  status?: string;
  detail?: string;
}

interface ErrorResponseBody {
  detail?: string;
  message?: string;
}

export interface PipelineStatus {
  state: string;
  compressed_documents: string[];
  extracted_documents: Record<string, string[]>;
  populated_concepts: string[];
  graph?: ForceGraphData | null;
  message?: string | null;
}

export const uploadDocuments = async (
  files: FileWithPath[],
): Promise<string> => {
  const formData = new FormData();

  files.forEach((file) => {
    formData.append("documents", file);
  });

  const response = await fetch(`${API_BASE_URL}/upload`, {
    method: "POST",
    body: formData,
  });

  let body: StatusResponseBody | undefined;

  try {
    body = (await response.json()) as StatusResponseBody;
  } catch (error) {
    body = undefined;
  }

  if (!response.ok) {
    throw new Error(body?.detail ?? "Failed to upload documents");
  }

  return body?.status ?? "Upload succeeded";
};

export const fetchPipelineStatus = async (): Promise<PipelineStatus> => {
  const response = await fetch(`${API_BASE_URL}/status`);

  if (!response.ok) {
    let errorBody: ErrorResponseBody | undefined;
    try {
      errorBody = (await response.json()) as ErrorResponseBody;
    } catch (error) {
      errorBody = undefined;
    }

    throw new Error(
      errorBody?.detail ??
        errorBody?.message ??
        "Failed to fetch pipeline status",
    );
  }

  const body = (await response.json()) as PipelineStatus;

  return {
    state: body.state,
    compressed_documents: body.compressed_documents ?? [],
    extracted_documents: body.extracted_documents ?? {},
    populated_concepts: body.populated_concepts ?? [],
    graph: body.graph,
    message: body.message ?? null,
  };
};

export const resetPipelineStatus = async (): Promise<void> => {
  const response = await fetch(`${API_BASE_URL}/status/reset`, {
    method: "POST",
  });

  if (!response.ok) {
    let errorBody: ErrorResponseBody | undefined;
    try {
      errorBody = (await response.json()) as ErrorResponseBody;
    } catch (error) {
      errorBody = undefined;
    }

    const message =
      errorBody?.detail ??
      errorBody?.message ??
      "Failed to reset pipeline status";
    throw new Error(message);
  }
};
