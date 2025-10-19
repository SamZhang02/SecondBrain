"""Utilities to transform concept extraction results into force-graph data."""

from __future__ import annotations

from collections.abc import Iterable
from pathlib import Path

from dubhack.models import ForceGraphData, GraphLink, GraphNode
from dubhack.services.concept_extractor import ConceptMap

DOCUMENT_PREFIX = "document::"
CONCEPT_PREFIX = "concept::"


class ConceptGraphBuilder:
    """Build a bipartite force-directed graph linking documents to concepts."""

    def build(self, concepts: ConceptMap) -> ForceGraphData:
        nodes: dict[str, GraphNode] = {}
        links: list[GraphLink] = []
        seen_edges: set[tuple[str, str]] = set()
        concept_counts: dict[str, int] = {}

        for document_path, raw_keywords in concepts.items():
            doc_id = self._document_node_id(document_path)
            document_node = nodes.get(doc_id)
            if document_node is None:
                document_node = GraphNode(
                    id=doc_id,
                    label=self._document_label(document_path),
                    group="document",
                    kind="document",
                    document_path=document_path,
                )
                nodes[doc_id] = document_node

            unique_keywords = self._dedupe_keywords(raw_keywords)
            document_link_count = 0

            for keyword in unique_keywords:
                concept_id = self._concept_node_id(keyword)
                concept_node = nodes.get(concept_id)
                if concept_node is None:
                    concept_node = GraphNode(
                        id=concept_id,
                        label=keyword,
                        group="concept",
                        kind="concept",
                    )
                    nodes[concept_id] = concept_node

                edge_key = (doc_id, concept_id)
                if edge_key in seen_edges:
                    continue

                seen_edges.add(edge_key)
                links.append(
                    GraphLink(
                        source=doc_id,
                        target=concept_id,
                        value=1.0,
                        kind="document-concept",
                    )
                )

                concept_counts[concept_id] = concept_counts.get(concept_id, 0) + 1
                document_link_count += 1

            nodes[doc_id] = document_node.model_copy(update={"concept_count": document_link_count})

        enriched_nodes = []
        for node_id, node in nodes.items():
            if node_id.startswith(CONCEPT_PREFIX):
                count = concept_counts.get(node_id, 0)
                enriched_nodes.append(node.model_copy(update={"document_count": count}))
            else:
                enriched_nodes.append(node)

        return ForceGraphData(nodes=enriched_nodes, links=links)

    @staticmethod
    def _document_node_id(document_path: str) -> str:
        return f"{DOCUMENT_PREFIX}{document_path}"

    @staticmethod
    def _document_label(document_path: str) -> str:
        path = Path(document_path)
        name = path.name
        return name or document_path

    @staticmethod
    def _concept_node_id(keyword: str) -> str:
        canonical = keyword.strip().casefold()
        return f"{CONCEPT_PREFIX}{canonical}"

    @staticmethod
    def _dedupe_keywords(raw_keywords: object) -> list[str]:
        seen: set[str] = set()
        ordered: list[str] = []

        if raw_keywords is None:
            candidates: Iterable[object] = []
        elif isinstance(raw_keywords, str):
            candidates = [raw_keywords]
        elif isinstance(raw_keywords, Iterable):
            candidates = raw_keywords
        else:
            candidates = [raw_keywords]

        for item in candidates:
            keyword = str(item).strip()
            if not keyword:
                continue
            canonical = keyword.casefold()
            if canonical in seen:
                continue
            seen.add(canonical)
            ordered.append(keyword)
        return ordered
