"use client";

import Link from "next/link";
import {
  useEffect,
  useMemo,
  useRef,
  useState,
  type CSSProperties,
} from "react";
import {
  DndContext,
  PointerSensor,
  pointerWithin,
  useDraggable,
  useDroppable,
  useSensor,
  useSensors,
  DragOverlay,
  type DragEndEvent,
  type DragStartEvent,
} from "@dnd-kit/core";
import { restrictToWindowEdges } from "@dnd-kit/modifiers";
import { NodeFormModal } from "./NodeFormModal";
import { GlassCard } from "@/components/ui/GlassCard";
import { useToast } from "@/components/ui/Toast";
import { createClient as createSupabaseClient } from "@/lib/supabase/client";
import type { Client, Guard, OrgNode } from "@/types/database";

type TreeNode = OrgNode & { children: TreeNode[] };

// Default chain auto-created the first time a pooled client has no nodes.
const DEFAULT_CHAIN: Array<{ label: string; level: number }> = [
  { label: "Detachment Commander", level: 0 },
  { label: "Shift In-Charge", level: 1 },
  { label: "Senior Guard", level: 2 },
  { label: "Guard", level: 3 },
];

// Droppable id discriminators:
//   "node:<id>"        the node card itself — dropping a node here = re-parent
//                      under that node; dropping a guard here = assign to it.
//   "unassigned"       the unassigned-guards strip — dropping a guard here
//                      clears its org_node_id.
// Draggable id discriminators:
//   "node:<id>"        a node card
//   "guard:<id>"       a guard chip
const NODE_PREFIX = "node:";
const GUARD_PREFIX = "guard:";
const UNASSIGNED_ID = "unassigned";

function sortSiblings(a: OrgNode, b: OrgNode): number {
  return a.sort_order - b.sort_order || a.label.localeCompare(b.label);
}

function buildTree(nodes: OrgNode[]): TreeNode[] {
  const byId = new Map<string, TreeNode>();
  nodes.forEach((n) => byId.set(n.id, { ...n, children: [] }));
  const roots: TreeNode[] = [];
  for (const n of nodes) {
    const tn = byId.get(n.id)!;
    if (n.parent_node_id && byId.has(n.parent_node_id)) {
      byId.get(n.parent_node_id)!.children.push(tn);
    } else {
      roots.push(tn);
    }
  }
  const sortRec = (arr: TreeNode[]) => {
    arr.sort(sortSiblings);
    arr.forEach((c) => sortRec(c.children));
  };
  sortRec(roots);
  return roots;
}

type Modal =
  | { mode: "add-child"; parent: OrgNode }
  | { mode: "rename"; node: OrgNode }
  | null;

const goldButtonStyle: CSSProperties = {
  display: "inline-flex",
  alignItems: "center",
  gap: 8,
  background: "rgba(255, 255, 255, 0.04)",
  border: "1px solid rgba(255, 255, 255, 0.12)",
  color: "rgba(245, 245, 247, 0.8)",
  borderRadius: 8,
  padding: "9px 14px",
  fontWeight: 500,
  fontSize: 13,
  fontFamily: "inherit",
  cursor: "pointer",
  textDecoration: "none",
};

export function OrgChartCanvas({
  client,
  initialNodes,
  initialGuards,
}: {
  client: Client;
  initialNodes: OrgNode[];
  initialGuards: Guard[];
}) {
  const [nodes, setNodes] = useState<OrgNode[]>(initialNodes);
  const [guards, setGuards] = useState<Guard[]>(initialGuards);
  const [seeding, setSeeding] = useState(false);
  const [busy, setBusy] = useState(false);
  const [modal, setModal] = useState<Modal>(null);
  const [activeDrag, setActiveDrag] = useState<{
    kind: "node" | "guard";
    label: string;
  } | null>(null);
  const didSeed = useRef(false);
  const { showToast } = useToast();

  // 6px activation distance keeps clicks (action buttons, etc.) from
  // accidentally registering as drags.
  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 6 } }),
  );

  const tree = useMemo(() => buildTree(nodes), [nodes]);

  const guardsByNode = useMemo(() => {
    const m = new Map<string, Guard[]>();
    for (const g of guards) {
      if (!g.org_node_id) continue;
      const list = m.get(g.org_node_id) ?? [];
      list.push(g);
      m.set(g.org_node_id, list);
    }
    return m;
  }, [guards]);

  const unassignedGuards = useMemo(
    () => guards.filter((g) => !g.org_node_id),
    [guards],
  );

  // Auto-seed default chain on first load of a pooled client with no nodes.
  useEffect(() => {
    if (nodes.length > 0 || didSeed.current) return;
    didSeed.current = true;
    void seedDefaultChain();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [nodes.length]);

  async function refetch() {
    const supabase = createSupabaseClient();
    const [nodesRes, guardsRes] = await Promise.all([
      supabase
        .from("org_nodes")
        .select("*")
        .eq("client_id", client.id)
        .order("sort_order", { ascending: true }),
      supabase
        .from("guards")
        .select("*")
        .eq("client_id", client.id)
        .order("full_name", { ascending: true }),
    ]);
    setNodes((nodesRes.data ?? []) as OrgNode[]);
    setGuards((guardsRes.data ?? []) as Guard[]);
  }

  async function seedDefaultChain() {
    setSeeding(true);
    const supabase = createSupabaseClient();
    let parentId: string | null = null;
    for (const step of DEFAULT_CHAIN) {
      const { data, error } = await supabase
        .from("org_nodes")
        .insert({
          client_id: client.id,
          parent_node_id: parentId,
          label: step.label,
          level: step.level,
          sort_order: 0,
        })
        .select("id")
        .single();
      if (error || !data) {
        showToast(error?.message ?? "Failed to set up org chart", "error");
        break;
      }
      parentId = data.id as string;
    }
    await refetch();
    setSeeding(false);
  }

  function descendantIds(rootId: string): string[] {
    const childrenOf = new Map<string, string[]>();
    for (const n of nodes) {
      const p = n.parent_node_id;
      if (!p) continue;
      const arr = childrenOf.get(p) ?? [];
      arr.push(n.id);
      childrenOf.set(p, arr);
    }
    const out: string[] = [];
    const stack = [rootId];
    while (stack.length) {
      const id = stack.pop()!;
      out.push(id);
      for (const c of childrenOf.get(id) ?? []) stack.push(c);
    }
    return out;
  }

  async function handleAddChild(parent: OrgNode, label: string) {
    setBusy(true);
    const supabase = createSupabaseClient();
    const siblings = nodes.filter(
      (n) => (n.parent_node_id ?? null) === parent.id,
    );
    const { error } = await supabase.from("org_nodes").insert({
      client_id: client.id,
      parent_node_id: parent.id,
      label,
      level: parent.level + 1,
      sort_order: siblings.length,
    });
    setBusy(false);
    if (error) {
      showToast(error.message, "error");
      return;
    }
    setModal(null);
    showToast("Position added", "success");
    await refetch();
  }

  async function handleRename(node: OrgNode, label: string) {
    setBusy(true);
    const supabase = createSupabaseClient();
    const { error } = await supabase
      .from("org_nodes")
      .update({ label })
      .eq("id", node.id);
    setBusy(false);
    if (error) {
      showToast(error.message, "error");
      return;
    }
    setModal(null);
    showToast("Position renamed", "success");
    await refetch();
  }

  async function handleDelete(node: OrgNode) {
    const ids = descendantIds(node.id);
    const childCount = ids.length - 1;
    const ok = window.confirm(
      childCount > 0
        ? `Delete "${node.label}" and its ${childCount} sub-position${childCount === 1 ? "" : "s"}? Guards assigned anywhere in this branch will be unassigned (not deleted).`
        : `Delete "${node.label}"? Any guards assigned here will be unassigned (not deleted).`,
    );
    if (!ok) return;

    setBusy(true);
    const supabase = createSupabaseClient();
    const { error: unassignErr } = await supabase
      .from("guards")
      .update({ org_node_id: null })
      .in("org_node_id", ids);
    if (unassignErr) {
      setBusy(false);
      showToast(unassignErr.message, "error");
      return;
    }
    const { error } = await supabase
      .from("org_nodes")
      .delete()
      .eq("id", node.id);
    setBusy(false);
    if (error) {
      showToast(error.message, "error");
      return;
    }
    showToast("Position deleted", "success");
    await refetch();
  }

  // ---- DnD handlers --------------------------------------------------------

  function onDragStart(event: DragStartEvent) {
    const id = String(event.active.id);
    if (id.startsWith(NODE_PREFIX)) {
      const node = nodes.find((n) => `${NODE_PREFIX}${n.id}` === id);
      setActiveDrag({ kind: "node", label: node?.label ?? "" });
    } else if (id.startsWith(GUARD_PREFIX)) {
      const guard = guards.find((g) => `${GUARD_PREFIX}${g.id}` === id);
      setActiveDrag({ kind: "guard", label: guard?.full_name ?? "" });
    }
  }

  async function onDragEnd(event: DragEndEvent) {
    setActiveDrag(null);
    const { active, over } = event;
    if (!over) return;
    const activeId = String(active.id);
    const overId = String(over.id);
    if (activeId === overId) return;

    if (activeId.startsWith(NODE_PREFIX)) {
      const nodeId = activeId.slice(NODE_PREFIX.length);
      if (!overId.startsWith(NODE_PREFIX)) return;
      const targetId = overId.slice(NODE_PREFIX.length);
      await handleReparent(nodeId, targetId);
      return;
    }

    if (activeId.startsWith(GUARD_PREFIX)) {
      const guardId = activeId.slice(GUARD_PREFIX.length);
      let newNodeId: string | null = null;
      if (overId === UNASSIGNED_ID) {
        newNodeId = null;
      } else if (overId.startsWith(NODE_PREFIX)) {
        newNodeId = overId.slice(NODE_PREFIX.length);
      } else {
        return;
      }
      await handleGuardAssign(guardId, newNodeId);
    }
  }

  async function handleReparent(nodeId: string, targetId: string) {
    if (nodeId === targetId) return;
    // Cycle guard: targetId must NOT be a descendant of nodeId, else we'd
    // be making a node its own ancestor.
    if (descendantIds(nodeId).includes(targetId)) {
      showToast("A node can't be moved under its own descendant.", "error");
      return;
    }
    const node = nodes.find((n) => n.id === nodeId);
    const target = nodes.find((n) => n.id === targetId);
    if (!node || !target) return;
    if (node.parent_node_id === targetId) return; // no-op

    setBusy(true);
    const supabase = createSupabaseClient();
    const newSiblingsCount = nodes.filter(
      (n) => (n.parent_node_id ?? null) === targetId,
    ).length;
    const newLevel = target.level + 1;
    const levelShift = newLevel - node.level;

    // Update the moved node itself.
    const { error } = await supabase
      .from("org_nodes")
      .update({
        parent_node_id: targetId,
        level: newLevel,
        sort_order: newSiblingsCount,
      })
      .eq("id", nodeId);
    if (error) {
      setBusy(false);
      showToast(error.message, "error");
      return;
    }

    // Shift all descendants' levels by the same delta so the subtree stays
    // internally consistent.
    if (levelShift !== 0) {
      const descIds = descendantIds(nodeId).filter((id) => id !== nodeId);
      if (descIds.length > 0) {
        await Promise.all(
          descIds.map((id) => {
            const d = nodes.find((n) => n.id === id);
            if (!d) return Promise.resolve({ error: null });
            return supabase
              .from("org_nodes")
              .update({ level: d.level + levelShift })
              .eq("id", id);
          }),
        );
      }
    }

    setBusy(false);
    showToast(`Moved "${node.label}" under "${target.label}"`, "success");
    await refetch();
  }

  async function handleGuardAssign(guardId: string, newNodeId: string | null) {
    const guard = guards.find((g) => g.id === guardId);
    if (!guard) return;
    if ((guard.org_node_id ?? null) === newNodeId) return; // no-op
    setBusy(true);
    const supabase = createSupabaseClient();
    const { error } = await supabase
      .from("guards")
      .update({ org_node_id: newNodeId })
      .eq("id", guardId);
    setBusy(false);
    if (error) {
      showToast(error.message, "error");
      return;
    }
    showToast(
      newNodeId === null ? "Guard unassigned" : "Guard reassigned",
      "success",
    );
    await refetch();
  }

  // ---- Render --------------------------------------------------------------

  return (
    <div style={{ maxWidth: 1280 }}>
      <Breadcrumb client={client} />

      <div
        style={{
          marginTop: 8,
          display: "flex",
          alignItems: "flex-start",
          justifyContent: "space-between",
          gap: 16,
          flexWrap: "wrap",
        }}
      >
        <div>
          <h1
            style={{
              fontSize: 28,
              fontWeight: 600,
              letterSpacing: "-0.02em",
              color: "#f5f5f7",
              margin: 0,
            }}
          >
            Org chart — {client.name}
          </h1>
          <p
            style={{
              marginTop: 8,
              marginBottom: 0,
              fontSize: 13,
              color: "rgba(245, 245, 247, 0.55)",
            }}
          >
            Drag a node onto another to re-parent. Drag a guard chip onto a
            node to assign, or onto the Unassigned strip to unassign.
          </p>
        </div>
        <Link
          href={`/hierarchy/clients/${client.id}`}
          style={goldButtonStyle}
        >
          ← Back to client
        </Link>
      </div>

      <div style={{ height: 20 }} />

      <DndContext
        sensors={sensors}
        collisionDetection={pointerWithin}
        modifiers={[restrictToWindowEdges]}
        onDragStart={onDragStart}
        onDragEnd={onDragEnd}
      >
        <UnassignedStrip guards={unassignedGuards} />

        <div style={{ height: 16 }} />

        <GlassCard style={{ overflow: "hidden" }}>
          {seeding ? (
            <div
              style={{
                padding: "32px 24px",
                textAlign: "center",
                color: "rgba(245, 245, 247, 0.6)",
                fontSize: 13,
              }}
            >
              Setting up the default structure…
            </div>
          ) : nodes.length === 0 ? (
            <EmptyState onSeed={() => {
              didSeed.current = true;
              void seedDefaultChain();
            }} disabled={busy} />
          ) : (
            <div className="org-tree">
              <ul>
                {tree.map((root) => (
                  <TreeBranch
                    key={root.id}
                    node={root}
                    guardsByNode={guardsByNode}
                    busy={busy}
                    onAddChild={(parent) =>
                      setModal({ mode: "add-child", parent })
                    }
                    onRename={(n) => setModal({ mode: "rename", node: n })}
                    onDelete={handleDelete}
                  />
                ))}
              </ul>
            </div>
          )}
        </GlassCard>

        <DragOverlay>
          {activeDrag ? <DragPreview activeDrag={activeDrag} /> : null}
        </DragOverlay>
      </DndContext>

      {modal?.mode === "add-child" ? (
        <NodeFormModal
          title={`Add position under "${modal.parent.label}"`}
          initialLabel=""
          submitLabel="Add position"
          saving={busy}
          onSubmit={(label) => handleAddChild(modal.parent, label)}
          onClose={() => setModal(null)}
        />
      ) : null}
      {modal?.mode === "rename" ? (
        <NodeFormModal
          title="Rename position"
          initialLabel={modal.node.label}
          submitLabel="Save"
          saving={busy}
          onSubmit={(label) => handleRename(modal.node, label)}
          onClose={() => setModal(null)}
        />
      ) : null}
    </div>
  );
}

function Breadcrumb({ client }: { client: Client }) {
  return (
    <div
      style={{
        display: "flex",
        alignItems: "center",
        gap: 8,
        fontSize: 13,
        color: "rgba(245, 245, 247, 0.45)",
      }}
    >
      <Link
        href="/hierarchy"
        style={{ color: "rgba(245, 245, 247, 0.6)", textDecoration: "none" }}
      >
        Guard Deployment
      </Link>
      <span aria-hidden>/</span>
      <Link
        href="/hierarchy/clients"
        style={{ color: "rgba(245, 245, 247, 0.6)", textDecoration: "none" }}
      >
        Clients
      </Link>
      <span aria-hidden>/</span>
      <Link
        href={`/hierarchy/clients/${client.id}`}
        style={{ color: "rgba(245, 245, 247, 0.6)", textDecoration: "none" }}
      >
        {client.name}
      </Link>
      <span aria-hidden>/</span>
      <span style={{ color: "rgba(245, 245, 247, 0.7)" }}>Org chart</span>
    </div>
  );
}

function EmptyState({
  onSeed,
  disabled,
}: {
  onSeed: () => void;
  disabled: boolean;
}) {
  return (
    <div
      style={{
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        gap: 12,
        padding: "32px 24px",
        textAlign: "center",
      }}
    >
      <p
        style={{
          fontSize: 13,
          color: "rgba(245, 245, 247, 0.6)",
          margin: 0,
          maxWidth: 360,
        }}
      >
        No org chart yet for this client.
      </p>
      <button
        type="button"
        disabled={disabled}
        onClick={onSeed}
        style={{
          background: "rgba(255, 255, 255, 0.04)",
          border: "1px solid rgba(255, 255, 255, 0.12)",
          color: "rgba(245, 245, 247, 0.8)",
          borderRadius: 8,
          padding: "10px 16px",
          fontWeight: 500,
          fontSize: 14,
          fontFamily: "inherit",
          cursor: disabled ? "wait" : "pointer",
        }}
      >
        Create default structure
      </button>
    </div>
  );
}

function DragPreview({
  activeDrag,
}: {
  activeDrag: { kind: "node" | "guard"; label: string };
}) {
  return (
    <div
      style={{
        display: "inline-block",
        padding: activeDrag.kind === "node" ? "10px 14px" : "5px 10px",
        backgroundColor: "rgba(8, 11, 18, 0.95)",
        backdropFilter: "blur(20px) saturate(180%)",
        WebkitBackdropFilter: "blur(20px) saturate(180%)",
        border:
          activeDrag.kind === "node"
            ? "1px solid rgba(201, 169, 97, 0.5)"
            : "1px solid rgba(255, 255, 255, 0.16)",
        borderRadius: activeDrag.kind === "node" ? 10 : 6,
        color: "#f5f5f7",
        fontSize: activeDrag.kind === "node" ? 13.5 : 12,
        fontWeight: 600,
        boxShadow: "0 12px 32px rgba(0, 0, 0, 0.5)",
        cursor: "grabbing",
      }}
    >
      {activeDrag.label}
    </div>
  );
}

// ---- Unassigned strip ------------------------------------------------------

function UnassignedStrip({ guards }: { guards: Guard[] }) {
  const { setNodeRef, isOver } = useDroppable({ id: UNASSIGNED_ID });
  return (
    <GlassCard
      style={{
        padding: 12,
        border: isOver
          ? "1px solid rgba(201, 169, 97, 0.5)"
          : "1px solid rgba(255, 255, 255, 0.08)",
        transition: "border-color 150ms ease-out",
      }}
    >
      <div
        ref={setNodeRef}
        style={{
          display: "flex",
          alignItems: "center",
          gap: 10,
          flexWrap: "wrap",
          minHeight: 36,
          padding: 4,
        }}
      >
        <span
          style={{
            fontSize: 11,
            fontWeight: 500,
            letterSpacing: "0.06em",
            textTransform: "uppercase",
            color: "rgba(245, 245, 247, 0.45)",
            marginRight: 4,
            flexShrink: 0,
          }}
        >
          Unassigned ({guards.length})
        </span>
        {guards.length === 0 ? (
          <span
            style={{
              fontSize: 12,
              color: "rgba(245, 245, 247, 0.4)",
            }}
          >
            {isOver ? "Drop here to unassign" : "All guards are assigned."}
          </span>
        ) : (
          guards.map((g) => <GuardChip key={g.id} guard={g} />)
        )}
      </div>
    </GlassCard>
  );
}

// ---- Tree branch + Node card ----------------------------------------------

function TreeBranch({
  node,
  guardsByNode,
  busy,
  onAddChild,
  onRename,
  onDelete,
}: {
  node: TreeNode;
  guardsByNode: Map<string, Guard[]>;
  busy: boolean;
  onAddChild: (parent: OrgNode) => void;
  onRename: (node: OrgNode) => void;
  onDelete: (node: OrgNode) => void;
}) {
  return (
    <li>
      <NodeCard
        node={node}
        guards={guardsByNode.get(node.id) ?? []}
        busy={busy}
        onAddChild={() => onAddChild(node)}
        onRename={() => onRename(node)}
        onDelete={() => onDelete(node)}
      />
      {node.children.length > 0 ? (
        <ul>
          {node.children.map((child) => (
            <TreeBranch
              key={child.id}
              node={child}
              guardsByNode={guardsByNode}
              busy={busy}
              onAddChild={onAddChild}
              onRename={onRename}
              onDelete={onDelete}
            />
          ))}
        </ul>
      ) : null}
    </li>
  );
}

function NodeCard({
  node,
  guards,
  busy,
  onAddChild,
  onRename,
  onDelete,
}: {
  node: OrgNode;
  guards: Guard[];
  busy: boolean;
  onAddChild: () => void;
  onRename: () => void;
  onDelete: () => void;
}) {
  // Drag source: the node card. Drop target: ALSO the node card (drop a
  // node here to re-parent under it; drop a guard here to assign).
  const draggable = useDraggable({ id: `${NODE_PREFIX}${node.id}` });
  const droppable = useDroppable({ id: `${NODE_PREFIX}${node.id}` });

  // Combined ref for both hooks on the same element.
  function setRef(el: HTMLDivElement | null) {
    draggable.setNodeRef(el);
    droppable.setNodeRef(el);
  }

  const borderColor = droppable.isOver
    ? "rgba(201, 169, 97, 0.8)"
    : "rgba(255, 255, 255, 0.10)";

  return (
    <div
      ref={setRef}
      style={{
        display: "inline-block",
        width: 220,
        textAlign: "left",
        verticalAlign: "top",
        backgroundColor: "rgba(255, 255, 255, 0.04)",
        border: `1px solid ${borderColor}`,
        borderTop: "2px solid #c9a961",
        borderRadius: 10,
        boxShadow: droppable.isOver
          ? "0 0 0 3px rgba(201, 169, 97, 0.18)"
          : "0 6px 20px rgba(0, 0, 0, 0.3)",
        padding: 12,
        opacity: draggable.isDragging ? 0.4 : 1,
        cursor: draggable.isDragging ? "grabbing" : "default",
        transition:
          "border-color 150ms ease-out, box-shadow 150ms ease-out, opacity 150ms ease-out",
      }}
    >
      <div style={{ display: "flex", alignItems: "flex-start", gap: 8 }}>
        <DragHandle
          attributes={draggable.attributes}
          listeners={draggable.listeners}
        />
        <div style={{ flex: 1, minWidth: 0 }}>
          <div
            style={{
              fontSize: 13.5,
              fontWeight: 600,
              color: "#f5f5f7",
              letterSpacing: "-0.01em",
              wordBreak: "break-word",
            }}
          >
            {node.label}
          </div>
          <div
            style={{
              marginTop: 2,
              fontSize: 10,
              fontWeight: 500,
              letterSpacing: "0.06em",
              textTransform: "uppercase",
              color: "rgba(245, 245, 247, 0.4)",
            }}
          >
            Level {node.level}
          </div>
        </div>
      </div>

      {/* Assigned guards */}
      <div
        style={{
          marginTop: 10,
          minHeight: 28,
          display: "flex",
          flexWrap: "wrap",
          gap: 5,
        }}
      >
        {guards.length === 0 ? (
          <span
            style={{
              fontSize: 11,
              color: "rgba(245, 245, 247, 0.35)",
            }}
          >
            Drop guards here
          </span>
        ) : (
          guards.map((g) => <GuardChip key={g.id} guard={g} />)
        )}
      </div>

      {/* Actions */}
      <div
        style={{
          marginTop: 10,
          paddingTop: 8,
          borderTop: "1px solid rgba(255, 255, 255, 0.06)",
          display: "flex",
          flexWrap: "wrap",
          gap: 10,
        }}
      >
        <ActionButton label="Add child" onClick={onAddChild} disabled={busy} />
        <ActionButton label="Rename" onClick={onRename} disabled={busy} />
        <ActionButton label="Delete" onClick={onDelete} disabled={busy} danger />
      </div>
    </div>
  );
}

function DragHandle({
  attributes,
  listeners,
}: {
  attributes: ReturnType<typeof useDraggable>["attributes"];
  listeners: ReturnType<typeof useDraggable>["listeners"];
}) {
  return (
    <button
      type="button"
      {...attributes}
      {...listeners}
      aria-label="Drag node"
      title="Drag to move under a different parent"
      style={{
        background: "transparent",
        border: "none",
        padding: 0,
        cursor: "grab",
        color: "rgba(245, 245, 247, 0.4)",
        display: "inline-flex",
        alignItems: "center",
        justifyContent: "center",
        flexShrink: 0,
      }}
    >
      <svg
        width="12"
        height="12"
        viewBox="0 0 24 24"
        fill="currentColor"
        aria-hidden
      >
        <circle cx="9" cy="6" r="1.5" />
        <circle cx="15" cy="6" r="1.5" />
        <circle cx="9" cy="12" r="1.5" />
        <circle cx="15" cy="12" r="1.5" />
        <circle cx="9" cy="18" r="1.5" />
        <circle cx="15" cy="18" r="1.5" />
      </svg>
    </button>
  );
}

function GuardChip({ guard }: { guard: Guard }) {
  const { attributes, listeners, setNodeRef, isDragging } = useDraggable({
    id: `${GUARD_PREFIX}${guard.id}`,
  });
  return (
    <div
      ref={setNodeRef}
      {...attributes}
      {...listeners}
      title={`Drag to move ${guard.full_name}`}
      style={{
        display: "inline-flex",
        alignItems: "center",
        padding: "4px 9px",
        backgroundColor: "rgba(255, 255, 255, 0.05)",
        border: "1px solid rgba(255, 255, 255, 0.10)",
        borderRadius: 6,
        fontSize: 11.5,
        fontWeight: 500,
        color: "#f5f5f7",
        cursor: isDragging ? "grabbing" : "grab",
        opacity: isDragging ? 0.4 : 1,
        transition: "opacity 120ms ease-out",
        userSelect: "none",
      }}
    >
      {guard.full_name}
    </div>
  );
}

function ActionButton({
  label,
  onClick,
  disabled,
  danger,
}: {
  label: string;
  onClick: () => void;
  disabled?: boolean;
  danger?: boolean;
}) {
  const [hover, setHover] = useState(false);
  const color = danger
    ? hover
      ? "#ef4444"
      : "rgba(239, 68, 68, 0.7)"
    : hover
      ? "#f5f5f7"
      : "rgba(245, 245, 247, 0.5)";
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      onMouseEnter={() => setHover(true)}
      onMouseLeave={() => setHover(false)}
      style={{
        background: "transparent",
        border: "none",
        padding: 0,
        fontSize: 12,
        fontWeight: 500,
        fontFamily: "inherit",
        cursor: disabled ? "not-allowed" : "pointer",
        color,
        transition: "color 150ms ease-out",
      }}
    >
      {label}
    </button>
  );
}

