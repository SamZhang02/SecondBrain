import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import type { ComponentPropsWithoutRef } from "react";
import { AnimatePresence, motion } from "motion/react";
import type { FileWithPath } from "react-dropzone";
import { useLocation, useNavigate } from "react-router";
import ReactMarkdown from "react-markdown";
import type { Components } from "react-markdown";
import remarkGfm from "remark-gfm";

import ForceGraph, { type GraphNode } from "@/components/graph/force-graph";
import { Button } from "@/components/ui/button";
import { Spinner } from "@/components/ui/spinner";
import {
  fetchPipelineStatus,
  resetPipelineStatus,
  uploadDocuments,
  type PipelineStatus,
} from "@/lib/upload";
import { fetchConceptSummary } from "@/lib/concepts";

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

type MarkdownCodeProps = ComponentPropsWithoutRef<"code"> & {
  inline?: boolean;
};

const CodeRenderer = ({
  inline,
  className,
  children,
  ...props
}: MarkdownCodeProps) => {
  if (inline) {
    return (
      <code className="rounded bg-muted px-1 py-0.5 font-mono text-xs text-foreground">
        {children}
      </code>
    );
  }
  return (
    <pre className="overflow-x-auto rounded-lg bg-muted/60 p-3 text-xs leading-5 text-foreground">
      <code className={className} {...props}>
        {children}
      </code>
    </pre>
  );
};

const markdownComponents: Components = {
  p: ({ children }) => (
    <p className="text-sm leading-6 text-muted-foreground">{children}</p>
  ),
  strong: ({ children }) => (
    <strong className="font-semibold text-foreground">{children}</strong>
  ),
  em: ({ children }) => (
    <em className="text-sm leading-6 text-muted-foreground italic">
      {children}
    </em>
  ),
  ul: ({ children }) => (
    <ul className="ml-6 list-disc space-y-1 text-sm leading-6 text-muted-foreground">
      {children}
    </ul>
  ),
  ol: ({ children }) => (
    <ol className="ml-6 list-decimal space-y-1 text-sm leading-6 text-muted-foreground">
      {children}
    </ol>
  ),
  li: ({ children }) => (
    <li className="text-sm leading-6 text-muted-foreground">{children}</li>
  ),
  a: ({ href, children }) => (
    <a
      href={href ?? "#"}
      className="text-sm leading-6 text-primary underline underline-offset-4"
      target="_blank"
      rel="noreferrer"
    >
      {children}
    </a>
  ),
  blockquote: ({ children }) => (
    <blockquote className="border-l-2 border-border/60 pl-4 text-sm leading-6 text-muted-foreground">
      {children}
    </blockquote>
  ),
  code: CodeRenderer,
  h1: ({ children }) => (
    <h2 className="text-base font-semibold text-foreground">{children}</h2>
  ),
  h2: ({ children }) => (
    <h3 className="text-sm font-semibold text-foreground">{children}</h3>
  ),
  h3: ({ children }) => (
    <h4 className="text-sm font-medium text-foreground">{children}</h4>
  ),
  h4: ({ children }) => (
    <h5 className="text-sm font-medium text-foreground">{children}</h5>
  ),
  h5: ({ children }) => (
    <h6 className="text-xs font-medium uppercase tracking-widest text-muted-foreground">
      {children}
    </h6>
  ),
  h6: ({ children }) => (
    <p className="text-xs font-semibold text-muted-foreground">{children}</p>
  ),
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
  const [selectedConcept, setSelectedConcept] = useState<string | null>(null);
  const [conceptSummary, setConceptSummary] = useState<string | null>(null);
  const [conceptSummaryError, setConceptSummaryError] = useState<string | null>(
    null,
  );
  const [isFetchingConceptSummary, setIsFetchingConceptSummary] =
    useState(false);
  const conceptRequestIdRef = useRef(0);

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

  const handleConceptNodeClick = useCallback(async (node: GraphNode) => {
    if (node.group && node.group !== "concept") {
      return;
    }

    const conceptNameFromLabel =
      typeof node.label === "string" && node.label.trim().length
        ? node.label.trim()
        : null;
    const conceptIdentifier =
      conceptNameFromLabel ??
      (typeof node.id === "string" ? node.id : String(node.id));

    if (!conceptIdentifier) {
      return;
    }

    const requestId = conceptRequestIdRef.current + 1;
    conceptRequestIdRef.current = requestId;

    setSelectedConcept(conceptIdentifier);
    setConceptSummary(null);
    setConceptSummaryError(null);
    setIsFetchingConceptSummary(true);

    try {
      const summary = await fetchConceptSummary(conceptIdentifier);
      if (conceptRequestIdRef.current === requestId) {
        setConceptSummary(summary.trim());
      }
    } catch (err) {
      if (conceptRequestIdRef.current === requestId) {
        const message =
          err instanceof Error
            ? err.message
            : "Failed to load concept summary.";
        setConceptSummaryError(message);
      }
    } finally {
      if (conceptRequestIdRef.current === requestId) {
        setIsFetchingConceptSummary(false);
      }
    }
  }, []);

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
              className={`w-full space-y-8 rounded-3xl border border-border/50 bg-background/80 p-6 shadow-xs ${showGraphPanel ? "lg:max-w-md" : "max-w-3xl"}`}
            >
              <div>
                <p className="text-xs font-semibold uppercase tracking-[0.2em] text-muted-foreground">
                  Current State
                </p>
                <div className="mt-2 flex items-center gap-2">
                  {status.state !== "done" && status.state !== "error" ? (
                    <Spinner className="size-5 text-muted-foreground" />
                  ) : null}
                  <p className="text-lg font-medium capitalize">
                    {status.state}
                  </p>
                </div>
                {status.message ? (
                  <p className="mt-1 text-sm text-destructive">
                    {status.message}
                  </p>
                ) : null}
              </div>

              <div>
                <p className="text-xs font-semibold uppercase tracking-[0.2em] text-muted-foreground">
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
                <p className="text-xs font-semibold uppercase tracking-[0.2em] text-muted-foreground">
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
                <p className="text-xs font-semibold uppercase tracking-[0.2em] text-muted-foreground">
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
                  <p className="text-xs font-semibold uppercase tracking-[0.2em] text-muted-foreground">
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
                  <div className="flex h-full min-h-[480px] flex-col gap-4">
                    <div className="flex-1 rounded-2xl border border-border/30 bg-background/60 p-2">
                      <ForceGraph
                        data={graphData}
                        onNodeClick={handleConceptNodeClick}
                        height={400}
                      />
                    </div>
                    <div className="rounded-2xl border border-border/30 bg-background/60 p-4 overflow-auto max-h-[400px]">
                      {selectedConcept ? (
                        <div className="space-y-2">
                          <p className="text-xs font-semibold uppercase tracking-[0.4em] text-muted-foreground">
                            Concept Summary
                          </p>
                          <h2 className="text-lg font-medium">
                            {selectedConcept}
                          </h2>
                          {isFetchingConceptSummary ? (
                            <p className="text-sm text-muted-foreground">
                              Loading summary...
                            </p>
                          ) : conceptSummaryError ? (
                            <p className="text-sm text-destructive">
                              {conceptSummaryError}
                            </p>
                          ) : conceptSummary ? (
                            <ReactMarkdown
                              remarkPlugins={[remarkGfm]}
                              components={markdownComponents}
                            >
                              {conceptSummary}
                            </ReactMarkdown>
                          ) : (
                            <p className="text-sm text-muted-foreground">
                              No summary available yet.
                            </p>
                          )}
                        </div>
                      ) : (
                        <p className="text-sm text-muted-foreground">
                          Click a concept node to view its summary.
                        </p>
                      )}
                    </div>
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
