'use client';

import { ReactFlow, type Node, type Edge, useNodesState, useEdgesState } from '@xyflow/react';
import { useEffect, useState } from 'react';

interface MindMapProps {
    workspaceId: string;
    userId: string;
}

export function MindMap({ workspaceId, userId }: MindMapProps) {
    const [data, setData] = useState<any>(null);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);

    useEffect(() => {
        setLoading(true);
        fetch("/api/mindmap", {
            method: "POST",
            headers: { "Content-type": "application/json" },
            body: JSON.stringify({ workspaceId, userId }),
        })
            .then(async (res) => {
                if (!res.ok) {
                    const text = await res.text();
                    throw new Error(`API error ${res.status}: ${text}`);
                }
                return res.json();
            })
            .then((json) => setData(json))
            .catch((err) => setError(err.message))
            .finally(() => setLoading(false));
    }, [workspaceId, userId]);

    if (loading) return <p className="p-4 text-muted-foreground">Generating mind map...</p>;
    if (error) return <p className="p-4 text-red-500">Error: {error}</p>;

    return (
        <pre className="p-4 text-xs overflow-auto max-h-full">
            {JSON.stringify(data, null, 2)}
        </pre>
    );
}