"""Graph models shared across API responses."""

from __future__ import annotations

from typing import TypeAlias

from pydantic import BaseModel, ConfigDict, Field

GraphNodeId: TypeAlias = str | int


class GraphNode(BaseModel):
    """Node representation for force-directed graphs."""

    model_config = ConfigDict(extra="allow")

    id: GraphNodeId = Field(..., description="Unique identifier for the node.")
    label: str | None = Field(
        default=None, description="Optional display label used by the frontend."
    )
    group: str | None = Field(
        default=None, description="Optional grouping key to cluster related nodes."
    )


class GraphLink(BaseModel):
    """Edge representation for force-directed graphs."""

    model_config = ConfigDict(extra="allow")

    source: GraphNodeId = Field(..., description="Identifier of the source node.")
    target: GraphNodeId = Field(..., description="Identifier of the target node.")
    value: float | None = Field(
        default=None, description="Optional numeric weight associated with the edge."
    )


class ForceGraphData(BaseModel):
    """Container for nodes and links describing a force-directed graph."""

    nodes: list[GraphNode] = Field(
        default_factory=list, description="Collection of graph nodes sent to the client."
    )
    links: list[GraphLink] = Field(
        default_factory=list, description="Connections between nodes in the graph."
    )
