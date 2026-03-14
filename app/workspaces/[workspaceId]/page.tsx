"use client";
import {useParams} from "next/navigation";
import FileUploader from "@/components/FileUploader";

export default function WorkspacePage() {
  const params = useParams();
  const workspaceId = params.workspaceId as string;

  if (!workspaceId) return null;

  return (
    <div style={{padding: 16}}>
      <h1>Workspace: {workspaceId}</h1>
      <FileUploader workspaceId={workspaceId} />
    </div>
  );
}