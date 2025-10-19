import { useDropzone } from "react-dropzone";
import type { Accept, FileWithPath } from "react-dropzone";
import { Upload } from "lucide-react";

import { cn } from "@/lib/utils";

const ACCEPTED_TYPES: Accept = {
  "application/pdf": [".pdf"],
  "text/plain": [".txt"],
  "text/markdown": [".md"],
};

interface UploadDropzoneProps {
  onDrop: (files: FileWithPath[]) => void;
}

const UploadDropzone = ({ onDrop }: UploadDropzoneProps) => {
  const { getRootProps, getInputProps, isFocused, isDragAccept, isDragReject } =
    useDropzone({
      accept: ACCEPTED_TYPES,
      multiple: true,
      onDrop,
    });

  const dropZoneClassName = cn(
    "group relative flex w-full max-w-2xl flex-col items-center gap-3 rounded-3xl border border-dashed border-border/60 bg-background/70 p-10 text-center transition-colors duration-200",
    isFocused && "border-primary/60",
    isDragAccept && "border-emerald-500/70 bg-emerald-500/5",
    isDragReject && "border-destructive/60 bg-destructive/10",
  );

  return (
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
  );
};

export default UploadDropzone;
