"use client";

import {useEffect, useState} from "react";
import {useRouter} from "next/navigation";
import {collection, addDoc, getDocs, orderBy, query, serverTimestamp} from "firebase/firestore";
import {auth, db} from "@/lib/firebase/firebase";

type Workspace = {id: string; title: string};

export default function WorkspacesPage() {
  const router = useRouter();
  const [workspaces, setWorkspaces] = useState<Workspace[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function load() {
      const user = auth.currentUser;
      if (!user) {
        setLoading(false);
        return;
      }

      const q = query(collection(db, "workspaces"), orderBy("createdAt", "desc"));
      const snap = await getDocs(q);

      const items = snap.docs
        .map((d) => ({id: d.id, ...(d.data() as any)}))
        .filter((w) => w.ownerUid === user.uid)
        .map((w) => ({id: w.id, title: w.title ?? "Untitled"}));

      setWorkspaces(items);
      setLoading(false);
    }

    load();
  }, []);

  async function createWorkspace() {
    const user = auth.currentUser;
    if (!user) return;

    const docRef = await addDoc(collection(db, "workspaces"), {
      ownerUid: user.uid,
      title: "New Workspace",
      createdAt: serverTimestamp(),
      updatedAt: serverTimestamp(),
    });

    router.push(`/workspaces/${docRef.id}`);
  }

  return (
    <div style={{padding: 16}}>
      <h1>Workspaces</h1>

      <button onClick={createWorkspace}>New workspace</button>

      {loading ? (
        <p>Loading…</p>
      ) : (
        <ul>
          {workspaces.map((w) => (
            <li key={w.id}>
              <button onClick={() => router.push(`/workspaces/${w.id}`)}>{w.title}</button>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}