import { X } from "lucide-react";
import type { FileWithPath } from "react-dropzone";

import { Button } from "@/components/ui/button";
import { createFileKey } from "@/lib/upload";

interface UploadsCardProps {
  files: FileWithPath[];
  onRemove: (file: FileWithPath) => void;
}

const UploadsCard = ({ files, onRemove }: UploadsCardProps) => {
  const hasUploads = files.length > 0;

  return (
    <div className="w-full max-w-2xl rounded-3xl border border-border/50 bg-background/80 p-6 text-left shadow-xs">
      <div className="flex items-center justify-between">
        <p className="text-xs font-semibold uppercase tracking-[0.4em] text-muted-foreground">
          Uploads
        </p>
        <span className="text-xs text-muted-foreground">{files.length} file(s)</span>
      </div>
      <div className="mt-4 rounded-2xl border border-border/40 bg-card/50">
        {hasUploads ? (
          <ul className="divide-y divide-border/60">
            {files.map((file) => {
              const sizeInKb = Math.max(1, Math.round(file.size / 1024));

              return (
                <li
                  key={createFileKey(file)}
                  className="flex items-center gap-4 px-4 py-3 text-sm"
                >
                  <div className="flex min-w-0 flex-1 items-center gap-3">
                    <span className="truncate font-medium text-foreground" title={file.name}>
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
                    onClick={() => onRemove(file)}
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
  );
};

export default UploadsCard;
