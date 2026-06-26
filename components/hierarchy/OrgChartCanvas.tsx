"use client";

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
  MeasuringStrategy,
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
import { TransformWrapper, TransformComponent } from "react-zoom-pan-pinch";
import { GuardStatusBadge } from "./badges";
import { GuardAvatar, GuardPhotoBlock } from "./GuardCard";
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
import type { Client, Guard, OrgNode, Shift } from "@/types/database";

const NODE_PREFIX = "node:";
const GUARD_PREFIX = "guard:";
const UNASSIGNED_ID = "unassigned";
// Droppable shift-tab ids: "shift-tab-day" / "shift-tab-night" / "shift-tab-reliever".
export const SHIFT_TAB_PREFIX = "shift-tab-";
const ROOT_PARENT = "__root__";

export type GuardDropResult =
  | { kind: "shift"; guardId: string; shift: "day" | "night" | "reliever" }
  | { kind: "assign"; guardId: string; nodeId: string | null }
  | null;

// Pure routing for a dragged guard chip: given the active draggable id and the
// droppable it was released on, decide whether this is a shift retag (dropped
// on a shift tab) or a tree assignment (dropped on a node tile / unassigned).
export function classifyGuardDrop(
  activeId: string,
  overId: string | null,
): GuardDropResult {
  if (!activeId.startsWith(GUARD_PREFIX) || !overId) return null;
  const guardId = activeId.slice(GUARD_PREFIX.length);
  if (overId.startsWith(SHIFT_TAB_PREFIX)) {
    return {
      kind: "shift",
      guardId,
      shift: overId.slice(SHIFT_TAB_PREFIX.length) as
        | "day"
        | "night"
        | "reliever",
    };
  }
  if (overId === UNASSIGNED_ID) return { kind: "assign", guardId, nodeId: null };
  if (overId.startsWith(NODE_PREFIX)) {
    return { kind: "assign", guardId, nodeId: overId.slice(NODE_PREFIX.length) };
  }
  return null;
}

// Fixed tile box → uniform layout + exact connector anchor points (no DOM
// measurement needed). Half-and-half tile: full-height photo column on the
// left, guard info on the right.
const TILE_W = 280;
const TILE_H = 150;
const PHOTO_W = 120;
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
  activeShift = "all",
  onGuardsChanged,
  tabStrip,
}: {
  detachmentId: string;
  clientId: string;
  clients: Client[];
  initialNodes: OrgNode[];
  initialGuards: Guard[];
  photoUrlByGuardId: Record<string, string>;
  // "all" shows every node; a shift filters to that shift + any/null nodes.
  activeShift?: Shift | "all";
  // Notifies the parent (detachment page) when guard data changed here, so the
  // Relievers strip can re-sync (e.g. a guard toggled to/from reliever).
  onGuardsChanged?: () => void;
  // The detachment's shift-tab strip, rendered INSIDE this chart's DndContext
  // so its tabs can act as drop targets for Unassigned guard chips.
  tabStrip?: ReactNode;
}) {
  const [nodes, setNodes] = useState<OrgNode[]>(initialNodes);
  const [guards, setGuards] = useState<Guard[]>(initialGuards);
  const [photoUrls, setPhotoUrls] =
    useState<Record<string, string>>(photoUrlByGuardId);
  const [seeding, setSeeding] = useState(false);
  const [busy, setBusy] = useState(false);
  const [editNode, setEditNode] = useState<OrgNode | null>(null);
  const [guardModal, setGuardModal] = useState<{
    // node === null → editing a guard not tied to a tile (an Unassigned chip).
    node: OrgNode | null;
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

  // The full structure renders on every tab — the shift tabs differ only in
  // which guard shows inside each tile (see guardsByNode). So layout and
  // connectors are identical across All/Day/Night.
  const visibleNodes = nodes;

  const autoPositions = useMemo(
    () => computeAutoPositions(visibleNodes),
    [visibleNodes],
  );

  function renderPos(node: OrgNode): XY {
    if (node.pos_x !== null && node.pos_y !== null) {
      return { x: node.pos_x, y: node.pos_y };
    }
    return autoPositions.get(node.id) ?? { x: PAD, y: PAD };
  }

  // Guard shown inside each tile. On a shift tab, a tile only shows its
  // assigned guard if that guard's shift_type matches — otherwise the tile
  // renders empty (a "Drop a guard here" drop target) even though the position
  // still exists. The All tab shows every assigned guard.
  const guardsByNode = useMemo(() => {
    const m = new Map<string, Guard[]>();
    for (const g of guards) {
      if (!g.org_node_id) continue;
      if (activeShift !== "all" && g.shift_type !== activeShift) continue;
      const list = m.get(g.org_node_id) ?? [];
      list.push(g);
      m.set(g.org_node_id, list);
    }
    return m;
  }, [guards, activeShift]);

  // Unassigned strip, filtered per active tab:
  //  - All: every guard not in the tree and not a reliever.
  //  - Day/Night: only that shift's guards still waiting for a tree position.
  // (The chart isn't rendered on the Reliever tab, so no case for it here.)
  const unassignedGuards = useMemo(() => {
    if (activeShift === "all") {
      return guards.filter((g) => !g.org_node_id && !g.is_reliever);
    }
    return guards.filter(
      (g) => !g.org_node_id && g.shift_type === activeShift,
    );
  }, [guards, activeShift]);

  // Connector segments (parent bottom-center → child top-center), routed via
  // an orthogonal elbow. Works regardless of whether either endpoint is auto
  // or manually positioned.
  const connectors = useMemo(() => {
    const byId = new Map(visibleNodes.map((n) => [n.id, n]));
    const segs: Array<{ id: string; from: XY; to: XY }> = [];
    for (const n of visibleNodes) {
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
  }, [visibleNodes, autoPositions]);

  const bounds = useMemo(() => {
    let maxX = 0;
    let maxY = 0;
    for (const n of visibleNodes) {
      const p = renderPos(n);
      maxX = Math.max(maxX, p.x + TILE_W);
      maxY = Math.max(maxY, p.y + TILE_H);
    }
    return {
      w: maxX + PAD,
      h: Math.max(maxY + PAD, CANVAS_MIN_HEIGHT),
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [visibleNodes, autoPositions]);

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
    onGuardsChanged?.();
  }

  // New detachments seed a simple linear chain. Positions no longer carry a
  // shift (that moved to guards.shift_type), so org_nodes.shift stays null.
  async function seedDefaultChain() {
    setSeeding(true);
    const supabase = createSupabaseClient();
    const chain = [
      "Detachment Commander",
      "Shift In-Charge",
      "Senior Guard",
      "Guard",
    ];
    let parentId: string | null = null;
    for (let level = 0; level < chain.length; level++) {
      const { data, error } = await supabase
        .from("org_nodes")
        .insert({
          detachment_id: detachmentId,
          client_id: null,
          parent_node_id: parentId,
          label: chain[level],
          level,
          sort_order: 0,
          is_detached: false,
          pos_x: null,
          pos_y: null,
          shift: null,
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
      // New positions inherit the shift of the position they attach under.
      shift: parent?.shift ?? null,
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

  // ---- Quick tile affordances (hover buttons) -----------------------------
  // These mirror the modal's add/sibling/delete but skip the dialog for speed.
  // The modal paths stay as alternates.

  // Add a child directly under the tile. Reuses insertNode (shift inherits from
  // the parent = this tile, sort_order appends at end). No modal afterwards.
  async function handleQuickAddChild(node: OrgNode) {
    if (busy) return;
    await insertNode("New position", node);
  }

  // Add a peer under the same parent (root → another root). Unlike the modal's
  // append-at-end, this slots the new position immediately AFTER the current
  // tile (sort_order + 1) and bumps any later siblings to make room.
  async function handleQuickAddSibling(node: OrgNode) {
    if (busy) return;
    setBusy(true);
    const supabase = createSupabaseClient();
    const parentId = node.parent_node_id ?? null;
    const newSort = node.sort_order + 1;
    const toBump = nodes.filter(
      (n) =>
        (n.parent_node_id ?? null) === parentId &&
        n.id !== node.id &&
        n.sort_order >= newSort,
    );
    const bumpResults = await Promise.all(
      toBump.map((s) =>
        supabase
          .from("org_nodes")
          .update({ sort_order: s.sort_order + 1 })
          .eq("id", s.id),
      ),
    );
    const bumpErr = bumpResults.find((r) => r.error);
    if (bumpErr?.error) {
      setBusy(false);
      showToast(bumpErr.error.message, "error");
      await refetch();
      return;
    }
    const { error } = await supabase.from("org_nodes").insert({
      detachment_id: detachmentId,
      client_id: null,
      parent_node_id: parentId,
      label: "New position",
      level: node.level,
      sort_order: newSort,
      is_detached: false,
      pos_x: null,
      pos_y: null,
      // Inherit the current tile's shift (positions usually carry null).
      shift: node.shift,
    });
    setBusy(false);
    if (error) {
      showToast(error.message, "error");
      await refetch();
      return;
    }
    showToast("Position added", "success");
    await refetch();
  }

  // Delete just this position, preserving the branch below it: the tile's own
  // guard is unassigned, and its direct children are promoted to take its place
  // under the grandparent (parent_node_id rewritten, level shifted up by one for
  // each promoted subtree). This differs from the modal's delete, which cascades
  // the whole branch. parent_node_id is ON DELETE CASCADE, so children MUST be
  // reparented before the row is removed.
  async function handleQuickDelete(node: OrgNode) {
    if (busy) return;
    const ok = window.confirm(
      "Delete this position? Any assigned guard will become unassigned. This cannot be undone.",
    );
    if (!ok) return;
    setBusy(true);
    const supabase = createSupabaseClient();

    // 1. Unassign any guard sitting directly on this position.
    const { error: unassignErr } = await supabase
      .from("guards")
      .update({ org_node_id: null })
      .eq("org_node_id", node.id);
    if (unassignErr) {
      setBusy(false);
      showToast(unassignErr.message, "error");
      return;
    }

    // 2. Promote direct children to the grandparent, appended after its
    //    existing children. Each promoted subtree shifts up one level.
    const grandparentId = node.parent_node_id ?? null;
    const children = nodes
      .filter((n) => n.parent_node_id === node.id)
      .sort(sortSiblings);
    if (children.length > 0) {
      const siblingOrders = nodes
        .filter(
          (n) => (n.parent_node_id ?? null) === grandparentId && n.id !== node.id,
        )
        .map((n) => n.sort_order);
      let nextSort = siblingOrders.length ? Math.max(...siblingOrders) + 1 : 0;
      const updates: Array<PromiseLike<{ error: { message: string } | null }>> =
        [];
      for (const child of children) {
        updates.push(
          supabase
            .from("org_nodes")
            .update({
              parent_node_id: grandparentId,
              sort_order: nextSort++,
              level: Math.max(0, child.level - 1),
            })
            .eq("id", child.id),
        );
        for (const descId of descendantIds(child.id).filter(
          (d) => d !== child.id,
        )) {
          const dn = nodes.find((n) => n.id === descId);
          if (!dn) continue;
          updates.push(
            supabase
              .from("org_nodes")
              .update({ level: Math.max(0, dn.level - 1) })
              .eq("id", descId),
          );
        }
      }
      const results = await Promise.all(updates);
      const promoteErr = results.find((r) => r.error);
      if (promoteErr?.error) {
        setBusy(false);
        showToast(promoteErr.error.message, "error");
        await refetch();
        return;
      }
    }

    // 3. Remove the now-childless position.
    const { error } = await supabase
      .from("org_nodes")
      .delete()
      .eq("id", node.id);
    setBusy(false);
    if (error) {
      showToast(error.message, "error");
      await refetch();
      return;
    }
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

  // Dropping a guard chip on a shift tab retags its shift in one motion.
  // Reliever also clears the tree position (matching the form); day/night keep
  // it. Updates by guardId directly — no dependency on finding the guard in a
  // possibly-stale local closure (that previously caused a silent early return).
  async function handleGuardShiftDrop(
    guardId: string,
    shift: "day" | "night" | "reliever",
  ) {
    setBusy(true);
    try {
      const supabase = createSupabaseClient();
      const update =
        shift === "reliever"
          ? { shift_type: "reliever", is_reliever: true, org_node_id: null }
          : { shift_type: shift, is_reliever: false };
      const { error } = await supabase
        .from("guards")
        .update(update)
        .eq("id", guardId);
      if (error) {
        console.error("[DnD] supabase error", error);
        showToast(error.message, "error");
        return;
      }
      showToast(
        shift === "reliever" ? "Updated to reliever" : `Updated to ${shift} shift`,
        "success",
      );
      await refetch();
    } catch (e) {
      console.error("[DnD] handleGuardShiftDrop threw", e);
      showToast(
        e instanceof Error ? e.message : "Failed to update shift",
        "error",
      );
    } finally {
      setBusy(false);
    }
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
      const result = classifyGuardDrop(activeId, over ? String(over.id) : null);
      if (!result) return;
      if (result.kind === "shift") {
        // Dropped on a shift tab → retag shift (reliever clears the tree
        // position inside the handler; day/night keep it).
        await handleGuardShiftDrop(result.guardId, result.shift);
      } else {
        await handleGuardAssign(result.guardId, result.nodeId);
      }
    }
  }

  function openEditor(node: OrgNode) {
    if (suppressClick.current) return;
    setEditNode(node);
  }

  // Click (not drag) on an Unassigned chip → edit that guard so the user can
  // pick its shift_type. suppressClick ensures a drag never opens this.
  function openGuardEditor(guard: Guard) {
    if (suppressClick.current) return;
    setGuardModal({ node: null, guard });
  }

  // ---- Render -------------------------------------------------------------

  // Use the actual assigned guard (not the shift-filtered view) so the editor
  // can manage a guard even on a shift tab where its tile renders empty.
  const editNodeGuard = editNode
    ? guards.find((g) => g.org_node_id === editNode.id) ?? null
    : null;
  const parentCandidates = editNode
    ? nodes.filter(
        (n) =>
          n.id !== editNode.id && !descendantIds(editNode.id).includes(n.id),
      )
    : [];

  return (
    <div>
      <DndContext
        sensors={sensors}
        collisionDetection={pointerWithin}
        // Re-measure droppables continuously. The shift-tab drop targets (and
        // the canvas tiles) can be stale at drop time if the scrollable canvas
        // has scrolled — measuring once at drag-start (the default) caused the
        // drop's `over` to be null even though the tab highlighted on hover.
        measuring={{ droppable: { strategy: MeasuringStrategy.Always } }}
        onDragStart={onDragStart}
        onDragEnd={onDragEnd}
      >
        {/* Tab strip lives inside the DndContext so its tabs can be drop
            targets for Unassigned guard chips. */}
        {tabStrip}
        <p
          style={{
            marginTop: 0,
            marginBottom: 16,
            fontSize: 13,
            color: "rgba(245, 245, 247, 0.55)",
          }}
        >
          Click a tile to edit the position or its guard. Drag a tile to place
          it anywhere — connector lines follow. Drag a guard chip onto a tile to
          assign, or onto a shift tab to change its shift.
        </p>
        <UnassignedStrip
          guards={unassignedGuards}
          photoUrls={photoUrls}
          activeShift={activeShift}
          onGuardClick={openGuardEditor}
        />

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
            // All / Day / Night → zoom + pan. cmd/ctrl-wheel zooms; plain wheel
            // scrolls; drag empty canvas pans; tiles are excluded so their
            // dnd-kit drag (reposition) and click (edit) keep working. (The
            // Reliever tab renders its own view in the page, not this chart.)
            <ZoomPanCanvas>
              <ChartInner
                bounds={bounds}
                connectors={connectors}
                visibleNodes={visibleNodes}
                renderPos={renderPos}
                guardsByNode={guardsByNode}
                photoUrls={photoUrls}
                busy={busy}
                onOpen={openEditor}
                onAddChild={handleQuickAddChild}
                onAddSibling={handleQuickAddSibling}
                onDelete={handleQuickDelete}
              />
            </ZoomPanCanvas>
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
          orgNodeId={guardModal.node?.id ?? null}
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

// The positioned canvas (connectors + tiles). Shared by the zoom/pan path
// (All tab) and the scroll-only path (shift tabs).
function ChartInner({
  bounds,
  connectors,
  visibleNodes,
  renderPos,
  guardsByNode,
  photoUrls,
  busy,
  onOpen,
  onAddChild,
  onAddSibling,
  onDelete,
}: {
  bounds: { w: number; h: number };
  connectors: Array<{ id: string; from: XY; to: XY }>;
  visibleNodes: OrgNode[];
  renderPos: (n: OrgNode) => XY;
  guardsByNode: Map<string, Guard[]>;
  photoUrls: Record<string, string>;
  busy: boolean;
  onOpen: (n: OrgNode) => void;
  onAddChild: (n: OrgNode) => void;
  onAddSibling: (n: OrgNode) => void;
  onDelete: (n: OrgNode) => void;
}) {
  return (
    <div style={{ position: "relative", width: bounds.w, height: bounds.h }}>
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

      {visibleNodes.map((n) => (
        <NodeTile
          key={n.id}
          node={n}
          pos={renderPos(n)}
          guards={guardsByNode.get(n.id) ?? []}
          photoUrls={photoUrls}
          busy={busy}
          onOpen={() => onOpen(n)}
          onAddChild={onAddChild}
          onAddSibling={onAddSibling}
          onDelete={onDelete}
        />
      ))}
    </div>
  );
}

// Zoom/pan wrapper used on the All / Day / Night chart tabs.
function ZoomPanCanvas({ children }: { children: ReactNode }) {
  const [pct, setPct] = useState(100);
  return (
    <div style={{ position: "relative" }}>
      <TransformWrapper
        minScale={0.3}
        maxScale={1.5}
        initialScale={1}
        doubleClick={{ disabled: true }}
        // Plain wheel passes through (native scroll); only cmd/ctrl-wheel zooms.
        wheel={{ step: 0.15, activationKeys: ["Meta", "Control"] }}
        // Tiles are excluded so a drag that starts on a tile is handled by
        // dnd-kit (reposition), not the pan. Empty-canvas drag pans.
        panning={{ excluded: ["ga-tile"] }}
        onTransform={(_ref, state) => setPct(Math.round(state.scale * 100))}
      >
        {({ zoomIn, zoomOut, resetTransform }) => (
          <>
            <div
              style={{
                position: "absolute",
                top: 10,
                right: 10,
                zIndex: 6,
                display: "inline-flex",
                alignItems: "center",
                gap: 6,
                padding: 4,
                borderRadius: 10,
                backgroundColor: "rgba(8, 11, 18, 0.7)",
                border: "1px solid rgba(255, 255, 255, 0.1)",
                backdropFilter: "blur(8px)",
              }}
            >
              <ZoomButton label="Zoom out" onClick={() => zoomOut()}>
                −
              </ZoomButton>
              <span
                className="tabular"
                style={{
                  minWidth: 38,
                  textAlign: "center",
                  fontSize: 11.5,
                  fontWeight: 600,
                  color: "rgba(245, 245, 247, 0.7)",
                }}
              >
                {pct}%
              </span>
              <ZoomButton label="Zoom in" onClick={() => zoomIn()}>
                +
              </ZoomButton>
              <ZoomButton label="Fit / reset" onClick={() => resetTransform()}>
                <svg
                  width="13"
                  height="13"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="2"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  aria-hidden
                >
                  <path d="M3 9l9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z" />
                  <polyline points="9 22 9 12 15 12 15 22" />
                </svg>
              </ZoomButton>
            </div>
            <TransformComponent
              wrapperStyle={{
                width: "100%",
                maxHeight: "75vh",
                overflow: "auto",
              }}
            >
              {children}
            </TransformComponent>
          </>
        )}
      </TransformWrapper>
    </div>
  );
}

function ZoomButton({
  label,
  onClick,
  children,
}: {
  label: string;
  onClick: () => void;
  children: ReactNode;
}) {
  const [hover, setHover] = useState(false);
  return (
    <button
      type="button"
      onClick={onClick}
      onMouseEnter={() => setHover(true)}
      onMouseLeave={() => setHover(false)}
      aria-label={label}
      title={label}
      style={{
        width: 26,
        height: 26,
        display: "inline-flex",
        alignItems: "center",
        justifyContent: "center",
        borderRadius: 7,
        fontSize: 16,
        fontWeight: 600,
        fontFamily: "inherit",
        cursor: "pointer",
        background: hover ? "rgba(201, 169, 97, 0.12)" : "rgba(255, 255, 255, 0.04)",
        border: `1px solid ${hover ? "rgba(201, 169, 97, 0.45)" : "rgba(255, 255, 255, 0.1)"}`,
        color: hover ? "#d4b670" : "rgba(245, 245, 247, 0.7)",
        transition: "color 150ms ease-out, background-color 150ms ease-out, border-color 150ms ease-out",
      }}
    >
      {children}
    </button>
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
  activeShift,
  onGuardClick,
}: {
  guards: Guard[];
  photoUrls: Record<string, string>;
  activeShift: Shift | "all";
  onGuardClick: (g: Guard) => void;
}) {
  const { setNodeRef, isOver } = useDroppable({ id: UNASSIGNED_ID });
  const emptyText =
    activeShift === "day"
      ? "No unassigned day-shift guards."
      : activeShift === "night"
        ? "No unassigned night-shift guards."
        : "All guards are assigned.";
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
            {isOver ? "Drop here to unassign" : emptyText}
          </span>
        ) : (
          guards.map((g) => (
            <GuardChip
              key={g.id}
              guard={g}
              photoUrl={photoUrls[g.id] ?? null}
              onOpen={() => onGuardClick(g)}
            />
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
  busy,
  onOpen,
  onAddChild,
  onAddSibling,
  onDelete,
}: {
  node: OrgNode;
  pos: XY;
  guards: Guard[];
  photoUrls: Record<string, string>;
  busy: boolean;
  onOpen: () => void;
  onAddChild: (n: OrgNode) => void;
  onAddSibling: (n: OrgNode) => void;
  onDelete: (n: OrgNode) => void;
}) {
  const draggable = useDraggable({ id: `${NODE_PREFIX}${node.id}` });
  const droppable = useDroppable({ id: `${NODE_PREFIX}${node.id}` });
  // True while the pointer is over the tile OR keyboard focus is anywhere
  // inside it — drives the fade-in of the quick-action buttons.
  const [active, setActive] = useState(false);

  function setRef(el: HTMLDivElement | null) {
    draggable.setNodeRef(el);
    droppable.setNodeRef(el);
  }

  const t = draggable.transform;
  const guard = guards[0] ?? null;
  const extra = guards.length - 1;
  const positioned = node.pos_x !== null && node.pos_y !== null;

  const days = guard ? daysRemaining(guard.license_expiry) : null;
  const expiryStatus = guard ? computeAlertStatus(guard.license_expiry) : "ok";
  const showExpiry =
    guard !== null &&
    guard.license_expiry !== null &&
    days !== null &&
    days <= 30;

  const borderColor = droppable.isOver
    ? "rgba(201, 169, 97, 0.8)"
    : positioned
      ? "rgba(201, 169, 97, 0.35)"
      : "rgba(255, 255, 255, 0.10)";

  return (
    // Outer wrapper owns positioning + drag/drop and does NOT clip, so the
    // edge-overlapping action buttons aren't cut off. The inner card keeps the
    // overflow:hidden needed for the photo column + rounded corners.
    <div
      ref={setRef}
      className="ga-tile"
      {...draggable.attributes}
      {...draggable.listeners}
      onClick={onOpen}
      onMouseEnter={() => setActive(true)}
      onMouseLeave={() => setActive(false)}
      onFocus={() => setActive(true)}
      onBlur={(e) => {
        if (!e.currentTarget.contains(e.relatedTarget as Node | null)) {
          setActive(false);
        }
      }}
      title="Click to edit · drag to reposition"
      style={{
        position: "absolute",
        left: pos.x,
        top: pos.y,
        width: TILE_W,
        height: TILE_H,
        transform: t ? `translate3d(${t.x}px, ${t.y}px, 0)` : undefined,
        // Lift the hovered/focused tile above its neighbours so the overflowing
        // buttons sit on top of adjacent tiles.
        zIndex: draggable.isDragging ? 40 : active ? 30 : 1,
        cursor: draggable.isDragging ? "grabbing" : "grab",
        opacity: draggable.isDragging ? 0.85 : 1,
        touchAction: "none",
      }}
    >
      {/* Visual card (clipped) */}
      <div
        style={{
          width: "100%",
          height: "100%",
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
          display: "flex",
          flexDirection: "row",
          overflow: "hidden",
          transition: draggable.isDragging
            ? "none"
            : "border-color 150ms ease-out, box-shadow 150ms ease-out",
        }}
      >
        {/* Photo column (left) — full height, edge-to-edge */}
        <div
          style={{
            position: "relative",
            width: PHOTO_W,
            flexShrink: 0,
            overflow: "hidden",
            backgroundColor: "rgba(255, 255, 255, 0.03)",
          }}
        >
          {guard ? (
            <GuardPhotoBlock
              name={guard.full_name}
              photoUrl={photoUrls[guard.id] ?? null}
            />
          ) : (
            <EmptyPhoto />
          )}
          {extra > 0 ? (
            <span
              className="tabular"
              title={`${extra} more guard${extra === 1 ? "" : "s"} on this position`}
              style={{
                position: "absolute",
                top: 6,
                left: 6,
                fontSize: 10,
                fontWeight: 700,
                padding: "2px 6px",
                borderRadius: 999,
                color: "#080b12",
                backgroundColor: "rgba(245, 158, 11, 0.92)",
              }}
            >
              +{extra}
            </span>
          ) : null}
        </div>

        {/* Info column (right) */}
        <div
          style={{
            flex: 1,
            minWidth: 0,
            padding: 14,
            display: "flex",
            flexDirection: "column",
            gap: 3,
          }}
        >
          {guard ? (
            <>
              <div
                style={{
                  fontSize: 15,
                  fontWeight: 500,
                  color: "#f5f5f7",
                  letterSpacing: "-0.01em",
                  whiteSpace: "nowrap",
                  overflow: "hidden",
                  textOverflow: "ellipsis",
                }}
              >
                {guard.full_name}
              </div>
              <div
                style={{
                  fontSize: 11,
                  color: "rgba(245, 245, 247, 0.55)",
                  whiteSpace: "nowrap",
                  overflow: "hidden",
                  textOverflow: "ellipsis",
                }}
              >
                {node.label}
              </div>
              {showExpiry ? (
                <span
                  style={{
                    alignSelf: "flex-start",
                    fontSize: 10,
                    fontWeight: 600,
                    padding: "1px 6px",
                    borderRadius: 4,
                    color: ALERT_ACCENT[expiryStatus].fg,
                    backgroundColor: ALERT_ACCENT[expiryStatus].bg,
                    border: `1px solid ${ALERT_ACCENT[expiryStatus].border}`,
                  }}
                >
                  {days! < 0 ? "License expired" : `Expires in ${days}d`}
                </span>
              ) : (
                <div
                  className="tabular"
                  style={{
                    fontSize: 11,
                    color: "rgba(245, 245, 247, 0.45)",
                    whiteSpace: "nowrap",
                    overflow: "hidden",
                    textOverflow: "ellipsis",
                  }}
                >
                  {guard.license_no ?? "No license"}
                </div>
              )}
              <div style={{ marginTop: "auto", paddingTop: 4 }}>
                <GuardStatusBadge status={guard.status} />
              </div>
            </>
          ) : (
            <>
              <div
                style={{
                  fontSize: 13,
                  fontWeight: 500,
                  color: "#f5f5f7",
                  letterSpacing: "-0.01em",
                  whiteSpace: "nowrap",
                  overflow: "hidden",
                  textOverflow: "ellipsis",
                }}
              >
                {node.label}
              </div>
              <div
                style={{
                  fontSize: 11,
                  color: "rgba(245, 245, 247, 0.35)",
                  lineHeight: 1.4,
                }}
              >
                Drop a guard here, or click to assign
              </div>
            </>
          )}
        </div>

        {/* Manually-positioned indicator — top-right corner. Hidden while the
            tile is active because the delete button takes that corner. */}
        {positioned && !active ? (
          <span
            title="Manually positioned"
            aria-hidden
            style={{
              position: "absolute",
              top: 8,
              right: 8,
              width: 8,
              height: 8,
              borderRadius: "50%",
              backgroundColor: "#d4b670",
              boxShadow: "0 0 0 2px rgba(8, 11, 18, 0.6)",
            }}
          />
        ) : null}
      </div>

      {/* Quick-action affordances — fade in on hover/focus. They stop their own
          pointer/click events so they never start a drag or open the modal. */}
      <TileActionButton
        active={active}
        disabled={busy}
        danger
        ariaLabel="Delete position"
        onClick={() => onDelete(node)}
        style={{ top: -10, right: -10 }}
      >
        ×
      </TileActionButton>
      <TileActionButton
        active={active}
        disabled={busy}
        ariaLabel="Add sibling position"
        onClick={() => onAddSibling(node)}
        style={{ top: "50%", right: -12, transform: "translateY(-50%)" }}
      >
        +
      </TileActionButton>
      <TileActionButton
        active={active}
        disabled={busy}
        ariaLabel="Add child position"
        onClick={() => onAddChild(node)}
        style={{ bottom: -12, left: "50%", transform: "translateX(-50%)" }}
      >
        +
      </TileActionButton>
    </div>
  );
}

// Small circular hover button anchored to a tile edge. `active` controls the
// fade (opacity + pointer-events) so the buttons only intercept clicks once the
// tile is hovered/focused. Keyboard focus still reaches them (focus ignores
// pointer-events), which flips the parent tile to active via focus bubbling.
function TileActionButton({
  active,
  disabled,
  danger,
  ariaLabel,
  onClick,
  style,
  children,
}: {
  active: boolean;
  disabled: boolean;
  danger?: boolean;
  ariaLabel: string;
  onClick: () => void;
  style: CSSProperties;
  children: ReactNode;
}) {
  const [hover, setHover] = useState(false);
  return (
    <button
      type="button"
      aria-label={ariaLabel}
      title={ariaLabel}
      disabled={disabled}
      onPointerDown={(e) => e.stopPropagation()}
      onClick={(e) => {
        e.stopPropagation();
        if (!disabled) onClick();
      }}
      onMouseEnter={() => setHover(true)}
      onMouseLeave={() => setHover(false)}
      style={{
        position: "absolute",
        width: 24,
        height: 24,
        display: "inline-flex",
        alignItems: "center",
        justifyContent: "center",
        borderRadius: "50%",
        padding: 0,
        lineHeight: 1,
        fontSize: 16,
        fontWeight: 600,
        fontFamily: "inherit",
        cursor: disabled ? "not-allowed" : "pointer",
        background: danger
          ? hover
            ? "rgba(239, 68, 68, 0.92)"
            : "rgba(8, 11, 18, 0.92)"
          : hover
            ? "rgba(201, 169, 97, 0.18)"
            : "rgba(8, 11, 18, 0.92)",
        border: `1px solid ${
          danger
            ? hover
              ? "rgba(239, 68, 68, 0.9)"
              : "rgba(255, 255, 255, 0.18)"
            : hover
              ? "rgba(201, 169, 97, 0.55)"
              : "rgba(255, 255, 255, 0.18)"
        }`,
        color: danger
          ? hover
            ? "#ffffff"
            : "rgba(239, 68, 68, 0.9)"
          : hover
            ? "#d4b670"
            : "rgba(245, 245, 247, 0.85)",
        boxShadow: "0 2px 8px rgba(0, 0, 0, 0.45)",
        opacity: active ? (disabled ? 0.5 : 1) : 0,
        pointerEvents: active ? "auto" : "none",
        transition:
          "opacity 150ms ease-out, color 150ms ease-out, background-color 150ms ease-out, border-color 150ms ease-out",
        ...style,
      }}
    >
      {children}
    </button>
  );
}

function EmptyPhoto() {
  return (
    <div
      aria-hidden
      style={{
        width: "100%",
        height: "100%",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        background:
          "linear-gradient(135deg, rgba(255, 255, 255, 0.05), rgba(255, 255, 255, 0.015))",
        color: "rgba(245, 245, 247, 0.18)",
      }}
    >
      {/* user-plus */}
      <svg
        width="38"
        height="38"
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        strokeWidth="1.5"
        strokeLinecap="round"
        strokeLinejoin="round"
      >
        <path d="M14 19c0-3.3-2.7-5-6-5s-6 1.7-6 5" />
        <circle cx="8" cy="8" r="4" />
        <line x1="19" y1="8" x2="19" y2="14" />
        <line x1="16" y1="11" x2="22" y2="11" />
      </svg>
    </div>
  );
}

function GuardChip({
  guard,
  photoUrl,
  onOpen,
}: {
  guard: Guard;
  photoUrl: string | null;
  onOpen: () => void;
}) {
  const { attributes, listeners, setNodeRef, isDragging } = useDraggable({
    id: `${GUARD_PREFIX}${guard.id}`,
  });
  return (
    <div
      ref={setNodeRef}
      {...attributes}
      {...listeners}
      onClick={onOpen}
      title={`${guard.full_name} — drag to assign, click to edit`}
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
