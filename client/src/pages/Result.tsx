import { useCallback, useEffect, useMemo, useState } from "react";
import type { FileWithPath } from "react-dropzone";
import { useLocation, useNavigate } from "react-router";

import ForceGraph from "@/components/graph/force-graph";
import { Button } from "@/components/ui/button";
import {
  fetchPipelineStatus,
  resetPipelineStatus,
  uploadDocuments,
  type PipelineStatus,
} from "@/lib/upload";

interface ResultLocationState {
  files?: FileWithPath[];
}

const POLL_INTERVAL_MS = 2000;

const Result = () => {
  const navigate = useNavigate();
  const location = useLocation();
  const files = useMemo(() => {
    const state = location.state as ResultLocationState | undefined;
    return state?.files ?? [];
  }, [location.state]);

  const [status, setStatus] = useState<PipelineStatus | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [isUploading, setIsUploading] = useState(false);
  const [readyToPoll, setReadyToPoll] = useState(false);

  const startUpload = useCallback(async () => {
    if (!files.length) {
      return;
    }

    setIsUploading(true);
    setError(null);
    try {
      await uploadDocuments(files);
    } catch (err) {
      const message =
        err instanceof Error ? err.message : "Failed to upload documents.";
      setError(message);
    } finally {
      setIsUploading(false);
    }
  }, [files]);

  useEffect(() => {
    let isCancelled = false;

    const initialise = async () => {
      setStatus(null);
      setError(null);

      let resetSucceeded = true;

      try {
        await resetPipelineStatus();
      } catch (err) {
        if (!isCancelled) {
          const message =
            err instanceof Error
              ? err.message
              : "Failed to reset pipeline status.";
          setError(message);
        }
        resetSucceeded = false;
      }

      if (isCancelled) {
        return;
      }

      setReadyToPoll(true);

      if (!resetSucceeded || !files.length) {
        return;
      }

      await startUpload();
    };

    void initialise();

    return () => {
      isCancelled = true;
    };
  }, [files, startUpload]);

  useEffect(() => {
    if (!readyToPoll) {
      return;
    }

    let isActive = true;
    let timeoutId: ReturnType<typeof setTimeout> | null = null;

    const poll = async () => {
      try {
        const pipelineStatus = await fetchPipelineStatus();
        if (!isActive) {
          return;
        }

        setError(null);
        setStatus(pipelineStatus);
        if (
          pipelineStatus.state === "done" ||
          pipelineStatus.state === "error"
        ) {
          timeoutId = null;
          return;
        }
      } catch (err) {
        if (!isActive) {
          return;
        }
        const message =
          err instanceof Error
            ? err.message
            : "Unable to fetch pipeline status.";
        setError(message);
      }

      if (!isActive) {
        return;
      }

      timeoutId = setTimeout(poll, POLL_INTERVAL_MS);
    };

    void poll();

    return () => {
      isActive = false;
      if (timeoutId) {
        clearTimeout(timeoutId);
      }
    };
  }, [readyToPoll]);

  const handleBackHome = () => {
    navigate("/", { replace: true });
  };

  const extractedEntries = Object.entries(status?.extracted_documents ?? {});
  const graphData = status?.graph ?? null;

  useEffect(() => {
    console.log(graphData);
  }, [graphData]);
  const hasGraph = Boolean(
    graphData &&
      ((graphData.nodes?.length ?? 0) > 0 ||
        (graphData.links?.length ?? 0) > 0),
  );

  const formatDocumentName = (path: string) => {
    const segments = path.split(/[/\\]/);
    const name = segments.at(-1);
    return name && name.length ? name : path;
  };

  return (
    <div className="relative flex min-h-screen w-full justify-center overflow-hidden bg-gradient-to-br from-background via-background to-background/90 px-4 py-24">
      <div className="relative z-10 flex w-full max-w-3xl flex-col gap-8">
        <div className="flex items-center justify-between">
          <h1 className="text-3xl font-semibold">Processing Documents</h1>
          <Button variant="ghost" onClick={handleBackHome}>
            Back Home
          </Button>
        </div>

        {isUploading && (
          <p className="text-muted-foreground">Uploading documents...</p>
        )}

        {status ? (
          <div className="space-y-6 rounded-3xl border border-border/50 bg-background/80 p-6 shadow-xs">
            <div>
              <p className="text-xs font-semibold uppercase tracking-[0.4em] text-muted-foreground">
                Current State
              </p>
              <p className="mt-2 text-lg font-medium capitalize">
                {status.state}
              </p>
              {status.message ? (
                <p className="mt-1 text-sm text-destructive">
                  {status.message}
                </p>
              ) : null}
            </div>

            <div>
              <p className="text-xs font-semibold uppercase tracking-[0.4em] text-muted-foreground">
                Compressed Documents
              </p>
              {status?.compressed_documents?.length ? (
                <ul className="mt-2 space-y-1 text-sm text-muted-foreground">
                  {status.compressed_documents.map((document) => (
                    <li key={document}>{formatDocumentName(document)}</li>
                  ))}
                </ul>
              ) : (
                <p className="mt-2 text-sm text-muted-foreground">
                  No compression performed.
                </p>
              )}
            </div>

            <div>
              <p className="text-xs font-semibold uppercase tracking-[0.4em] text-muted-foreground">
                Extracted Concepts
              </p>
              {extractedEntries.length ? (
                <ul className="mt-2 space-y-3">
                  {extractedEntries.map(([path, keywords]) => (
                    <li
                      key={path}
                      className="rounded-xl border border-border/40 p-3"
                    >
                      <p className="truncate text-sm font-medium" title={path}>
                        {formatDocumentName(path)}
                      </p>
                      <p className="mt-1 text-sm text-muted-foreground">
                        {keywords.length
                          ? keywords.join(", ")
                          : "No keywords yet"}
                      </p>
                    </li>
                  ))}
                </ul>
              ) : (
                <p className="mt-2 text-sm text-muted-foreground">
                  Waiting for extraction results...
                </p>
              )}
            </div>

            <div>
              <p className="text-xs font-semibold uppercase tracking-[0.4em] text-muted-foreground">
                Populated Concepts
              </p>
              {status.populated_concepts.length ? (
                <div className="mt-2 flex flex-wrap gap-2 text-sm">
                  {status.populated_concepts.map((concept) => (
                    <span
                      key={concept}
                      className="rounded-full bg-primary/10 px-3 py-1 text-primary"
                    >
                      {concept}
                    </span>
                  ))}
                </div>
              ) : (
                <p className="mt-2 text-sm text-muted-foreground">
                  Waiting for concept population...
                </p>
              )}
            </div>

            <div>
              <p className="text-xs font-semibold uppercase tracking-[0.4em] text-muted-foreground">
                Graph
              </p>
              {hasGraph && graphData ? (
                <div className="mt-3 h-[420px]">
                  <ForceGraph data={graphData} />
                </div>
              ) : (
                <p className="mt-2 text-sm text-muted-foreground">
                  Graph will appear once ready.
                </p>
              )}
            </div>
          </div>
        ) : (
          <p className="text-muted-foreground">Awaiting pipeline status...</p>
        )}

        {error ? (
          <p className="text-sm text-destructive" role="alert">
            {error}
          </p>
        ) : null}
      </div>

      <div className="pointer-events-none absolute inset-x-0 top-40 -z-10 h-[520px] bg-gradient-radial from-primary/20 via-transparent to-transparent blur-3xl" />
    </div>
  );
};

export default Result;
