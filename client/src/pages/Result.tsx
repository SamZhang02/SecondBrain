import { useCallback, useEffect, useMemo, useState } from "react";
import { AnimatePresence, motion } from "motion/react";
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
const DEBUG_MODE = false;

const MOCK_STATUS: PipelineStatus = {
  state: "done",
  compressed_documents: ["docs/course-outline.pdf", "docs/lecture-notes.pdf"],
  extracted_documents: {
    "docs/course-outline.pdf": ["Syllabus", "Key Topics", "Timeline"],
    "docs/lecture-notes.pdf": ["Graph Theory", "DFS", "Applications"],
  },
  populated_concepts: ["Graph Theory", "Traversal", "Applications"],
  graph: {
    nodes: [
      { id: "Graph Theory", label: "Graph Theory", group: "concept" },
      { id: "Traversal", label: "Traversal", group: "concept" },
      { id: "DFS", label: "Depth-First Search", group: "topic" },
      { id: "Applications", label: "Applications", group: "topic" },
      { id: "Algorithms", label: "Algorithms", group: "topic" },
    ],
    links: [
      { source: "Graph Theory", target: "Traversal", value: 3 },
      { source: "Traversal", target: "DFS", value: 2 },
      { source: "Graph Theory", target: "Applications", value: 2 },
      { source: "DFS", target: "Applications", value: 1 },
      { source: "Traversal", target: "Algorithms", value: 1 },
    ],
  },
  message: null,
};

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
    if (DEBUG_MODE) {
      setStatus(MOCK_STATUS);
      setError(null);
      setReadyToPoll(false);
      return;
    }

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
    if (DEBUG_MODE) {
      return;
    }

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
  const showGraphPanel = hasGraph && graphData;

  const formatDocumentName = (path: string) => {
    const segments = path.split(/[/\\]/);
    const name = segments.at(-1);
    return name && name.length ? name : path;
  };

  return (
    <div className="relative flex min-h-screen w-full justify-center overflow-hidden bg-gradient-to-br from-background via-background to-background/90 px-4 py-24">
      <motion.div
        layout
        className={`relative z-10 flex w-full ${showGraphPanel ? "max-w-6xl" : "max-w-3xl"} flex-col gap-8`}
      >
        <div className="flex items-center justify-between">
          <h1 className="text-3xl font-semibold">Status</h1>
          <Button variant="ghost" onClick={handleBackHome}>
            Back Home
          </Button>
        </div>

        {isUploading && (
          <p className="text-muted-foreground">Uploading documents...</p>
        )}

        {status ? (
          <motion.div
            layout
            className={`flex w-full flex-col gap-8 ${showGraphPanel ? "lg:flex-row lg:items-start" : "items-center"}`}
          >
            <motion.div
              layout
              animate={{ x: showGraphPanel ? -16 : 0 }}
              transition={{ type: "spring", stiffness: 260, damping: 30 }}
              className={`w-full space-y-6 rounded-3xl border border-border/50 bg-background/80 p-6 shadow-xs ${showGraphPanel ? "lg:max-w-md" : "max-w-3xl"}`}
            >
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
                        <p
                          className="truncate text-sm font-medium"
                          title={path}
                        >
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

              {!showGraphPanel ? (
                <div>
                  <p className="text-xs font-semibold uppercase tracking-[0.4em] text-muted-foreground">
                    Graph
                  </p>
                  <p className="mt-2 text-sm text-muted-foreground">
                    Graph will appear once ready.
                  </p>
                </div>
              ) : null}
            </motion.div>

            <AnimatePresence>
              {showGraphPanel ? (
                <motion.div
                  key="graph-panel"
                  initial={{ opacity: 0, x: 48 }}
                  animate={{ opacity: 1, x: 0 }}
                  exit={{ opacity: 0, x: 48 }}
                  transition={{ duration: 0.4, ease: "easeOut" }}
                  className="w-full flex-1 rounded-3xl border border-border/50 bg-background/80 p-4 shadow-xs"
                >
                  <div className="h-full min-h-[480px]">
                    <ForceGraph data={graphData} />
                  </div>
                </motion.div>
              ) : null}
            </AnimatePresence>
          </motion.div>
        ) : (
          <p className="text-muted-foreground">Awaiting pipeline status...</p>
        )}

        {error ? (
          <p className="text-sm text-destructive" role="alert">
            {error}
          </p>
        ) : null}
      </motion.div>

      <div className="pointer-events-none absolute inset-x-0 top-40 -z-10 h-[520px] bg-gradient-radial from-primary/20 via-transparent to-transparent blur-3xl" />
    </div>
  );
};

export default Result;
