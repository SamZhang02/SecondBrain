import { useCallback, useState } from "react";
import type { FileWithPath } from "react-dropzone";

import UploadDropzone from "@/components/upload/UploadDropzone";
import UploadsCard from "@/components/upload/UploadsCard";
import { Button } from "@/components/ui/button";
import { mergeFiles, removeFile, uploadDocuments } from "@/lib/upload";

const Header = () => {
  return (
    <div className="space-y-4 text-center">
      <p className="text-sm uppercase tracking-[0.5em] text-primary/70">
        Second Brain
      </p>
      <h1 className="text-4xl font-semibold tracking-tight text-foreground sm:text-5xl lg:text-6xl">
        Organize your knowledge with calm intelligence
      </h1>
      <div>
        <p className="text-base text-muted-foreground sm:text-lg">
          Drop in the documents that matter,
        </p>
        <p className="text-base text-muted-foreground sm:text-lg">
          your second brain take it from there.
        </p>
      </div>
    </div>
  );
};

const App = () => {
  const [uploadedFiles, setUploadedFiles] = useState<FileWithPath[]>([]);
  const [isUploading, setIsUploading] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  const handleDrop = useCallback((files: FileWithPath[]) => {
    setErrorMessage(null);
    setUploadedFiles((previousFiles) => mergeFiles(previousFiles, files));
  }, []);

  const handleRemoveFile = useCallback((fileToRemove: FileWithPath) => {
    setUploadedFiles((previousFiles) =>
      removeFile(previousFiles, fileToRemove),
    );
  }, []);

  const handleGenerate = useCallback(async () => {
    setIsUploading(true);
    setErrorMessage(null);

    try {
      const status = await uploadDocuments(uploadedFiles);
      setUploadedFiles([]);
    } catch (error) {
      if (error instanceof Error) {
        setErrorMessage(error.message);
      } else {
        setErrorMessage("Something went wrong while uploading.");
      }
    } finally {
      setIsUploading(false);
    }
  }, [uploadedFiles]);

  const hasUploads = uploadedFiles.length > 0;

  return (
    <div className="relative flex min-h-screen w-full justify-center overflow-hidden bg-gradient-to-br from-background via-background to-background/90 px-4 py-24">
      <div className="relative z-10 flex w-full max-w-3xl flex-col items-center gap-10">
        <Header />

        <UploadDropzone onDrop={handleDrop} />

        <UploadsCard files={uploadedFiles} onRemove={handleRemoveFile} />

        <Button
          type="button"
          className="w-40 max-w-2xl"
          disabled={!hasUploads || isUploading}
          onClick={handleGenerate}
        >
          {isUploading ? "Uploading..." : "Generate"}
        </Button>
        {errorMessage && (
          <p className="text-sm text-destructive" role="alert">
            {errorMessage}
          </p>
        )}
      </div>

      <div className="pointer-events-none absolute inset-x-0 top-40 -z-10 h-[520px] bg-gradient-radial from-primary/20 via-transparent to-transparent blur-3xl" />
    </div>
  );
};

export default App;
