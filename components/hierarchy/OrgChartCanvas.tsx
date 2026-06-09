"use client";

import { useRouter } from "next/navigation";
import {
  useEffect,
  useMemo,
  useRef,
  useState,
  type CSSProperties,
  type ReactNode,
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
import { GuardStatusBadge } from "./badges";
import { GuardAvatar } from "./GuardCard";
import { GuardFormModal } from "./GuardFormModal";
import { GlassCard } from "@/components/ui/GlassCard";
import { Modal } from "@/components/ui/Modal";
import {
  CancelButton,
  Field,
  SelectInput,
  TextInput,
} from "@/components/ui/form";
import { useToast } from "@/components/ui/Toast";
import { ALERT_ACCENT, computeAlertStatus, daysRemaining } from "@/lib/compliance";
import { getGuardPhotoSignedUrlMap } from "@/lib/guard-photo-storage";
import { createClient as createSupabaseClient } from "@/lib/supabase/client";
import type { Client, Guard, OrgNode } from "@/types/database";

const DEFAULT_CHAIN: Array<{ label: string; level: number }> = [
  { label: "Detachment Commander", level: 0 },
  { label: "Shift In-Charge", level: 1 },
  { label: "Senior Guard", level: 2 },
  { label: "Guard", level: 3 },
];

const NODE_PREFIX = "node:";
const GUARD_PREFIX = "guard:";
const UNASSIGNED_ID = "unassigned";
const ROOT_PARENT = "__root__";

// Fixed tile box → uniform layout + exact connector anchor points (no DOM
// measurement needed). Content is arranged to fit this height.
const TILE_W = 230;
const TILE_H = 150;
const H_GAP = 28;
const ROW_H = TILE_H + 56;
const PAD = 24;
const CANVAS_MIN_HEIGHT = 560;

type XY = { x: number; y: number };

function sortSiblings(a: OrgNode, b: OrgNode): number {
  return a.sort_order - b.sort_order || a.label.localeCompare(b.label);
}

// Tidy top-down tree layout. Leaves take sequential x slots; parents center
// over their children. Runs over ALL nodes (positioned ones still get an auto
// slot, used as the fallback when their pos is later cleared). Multiple roots
// fan out left-to-right.
function computeAutoPositions(nodes: OrgNode[]): Map<string, XY> {
  const ids = new Set(nodes.map((n) => n.id));
  const byParent = new Map<string | null, OrgNode[]>();
  for (const n of nodes) {
    const p =
      n.parent_node_id && ids.has(n.parent_node_id) ? n.parent_node_id : null;
    const arr = byParent.get(p) ?? [];
    arr.push(n);
    byParent.set(p, arr);
  }
  for (const arr of byParent.values()) arr.sort(sortSiblings);

  const pos = new Map<string, XY>();
  let cursor = 0;
  function place(node: OrgNode, depth: number): number {
    const kids = byParent.get(node.id) ?? [];
    let cx: number;
    if (kids.length === 0) {
      cx = cursor * (TILE_W + H_GAP);
      cursor += 1;
    } else {
      const xs = kids.map((k) => place(k, depth + 1));
      cx = (xs[0] + xs[xs.length - 1]) / 2;
    }
    pos.set(node.id, { x: cx + PAD, y: depth * ROW_H + PAD });
    return cx;
  }
  for (const root of byParent.get(null) ?? []) place(root, 0);
  return pos;
}

export function OrgChartCanvas({
  detachmentId,
  clientId,
  clients,
  initialNodes,
  initialGuards,
  photoUrlByGuardId,
}: {
  detachmentId: string;
  clientId: string;
  clients: Client[];
  initialNodes: OrgNode[];
  initialGuards: Guard[];
  photoUrlByGuardId: Record<string, string>;
}) {
  const [nodes, setNodes] = useState<OrgNode[]>(initialNodes);
  const [guards, setGuards] = useState<Guard[]>(initialGuards);
  const [photoUrls, setPhotoUrls] =
    useState<Record<string, string>>(photoUrlByGuardId);
  const [seeding, setSeeding] = useState(false);
  const [busy, setBusy] = useState(false);
  const [editNode, setEditNode] = useState<OrgNode | null>(null);
  const [guardModal, setGuardModal] = useState<{
    node: OrgNode;
    guard: Guard | null;
  } | null>(null);
  const [activeDrag, setActiveDrag] = useState<{
    kind: "node" | "guard";
    label: string;
  } | null>(null);
  const didSeed = useRef(false);
  // A node/guard drag fires a trailing click on mouseup — suppress it so a
  // reposition drag doesn't also open the editor. Pure clicks (no drag) never
  // set this, so they open the modal normally.
  const suppressClick = useRef(false);
  const { showToast } = useToast();

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 6 } }),
  );

  const autoPositions = useMemo(() => computeAutoPositions(nodes), [nodes]);

  function renderPos(node: OrgNode): XY {
    if (node.pos_x !== null && node.pos_y !== null) {
      return { x: node.pos_x, y: node.pos_y };
    }
    return autoPositions.get(node.id) ?? { x: PAD, y: PAD };
  }

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

  // Connector segments (parent bottom-center → child top-center), routed via
  // an orthogonal elbow. Works regardless of whether either endpoint is auto
  // or manually positioned.
  const connectors = useMemo(() => {
    const byId = new Map(nodes.map((n) => [n.id, n]));
    const segs: Array<{ id: string; from: XY; to: XY }> = [];
    for (const n of nodes) {
      const pid = n.parent_node_id;
      if (!pid || !byId.has(pid)) continue;
      const p = renderPos(byId.get(pid)!);
      const c = renderPos(n);
      segs.push({
        id: n.id,
        from: { x: p.x + TILE_W / 2, y: p.y + TILE_H },
        to: { x: c.x + TILE_W / 2, y: c.y },
      });
    }
    return segs;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [nodes, autoPositions]);

  const bounds = useMemo(() => {
    let maxX = 0;
    let maxY = 0;
    for (const n of nodes) {
      const p = renderPos(n);
      maxX = Math.max(maxX, p.x + TILE_W);
      maxY = Math.max(maxY, p.y + TILE_H);
    }
    return {
      w: maxX + PAD,
      h: Math.max(maxY + PAD, CANVAS_MIN_HEIGHT),
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [nodes, autoPositions]);

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
        .eq("detachment_id", detachmentId)
        .order("sort_order", { ascending: true }),
      supabase
        .from("guards")
        .select("*")
        .eq("detachment_id", detachmentId)
        .order("full_name", { ascending: true }),
    ]);
    const nextNodes = (nodesRes.data ?? []) as OrgNode[];
    const nextGuards = (guardsRes.data ?? []) as Guard[];
    setNodes(nextNodes);
    setGuards(nextGuards);
    const byPath = await getGuardPhotoSignedUrlMap(
      supabase,
      nextGuards.map((g) => g.photo_url),
    );
    const byId: Record<string, string> = {};
    for (const g of nextGuards) {
      if (g.photo_url && byPath[g.photo_url]) byId[g.id] = byPath[g.photo_url];
    }
    setPhotoUrls(byId);
  }

  async function seedDefaultChain() {
    setSeeding(true);
    const supabase = createSupabaseClient();
    let parentId: string | null = null;
    for (const step of DEFAULT_CHAIN) {
      const { data, error } = await supabase
        .from("org_nodes")
        .insert({
          detachment_id: detachmentId,
          client_id: null,
          parent_node_id: parentId,
          label: step.label,
          level: step.level,
          sort_order: 0,
          is_detached: false,
          pos_x: null,
          pos_y: null,
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

  async function insertNode(label: string, parent: OrgNode | null) {
    setBusy(true);
    const supabase = createSupabaseClient();
    const parentId = parent?.id ?? null;
    const level = parent ? parent.level + 1 : 0;
    const siblings = nodes.filter(
      (n) => (n.parent_node_id ?? null) === parentId,
    );
    const { error } = await supabase.from("org_nodes").insert({
      detachment_id: detachmentId,
      client_id: null,
      parent_node_id: parentId,
      label,
      level,
      sort_order: siblings.length,
      is_detached: false,
      pos_x: null,
      pos_y: null,
    });
    setBusy(false);
    if (error) {
      showToast(error.message, "error");
      return;
    }
    showToast("Position added", "success");
    await refetch();
  }

  async function handleAddChild(parent: OrgNode, label: string) {
    await insertNode(label, parent);
  }

  async function handleAddSibling(node: OrgNode, label: string) {
    const parent = node.parent_node_id
      ? nodes.find((n) => n.id === node.parent_node_id) ?? null
      : null;
    await insertNode(label, parent);
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
    setEditNode(null);
    showToast("Position renamed", "success");
    await refetch();
  }

  async function handleDelete(node: OrgNode) {
    const ids = descendantIds(node.id);
    const childCount = ids.length - 1;
    const ok = window.confirm(
      childCount > 0
        ? `Delete "${node.label}" and its ${childCount} sub-position${childCount === 1 ? "" : "s"}? Guards assigned anywhere in this branch will be unassigned (not deleted).`
        : `Delete "${node.label}"? Any guard assigned here will be unassigned (not deleted).`,
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
    const { error } = await supabase.from("org_nodes").delete().eq("id", node.id);
    setBusy(false);
    if (error) {
      showToast(error.message, "error");
      return;
    }
    setEditNode(null);
    showToast("Position deleted", "success");
    await refetch();
  }

  // Reposition any tile freely (sets pos_x/pos_y). Optimistic local update so
  // the tile doesn't snap back before the refetch settles.
  async function handleReposition(node: OrgNode, x: number, y: number) {
    setNodes((prev) =>
      prev.map((n) => (n.id === node.id ? { ...n, pos_x: x, pos_y: y } : n)),
    );
    const supabase = createSupabaseClient();
    const { error } = await supabase
      .from("org_nodes")
      .update({ pos_x: x, pos_y: y })
      .eq("id", node.id);
    if (error) {
      showToast(error.message, "error");
      await refetch();
    }
  }

  // Clear manual position → rejoin the auto tree layout.
  async function handleResetLayout(node: OrgNode) {
    setBusy(true);
    const supabase = createSupabaseClient();
    const { error } = await supabase
      .from("org_nodes")
      .update({ pos_x: null, pos_y: null })
      .eq("id", node.id);
    setBusy(false);
    if (error) {
      showToast(error.message, "error");
      return;
    }
    setEditNode(null);
    showToast("Reset to auto layout", "success");
    await refetch();
  }

  async function handleUnassignGuard(guard: Guard) {
    setBusy(true);
    const supabase = createSupabaseClient();
    const { error } = await supabase
      .from("guards")
      .update({ org_node_id: null })
      .eq("id", guard.id);
    setBusy(false);
    if (error) {
      showToast(error.message, "error");
      return;
    }
    setEditNode(null);
    showToast("Guard unassigned", "success");
    await refetch();
  }

  // Relationship-only re-parent (targetId null → make root). Used by the
  // editor's "Change parent" / "Detach". Positioning is independent (pos_*).
  async function handleChangeParent(nodeId: string, targetId: string | null) {
    if (nodeId === targetId) return;
    if (targetId && descendantIds(nodeId).includes(targetId)) {
      showToast("A node can't be moved under its own descendant.", "error");
      return;
    }
    const node = nodes.find((n) => n.id === nodeId);
    if (!node) return;
    const target = targetId ? nodes.find((n) => n.id === targetId) : null;
    if (targetId && !target) return;
    if ((node.parent_node_id ?? null) === (targetId ?? null)) {
      setEditNode(null);
      return;
    }

    setBusy(true);
    const supabase = createSupabaseClient();
    const newParentId = targetId ?? null;
    const siblings = nodes.filter(
      (n) => (n.parent_node_id ?? null) === newParentId,
    ).length;
    const newLevel = target ? target.level + 1 : 0;
    const levelShift = newLevel - node.level;

    const { error } = await supabase
      .from("org_nodes")
      .update({
        parent_node_id: newParentId,
        level: newLevel,
        sort_order: siblings,
      })
      .eq("id", nodeId);
    if (error) {
      setBusy(false);
      showToast(error.message, "error");
      return;
    }
    if (levelShift !== 0) {
      const descIds = descendantIds(nodeId).filter((d) => d !== nodeId);
      await Promise.all(
        descIds.map((d) => {
          const dn = nodes.find((n) => n.id === d);
          if (!dn) return Promise.resolve({ error: null });
          return supabase
            .from("org_nodes")
            .update({ level: dn.level + levelShift })
            .eq("id", d);
        }),
      );
    }
    setBusy(false);
    setEditNode(null);
    showToast(
      target ? `Moved under "${target.label}"` : `"${node.label}" is now a root`,
      "success",
    );
    await refetch();
  }

  async function handleGuardAssign(guardId: string, newNodeId: string | null) {
    const guard = guards.find((g) => g.id === guardId);
    if (!guard) return;
    if ((guard.org_node_id ?? null) === newNodeId) return;
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
    showToast(newNodeId === null ? "Guard unassigned" : "Guard assigned", "success");
    await refetch();
  }

  // ---- DnD ----------------------------------------------------------------

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
    const { active, over, delta } = event;
    const activeId = String(active.id);

    // Any real drag suppresses the trailing click.
    if (delta.x !== 0 || delta.y !== 0) {
      suppressClick.current = true;
      window.setTimeout(() => {
        suppressClick.current = false;
      }, 0);
    }

    if (activeId.startsWith(NODE_PREFIX)) {
      // Node drag = free reposition (relationships unchanged).
      const node = nodes.find((n) => n.id === activeId.slice(NODE_PREFIX.length));
      if (!node) return;
      if (delta.x === 0 && delta.y === 0) return;
      const base = renderPos(node);
      await handleReposition(
        node,
        Math.max(0, base.x + delta.x),
        Math.max(0, base.y + delta.y),
      );
      return;
    }

    if (activeId.startsWith(GUARD_PREFIX)) {
      if (!over) return;
      const overId = String(over.id);
      const guardId = activeId.slice(GUARD_PREFIX.length);
      let newNodeId: string | null = null;
      if (overId === UNASSIGNED_ID) newNodeId = null;
      else if (overId.startsWith(NODE_PREFIX))
        newNodeId = overId.slice(NODE_PREFIX.length);
      else return;
      await handleGuardAssign(guardId, newNodeId);
    }
  }

  function openEditor(node: OrgNode) {
    if (suppressClick.current) return;
    setEditNode(node);
  }

  // ---- Render -------------------------------------------------------------

  const editNodeGuard = editNode
    ? guardsByNode.get(editNode.id)?.[0] ?? null
    : null;
  const parentCandidates = editNode
    ? nodes.filter(
        (n) =>
          n.id !== editNode.id && !descendantIds(editNode.id).includes(n.id),
      )
    : [];

  return (
    <div>
      <p
        style={{
          marginTop: 0,
          marginBottom: 16,
          fontSize: 13,
          color: "rgba(245, 245, 247, 0.55)",
        }}
      >
        Click a tile to edit the position or its guard. Drag a tile to place it
        anywhere — connector lines follow. Use the tile editor’s “Change parent”
        to re-wire the hierarchy, or “Reset to auto layout” to snap it back.
        Drag a guard from the Unassigned strip onto a tile to assign.
      </p>
      <DndContext
        sensors={sensors}
        collisionDetection={pointerWithin}
        onDragStart={onDragStart}
        onDragEnd={onDragEnd}
      >
        <UnassignedStrip guards={unassignedGuards} photoUrls={photoUrls} />

        <div style={{ height: 16 }} />

        <GlassCard style={{ overflow: "hidden", padding: 0 }}>
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
            <EmptyState
              onSeed={() => {
                didSeed.current = true;
                void seedDefaultChain();
              }}
              disabled={busy}
            />
          ) : (
            <div style={{ overflow: "auto", maxHeight: "75vh" }}>
              <div
                style={{
                  position: "relative",
                  width: bounds.w,
                  height: bounds.h,
                }}
              >
                <svg
                  width={bounds.w}
                  height={bounds.h}
                  style={{
                    position: "absolute",
                    top: 0,
                    left: 0,
                    pointerEvents: "none",
                    zIndex: 0,
                  }}
                  aria-hidden
                >
                  {connectors.map((seg) => {
                    const midY = seg.from.y + (seg.to.y - seg.from.y) / 2;
                    return (
                      <path
                        key={seg.id}
                        d={`M ${seg.from.x} ${seg.from.y} L ${seg.from.x} ${midY} L ${seg.to.x} ${midY} L ${seg.to.x} ${seg.to.y}`}
                        fill="none"
                        stroke="rgba(255, 255, 255, 0.18)"
                        strokeWidth={1.5}
                      />
                    );
                  })}
                </svg>

                {nodes.map((n) => (
                  <NodeTile
                    key={n.id}
                    node={n}
                    pos={renderPos(n)}
                    guards={guardsByNode.get(n.id) ?? []}
                    photoUrls={photoUrls}
                    onOpen={() => openEditor(n)}
                  />
                ))}
              </div>
            </div>
          )}
        </GlassCard>

        <DragOverlay>
          {activeDrag ? <DragPreview activeDrag={activeDrag} /> : null}
        </DragOverlay>
      </DndContext>

      {editNode ? (
        <NodeEditModal
          node={editNode}
          hasPos={editNode.pos_x !== null && editNode.pos_y !== null}
          parentCandidates={parentCandidates}
          assignedGuard={editNodeGuard}
          assignedPhotoUrl={
            editNodeGuard ? photoUrls[editNodeGuard.id] ?? null : null
          }
          busy={busy}
          onRename={(label) => handleRename(editNode, label)}
          onAddChild={(label) => handleAddChild(editNode, label)}
          onAddSibling={(label) => handleAddSibling(editNode, label)}
          onChangeParent={(pid) => handleChangeParent(editNode.id, pid)}
          onResetLayout={() => handleResetLayout(editNode)}
          onDelete={() => handleDelete(editNode)}
          onEditGuard={(g) => {
            const node = editNode;
            setEditNode(null);
            setGuardModal({ node, guard: g });
          }}
          onAssignGuard={() => {
            const node = editNode;
            setEditNode(null);
            setGuardModal({ node, guard: null });
          }}
          onUnassignGuard={(g) => handleUnassignGuard(g)}
          onClose={() => setEditNode(null)}
        />
      ) : null}

      {guardModal ? (
        <GuardFormModal
          clientId={clientId}
          detachmentId={detachmentId}
          orgNodeId={guardModal.node.id}
          lockAssignment={guardModal.guard === null}
          initialGuard={guardModal.guard}
          clients={clients}
          onClose={() => setGuardModal(null)}
          onSaved={() => {
            setGuardModal(null);
            refetch();
          }}
        />
      ) : null}
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
        No org chart yet for this detachment.
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

function UnassignedStrip({
  guards,
  photoUrls,
}: {
  guards: Guard[];
  photoUrls: Record<string, string>;
}) {
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
          minHeight: 44,
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
          <span style={{ fontSize: 12, color: "rgba(245, 245, 247, 0.4)" }}>
            {isOver ? "Drop here to unassign" : "All guards are assigned."}
          </span>
        ) : (
          guards.map((g) => (
            <GuardChip key={g.id} guard={g} photoUrl={photoUrls[g.id] ?? null} />
          ))
        )}
      </div>
    </GlassCard>
  );
}

function NodeTile({
  node,
  pos,
  guards,
  photoUrls,
  onOpen,
}: {
  node: OrgNode;
  pos: XY;
  guards: Guard[];
  photoUrls: Record<string, string>;
  onOpen: () => void;
}) {
  const draggable = useDraggable({ id: `${NODE_PREFIX}${node.id}` });
  const droppable = useDroppable({ id: `${NODE_PREFIX}${node.id}` });

  function setRef(el: HTMLDivElement | null) {
    draggable.setNodeRef(el);
    droppable.setNodeRef(el);
  }

  const t = draggable.transform;
  const guard = guards[0] ?? null;
  const extra = guards.length - 1;
  const positioned = node.pos_x !== null && node.pos_y !== null;

  const borderColor = droppable.isOver
    ? "rgba(201, 169, 97, 0.8)"
    : positioned
      ? "rgba(201, 169, 97, 0.35)"
      : "rgba(255, 255, 255, 0.10)";

  return (
    <div
      ref={setRef}
      {...draggable.attributes}
      {...draggable.listeners}
      onClick={onOpen}
      title="Click to edit · drag to reposition"
      style={{
        position: "absolute",
        left: pos.x,
        top: pos.y,
        width: TILE_W,
        height: TILE_H,
        transform: t ? `translate3d(${t.x}px, ${t.y}px, 0)` : undefined,
        zIndex: draggable.isDragging ? 40 : 1,
        boxSizing: "border-box",
        backgroundColor: positioned
          ? "rgba(20, 18, 12, 0.96)"
          : "rgba(255, 255, 255, 0.04)",
        border: `1px solid ${borderColor}`,
        borderTop: "2px solid #c9a961",
        borderRadius: 10,
        boxShadow: draggable.isDragging
          ? "0 16px 40px rgba(0, 0, 0, 0.6)"
          : droppable.isOver
            ? "0 0 0 3px rgba(201, 169, 97, 0.18)"
            : "0 6px 20px rgba(0, 0, 0, 0.3)",
        padding: 12,
        cursor: draggable.isDragging ? "grabbing" : "grab",
        opacity: draggable.isDragging ? 0.85 : 1,
        touchAction: "none",
        display: "flex",
        flexDirection: "column",
        overflow: "hidden",
        transition: draggable.isDragging
          ? "none"
          : "border-color 150ms ease-out, box-shadow 150ms ease-out",
      }}
    >
      <div
        style={{
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          gap: 6,
        }}
      >
        <div
          style={{
            fontSize: 10,
            fontWeight: 600,
            letterSpacing: "0.06em",
            textTransform: "uppercase",
            color: "rgba(245, 245, 247, 0.45)",
            whiteSpace: "nowrap",
            overflow: "hidden",
            textOverflow: "ellipsis",
          }}
        >
          {node.label}
        </div>
        {positioned ? (
          <span
            title="Manually positioned"
            style={{
              fontSize: 9,
              fontWeight: 600,
              color: "#c9a961",
              flexShrink: 0,
            }}
          >
            ●
          </span>
        ) : null}
      </div>

      <div style={{ flex: 1, minHeight: 0, marginTop: 10 }}>
        {guard ? (
          <AssignedGuard guard={guard} photoUrl={photoUrls[guard.id] ?? null} />
        ) : (
          <div
            style={{
              height: "100%",
              display: "flex",
              alignItems: "center",
              fontSize: 11.5,
              color: "rgba(245, 245, 247, 0.35)",
            }}
          >
            Drop a guard here, or click to assign
          </div>
        )}
      </div>

      {extra > 0 ? (
        <div style={{ fontSize: 11, color: "rgba(245, 158, 11, 0.85)" }}>
          +{extra} more on this position
        </div>
      ) : null}
    </div>
  );
}

function AssignedGuard({
  guard,
  photoUrl,
}: {
  guard: Guard;
  photoUrl: string | null;
}) {
  const days = daysRemaining(guard.license_expiry);
  const status = computeAlertStatus(guard.license_expiry);
  const showExpiry =
    guard.license_expiry !== null && days !== null && days <= 30;
  return (
    <div style={{ display: "flex", gap: 10, alignItems: "center" }}>
      <GuardAvatar name={guard.full_name} photoUrl={photoUrl} size={44} />
      <div style={{ minWidth: 0, flex: 1 }}>
        <div
          style={{
            fontSize: 13,
            fontWeight: 600,
            color: "#f5f5f7",
            whiteSpace: "nowrap",
            overflow: "hidden",
            textOverflow: "ellipsis",
          }}
        >
          {guard.full_name}
        </div>
        <div
          className="tabular"
          style={{
            fontSize: 11,
            color: "rgba(245, 245, 247, 0.55)",
            marginTop: 2,
          }}
        >
          {guard.license_no ?? "No license"}
        </div>
        <div
          style={{
            marginTop: 5,
            display: "flex",
            alignItems: "center",
            gap: 6,
            flexWrap: "wrap",
          }}
        >
          <GuardStatusBadge status={guard.status} />
          {showExpiry ? (
            <span
              style={{
                fontSize: 10,
                fontWeight: 600,
                padding: "2px 6px",
                borderRadius: 4,
                color: ALERT_ACCENT[status].fg,
                backgroundColor: ALERT_ACCENT[status].bg,
                border: `1px solid ${ALERT_ACCENT[status].border}`,
              }}
            >
              {days! < 0 ? "License expired" : `Expires in ${days}d`}
            </span>
          ) : null}
        </div>
      </div>
    </div>
  );
}

function GuardChip({
  guard,
  photoUrl,
}: {
  guard: Guard;
  photoUrl: string | null;
}) {
  const router = useRouter();
  const { attributes, listeners, setNodeRef, isDragging } = useDraggable({
    id: `${GUARD_PREFIX}${guard.id}`,
  });
  return (
    <div
      ref={setNodeRef}
      {...attributes}
      {...listeners}
      onClick={() => router.push(`/hierarchy/guards/${guard.id}`)}
      title={`${guard.full_name} — drag to assign, click to open`}
      style={{
        display: "inline-flex",
        alignItems: "center",
        gap: 6,
        padding: "3px 8px 3px 3px",
        backgroundColor: "rgba(255, 255, 255, 0.05)",
        border: "1px solid rgba(255, 255, 255, 0.10)",
        borderRadius: 999,
        fontSize: 11.5,
        fontWeight: 500,
        color: "#f5f5f7",
        cursor: isDragging ? "grabbing" : "pointer",
        opacity: isDragging ? 0.4 : 1,
        transition: "opacity 120ms ease-out",
        userSelect: "none",
        touchAction: "none",
        maxWidth: 180,
      }}
    >
      <GuardAvatar name={guard.full_name} photoUrl={photoUrl} size={22} ring={false} />
      <span
        style={{
          whiteSpace: "nowrap",
          overflow: "hidden",
          textOverflow: "ellipsis",
        }}
      >
        {guard.full_name}
      </span>
    </div>
  );
}

// ---- Node edit modal ------------------------------------------------------

function NodeEditModal({
  node,
  hasPos,
  parentCandidates,
  assignedGuard,
  assignedPhotoUrl,
  busy,
  onRename,
  onAddChild,
  onAddSibling,
  onChangeParent,
  onResetLayout,
  onDelete,
  onEditGuard,
  onAssignGuard,
  onUnassignGuard,
  onClose,
}: {
  node: OrgNode;
  hasPos: boolean;
  parentCandidates: OrgNode[];
  assignedGuard: Guard | null;
  assignedPhotoUrl: string | null;
  busy: boolean;
  onRename: (label: string) => void;
  onAddChild: (label: string) => void;
  onAddSibling: (label: string) => void;
  onChangeParent: (parentId: string | null) => void;
  onResetLayout: () => void;
  onDelete: () => void;
  onEditGuard: (g: Guard) => void;
  onAssignGuard: () => void;
  onUnassignGuard: (g: Guard) => void;
  onClose: () => void;
}) {
  const [label, setLabel] = useState(node.label);
  const [newPos, setNewPos] = useState("");
  const [parentSel, setParentSel] = useState(
    node.parent_node_id ?? ROOT_PARENT,
  );

  const parentOptions = [
    { value: ROOT_PARENT, label: "— Make root (no parent) —" },
    ...parentCandidates.map((c) => ({
      value: c.id,
      label: `${c.label} (level ${c.level})`,
    })),
  ];

  return (
    <Modal title="Edit position" onClose={onClose} maxWidth={560}>
      <SectionLabel>Position</SectionLabel>
      <Field label="Role / position name" htmlFor="node-label">
        <div style={{ display: "flex", gap: 8 }}>
          <div style={{ flex: 1 }}>
            <TextInput id="node-label" value={label} onChange={setLabel} disabled={busy} />
          </div>
          <ChipButton
            label="Save"
            onClick={() => label.trim() && onRename(label.trim())}
            disabled={busy || !label.trim() || label.trim() === node.label}
          />
        </div>
      </Field>

      <Field
        label="Add a position"
        htmlFor="node-new-pos"
        helper="Child = one level down. Sibling = peer under the same parent."
      >
        <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
          <div style={{ flex: 1, minWidth: 160 }}>
            <TextInput
              id="node-new-pos"
              value={newPos}
              onChange={setNewPos}
              placeholder="e.g. Relief Guard"
              disabled={busy}
            />
          </div>
          <ChipButton
            label="Add child"
            onClick={() => {
              if (!newPos.trim()) return;
              onAddChild(newPos.trim());
              setNewPos("");
            }}
            disabled={busy || !newPos.trim()}
          />
          <ChipButton
            label="Add sibling"
            onClick={() => {
              if (!newPos.trim()) return;
              onAddSibling(newPos.trim());
              setNewPos("");
            }}
            disabled={busy || !newPos.trim()}
          />
        </div>
      </Field>

      <Field label="Change parent" htmlFor="node-parent">
        <div style={{ display: "flex", gap: 8 }}>
          <div style={{ flex: 1 }}>
            <SelectInput
              id="node-parent"
              value={parentSel}
              onChange={setParentSel}
              options={parentOptions}
              disabled={busy}
            />
          </div>
          <ChipButton
            label="Apply"
            onClick={() =>
              onChangeParent(parentSel === ROOT_PARENT ? null : parentSel)
            }
            disabled={busy}
          />
        </div>
      </Field>

      <div style={{ display: "flex", gap: 10, flexWrap: "wrap", marginTop: 4 }}>
        {node.parent_node_id ? (
          <ChipButton
            label="Detach (make root)"
            onClick={() => onChangeParent(null)}
            disabled={busy}
          />
        ) : null}
        {hasPos ? (
          <ChipButton
            label="Reset to auto layout"
            onClick={onResetLayout}
            disabled={busy}
          />
        ) : null}
        <ChipButton label="Delete position" onClick={onDelete} disabled={busy} danger />
      </div>

      <Divider />

      <SectionLabel>Guard</SectionLabel>
      {assignedGuard ? (
        <div>
          <div
            style={{
              display: "flex",
              alignItems: "center",
              gap: 12,
              padding: 12,
              borderRadius: 10,
              backgroundColor: "rgba(255, 255, 255, 0.03)",
              border: "1px solid rgba(255, 255, 255, 0.08)",
            }}
          >
            <GuardAvatar
              name={assignedGuard.full_name}
              photoUrl={assignedPhotoUrl}
              size={48}
            />
            <div style={{ minWidth: 0, flex: 1 }}>
              <div style={{ fontSize: 14, fontWeight: 600, color: "#f5f5f7" }}>
                {assignedGuard.full_name}
              </div>
              <div
                className="tabular"
                style={{
                  fontSize: 12,
                  color: "rgba(245, 245, 247, 0.55)",
                  marginTop: 2,
                }}
              >
                {assignedGuard.license_no ?? "No license no."}
              </div>
            </div>
            <GuardStatusBadge status={assignedGuard.status} />
          </div>
          <div style={{ display: "flex", gap: 10, marginTop: 12, flexWrap: "wrap" }}>
            <ChipButton
              label="Edit guard details"
              onClick={() => onEditGuard(assignedGuard)}
              disabled={busy}
              primary
            />
            <ChipButton
              label="Unassign guard"
              onClick={() => onUnassignGuard(assignedGuard)}
              disabled={busy}
              danger
            />
          </div>
        </div>
      ) : (
        <div>
          <p style={{ margin: "0 0 12px", fontSize: 13, color: "rgba(245, 245, 247, 0.6)" }}>
            No guard assigned. Add one here, or drag a guard from the Unassigned
            strip onto the tile.
          </p>
          <ChipButton label="Assign guard" onClick={onAssignGuard} disabled={busy} primary />
        </div>
      )}

      <div style={{ height: 20 }} />
      <div style={{ display: "flex", justifyContent: "center" }}>
        <CancelButton onClick={onClose} disabled={busy}>
          Close
        </CancelButton>
      </div>
    </Modal>
  );
}

function SectionLabel({ children }: { children: ReactNode }) {
  return (
    <div
      style={{
        fontSize: 11,
        fontWeight: 600,
        letterSpacing: "0.08em",
        textTransform: "uppercase",
        color: "#c9a961",
        marginBottom: 12,
      }}
    >
      {children}
    </div>
  );
}

function Divider() {
  return (
    <div
      style={{
        height: 1,
        margin: "20px 0",
        backgroundColor: "rgba(255, 255, 255, 0.08)",
      }}
    />
  );
}

function ChipButton({
  label,
  onClick,
  disabled,
  danger,
  primary,
}: {
  label: string;
  onClick: () => void;
  disabled?: boolean;
  danger?: boolean;
  primary?: boolean;
}) {
  const base: CSSProperties = {
    borderRadius: 8,
    padding: "9px 14px",
    fontSize: 13,
    fontWeight: 600,
    fontFamily: "inherit",
    cursor: disabled ? "not-allowed" : "pointer",
    opacity: disabled ? 0.5 : 1,
    whiteSpace: "nowrap",
  };
  const variant: CSSProperties = primary
    ? {
        background: "linear-gradient(180deg, #D4B670 0%, #C9A961 100%)",
        color: "#080b12",
        border: "1px solid rgba(201, 169, 97, 0.4)",
      }
    : {
        background: "rgba(255, 255, 255, 0.04)",
        color: danger ? "#ef4444" : "rgba(245, 245, 247, 0.8)",
        border: `1px solid ${danger ? "rgba(239, 68, 68, 0.3)" : "rgba(255, 255, 255, 0.12)"}`,
      };
  return (
    <button type="button" onClick={onClick} disabled={disabled} style={{ ...base, ...variant }}>
      {label}
    </button>
  );
}
