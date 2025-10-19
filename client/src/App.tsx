import { useCallback, useState } from "react";
import { Upload, X } from "lucide-react";
import type { Accept, FileWithPath } from "react-dropzone";
import { useDropzone } from "react-dropzone";

import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

const ACCEPTED_TYPES: Accept = {
  "application/pdf": [".pdf"],
  "text/plain": [".txt"],
  "text/markdown": [".md"],
};

const createFileKey = (file: FileWithPath) =>
  `${file.path ?? file.name}-${file.lastModified}-${file.size}`;

const App = () => {
  const [uploadedFiles, setUploadedFiles] = useState<FileWithPath[]>([]);

  const handleDrop = useCallback((files: FileWithPath[]) => {
    setUploadedFiles((previousFiles) => {
      const fileMap = new Map(
        previousFiles.map((file) => [createFileKey(file), file]),
      );

      files.forEach((file) => {
        fileMap.set(createFileKey(file), file);
      });

      return Array.from(fileMap.values());
    });
  }, []);

  const handleRemoveFile = useCallback((fileToRemove: FileWithPath) => {
    setUploadedFiles((previousFiles) =>
      previousFiles.filter(
        (file) => createFileKey(file) !== createFileKey(fileToRemove),
      ),
    );
  }, []);

  const { getRootProps, getInputProps, isFocused, isDragAccept, isDragReject } =
    useDropzone({
      accept: ACCEPTED_TYPES,
      multiple: true,
      onDrop: handleDrop,
    });

  const dropZoneClassName = cn(
    "group relative flex w-full max-w-2xl flex-col items-center gap-3 rounded-3xl border border-dashed border-border/60 bg-background/70 p-10 text-center transition-colors duration-200",
    isFocused && "border-primary/60",
    isDragAccept && "border-emerald-500/70 bg-emerald-500/5",
    isDragReject && "border-destructive/60 bg-destructive/10",
  );

  const hasUploads = uploadedFiles.length > 0;

  return (
    <div className="relative flex min-h-screen w-full justify-center overflow-hidden bg-gradient-to-br from-background via-background to-background/90 px-4 py-24">
      <div className="relative z-10 flex w-full max-w-3xl flex-col items-center gap-10">
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

        <div {...getRootProps({ className: dropZoneClassName })}>
          <input {...getInputProps()} />
          <div className="flex flex-col items-center gap-3">
            <div className="flex size-14 items-center justify-center rounded-full bg-primary/10 text-primary">
              <Upload className="size-6" aria-hidden="true" />
            </div>
            <div className="space-y-0">
              <p className="text-lg font-medium">Drag &amp; drop your notes</p>
              <p className="text-sm text-muted-foreground">
                or click to browse files on your device
              </p>
            </div>
            <p className="text-xs text-muted-foreground">
              Accepted formats: PDF, TXT, and Markdown (.md)
            </p>
          </div>
        </div>

        <div className="w-full max-w-2xl rounded-3xl border border-border/50 bg-background/80 p-6 text-left shadow-xs">
          <div className="flex items-center justify-between">
            <p className="text-xs font-semibold uppercase tracking-[0.4em] text-muted-foreground">
              Uploads
            </p>
            <span className="text-xs text-muted-foreground">
              {uploadedFiles.length} file(s)
            </span>
          </div>
          <div className="mt-4 rounded-2xl border border-border/40 bg-card/50">
            {hasUploads ? (
              <ul className="divide-y divide-border/60">
                {uploadedFiles.map((file) => {
                  const sizeInKb = Math.max(1, Math.round(file.size / 1024));

                  return (
                    <li
                      key={createFileKey(file)}
                      className="flex items-center gap-4 px-4 py-3 text-sm"
                    >
                      <div className="flex min-w-0 flex-1 items-center gap-3">
                        <span
                          className="truncate font-medium text-foreground"
                          title={file.name}
                        >
                          {file.name}
                        </span>
                        <span className="shrink-0 text-xs text-muted-foreground">
                          {sizeInKb} KB
                        </span>
                      </div>
                      <Button
                        type="button"
                        size="icon-sm"
                        variant="ghost"
                        className="shrink-0 text-muted-foreground hover:text-destructive"
                        onClick={() => handleRemoveFile(file)}
                        aria-label={`Remove ${file.name}`}
                      >
                        <X className="size-4" aria-hidden="true" />
                      </Button>
                    </li>
                  );
                })}
              </ul>
            ) : (
              <div className="px-4 py-8 text-center text-sm text-muted-foreground">
                Your uploaded documents will appear here.
              </div>
            )}
          </div>
        </div>

        <Button
          type="button"
          className="w-32 max-w-2xl"
          disabled={!hasUploads}
          onClick={() => {}}
        >
          Continue
        </Button>
      </div>

      <div className="pointer-events-none absolute inset-x-0 top-40 -z-10 h-[520px] bg-gradient-radial from-primary/20 via-transparent to-transparent blur-3xl" />
    </div>
  );
};

export default App;
