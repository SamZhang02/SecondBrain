import type { FileWithPath } from "react-dropzone";

import { API_BASE_URL } from "@/lib/env";

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
