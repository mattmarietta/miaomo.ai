"use client";

import {
  Background,
  Controls,
  Position,
  ReactFlow,
  type Edge,
  type Node,
} from "@xyflow/react";
import "@xyflow/react/dist/style.css";
import type { User } from "firebase/auth";
import { useCallback, useEffect, useMemo, useState } from "react";

interface MindMapProps {
  workspaceId: string;
  user: User;
  onLeafClick?: (label: string, summary: string) => void;
}

interface ApiChild {
  id: string;
  label: string;
  summary: string;
}

interface ApiTopic extends ApiChild {
  children: ApiChild[];
}

interface MindMapResponse {
  root: string;
  nodes: ApiTopic[];
}

const NODE_W = 200;
const H_GAP = 80;
const V_GAP = 24;

const ROOT_STYLE: React.CSSProperties = {
  width: NODE_W,
  padding: "10px 14px",
  borderRadius: 12,
  background: "var(--primary, #0f172a)",
  color: "var(--primary-foreground, #f8fafc)",
  border: "1px solid var(--border, #1e293b)",
  fontWeight: 600,
  fontSize: 13,
  textAlign: "center" as const,
};

const TOPIC_STYLE: React.CSSProperties = {
  width: NODE_W,
  padding: "8px 12px",
  borderRadius: 10,
  background: "var(--card, #ffffff)",
  color: "var(--card-foreground, #0f172a)",
  border: "1px solid var(--border, #cbd5e1)",
  fontWeight: 500,
  fontSize: 12,
};

const CHILD_STYLE: React.CSSProperties = {
  width: NODE_W,
  padding: "6px 10px",
  borderRadius: 8,
  background: "var(--card, #ffffff)",
  color: "var(--card-foreground, #0f172a)",
  border: "1px solid var(--border, #cbd5e1)",
  fontSize: 11,
  cursor: "pointer",
  transition: "background 0.15s, border-color 0.15s",
};

const EDGE_STYLE = { stroke: "#94a3b8", strokeWidth: 1.5 };

function buildGraph(data: MindMapResponse): { nodes: Node[]; edges: Edge[] } {
  const nodes: Node[] = [];
  const edges: Edge[] = [];

  const rootId = "root";
  // Topic + child column heights — laid out top-down per topic.
  const topicHeights = data.nodes.map(
    (t) => Math.max(1, t.children.length) * (32 + V_GAP) - V_GAP
  );
  const totalHeight =
    topicHeights.reduce((sum, h) => sum + h + V_GAP, 0) - V_GAP;
  const startY = -totalHeight / 2;

  nodes.push({
    id: rootId,
    type: "default",
    data: { label: data.root || "Mind Map" },
    position: { x: 0, y: 0 },
    sourcePosition: Position.Right,
    targetPosition: Position.Left,
    style: ROOT_STYLE,
    draggable: false,
    selectable: false,
  });

  let cursorY = startY;
  data.nodes.forEach((topic, i) => {
    const topicHeight = topicHeights[i];
    const topicCenterY = cursorY + topicHeight / 2;

    const topicId = topic.id || `topic-${i}`;
    nodes.push({
      id: topicId,
      type: "default",
      data: { label: topic.label },
      position: { x: NODE_W + H_GAP, y: topicCenterY },
      sourcePosition: Position.Right,
      targetPosition: Position.Left,
      style: TOPIC_STYLE,
      draggable: false,
    });

    edges.push({
      id: `e-${rootId}-${topicId}`,
      source: rootId,
      target: topicId,
      type: "smoothstep",
      style: EDGE_STYLE,
    });

    const childRowH = 32 + V_GAP;
    let childY = cursorY;
    topic.children.forEach((child, j) => {
      const childId = child.id || `${topicId}-${j}`;
      nodes.push({
        id: childId,
        type: "default",
        data: { label: child.label, summary: child.summary, isLeaf: true },
        position: { x: 2 * (NODE_W + H_GAP), y: childY },
        sourcePosition: Position.Right,
        targetPosition: Position.Left,
        style: CHILD_STYLE,
        draggable: false,
      });

      edges.push({
        id: `e-${topicId}-${childId}`,
        source: topicId,
        target: childId,
        type: "smoothstep",
        style: EDGE_STYLE,
      });

      childY += childRowH;
    });

    cursorY += topicHeight + V_GAP;
  });

  return { nodes, edges };
}

export function MindMap({ workspaceId, user, onLeafClick }: MindMapProps) {
  const [data, setData] = useState<MindMapResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    setError(null);

    (async () => {
      try {
        const token = await user.getIdToken();
        const res = await fetch("/api/mindmap", {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${token}`,
          },
          body: JSON.stringify({ workspaceId }),
        });
        if (!res.ok) {
          const text = await res.text();
          throw new Error(`API error ${res.status}: ${text}`);
        }
        const json = (await res.json()) as MindMapResponse;
        if (!cancelled) setData(json);
      } catch (err) {
        if (!cancelled) {
          setError(err instanceof Error ? err.message : "Failed to load");
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();

    return () => {
      cancelled = true;
    };
    // user.uid is stable per session; getIdToken is read inside the effect.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [workspaceId, user.uid]);

  const { nodes, edges } = useMemo(() => {
    if (!data) return { nodes: [] as Node[], edges: [] as Edge[] };
    return buildGraph(data);
  }, [data]);

  const handleNodeClick = useCallback(
    (_: React.MouseEvent, node: Node) => {
      if (node.data?.isLeaf && onLeafClick) {
        onLeafClick(
          node.data.label as string,
          (node.data.summary as string) || "",
        );
      }
    },
    [onLeafClick],
  );

  if (loading) {
    return (
      <div className="flex h-full items-center justify-center">
        <p className="text-sm text-muted-foreground">Generating mind map...</p>
      </div>
    );
  }

  if (error) {
    return (
      <div className="flex h-full items-center justify-center p-4">
        <p className="text-sm text-red-500">Error: {error}</p>
      </div>
    );
  }

  if (!data || data.nodes.length === 0) {
    return (
      <div className="flex h-full items-center justify-center p-4">
        <p className="text-sm text-muted-foreground">
          No content yet — upload a file to generate a mind map.
        </p>
      </div>
    );
  }

  return (
    <div className="h-full w-full">
      <ReactFlow
        nodes={nodes}
        edges={edges}
        nodesDraggable={false}
        nodesConnectable={false}
        elementsSelectable={false}
        onNodeClick={handleNodeClick}
        fitView
        fitViewOptions={{ padding: 0.2 }}
        proOptions={{ hideAttribution: true }}
      >
        <Background gap={16} size={1} />
        <Controls showInteractive={false} />
      </ReactFlow>
    </div>
  );
}
