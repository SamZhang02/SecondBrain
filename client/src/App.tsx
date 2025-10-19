import { useCallback, useEffect, useRef, useState } from "react";
import type { FileWithPath } from "react-dropzone";
import { useNavigate } from "react-router";

import UploadDropzone from "@/components/upload/UploadDropzone";
import UploadsCard from "@/components/upload/UploadsCard";
import { Button } from "@/components/ui/button";
import { mergeFiles, removeFile } from "@/lib/upload";

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
  const [isTransitioning, setIsTransitioning] = useState(false);
  const transitionTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(
    null,
  );
  const navigate = useNavigate();

  const handleDrop = useCallback((files: FileWithPath[]) => {
    setUploadedFiles((previousFiles) => mergeFiles(previousFiles, files));
  }, []);

  const handleRemoveFile = useCallback((fileToRemove: FileWithPath) => {
    setUploadedFiles((previousFiles) =>
      removeFile(previousFiles, fileToRemove),
    );
  }, []);

  const handleGenerate = useCallback(() => {
    if (!uploadedFiles.length) {
      return;
    }

    const filesToUpload = [...uploadedFiles];
    setUploadedFiles([]);
    setIsTransitioning(true);

    navigate("/result", { state: { files: filesToUpload } });
  }, [navigate, uploadedFiles]);

  useEffect(() => {
    return () => {
      if (transitionTimeoutRef.current) {
        clearTimeout(transitionTimeoutRef.current);
      }
      setIsTransitioning(false);
    };
  }, []);

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
          disabled={!hasUploads || isTransitioning}
          onClick={handleGenerate}
        >
          {isTransitioning ? "Preparing..." : "Generate"}
        </Button>
      </div>

      <div className="pointer-events-none absolute inset-x-0 top-40 -z-10 h-[520px] bg-gradient-radial from-primary/20 via-transparent to-transparent blur-3xl" />
    </div>
  );
};

export default App;
