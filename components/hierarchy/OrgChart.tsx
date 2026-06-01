"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { NodeBox } from "./NodeBox";
import { NodeFormModal } from "./NodeFormModal";
import { GlassCard } from "@/components/ui/GlassCard";
import { useToast } from "@/components/ui/Toast";
import { createClient as createSupabaseClient } from "@/lib/supabase/client";
import type { Guard, OrgNode } from "@/types/database";

export type TreeNode = OrgNode & { children: TreeNode[] };

// Default chain auto-created for a pooled client that has no nodes yet.
const DEFAULT_CHAIN: Array<{ label: string; level: number }> = [
  { label: "Detachment Commander", level: 0 },
  { label: "Shift In-Charge", level: 1 },
  { label: "Senior Guard", level: 2 },
  { label: "Guard", level: 3 },
];

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

type ModalState =
  | { mode: "add-child"; parent: OrgNode }
  | { mode: "rename"; node: OrgNode }
  | null;

export function OrgChart({
  clientId,
  nodes,
  guards,
  onChanged,
}: {
  clientId: string;
  nodes: OrgNode[];
  guards: Guard[];
  onChanged: () => void | Promise<void>;
}) {
  const [seeding, setSeeding] = useState(false);
  const [busy, setBusy] = useState(false);
  const [modal, setModal] = useState<ModalState>(null);
  const didSeed = useRef(false);
  const { showToast } = useToast();

  const tree = useMemo(() => buildTree(nodes), [nodes]);

  const guardsByNode = useMemo(() => {
    const map = new Map<string, Guard[]>();
    for (const g of guards) {
      if (!g.org_node_id) continue;
      const list = map.get(g.org_node_id) ?? [];
      list.push(g);
      map.set(g.org_node_id, list);
    }
    return map;
  }, [guards]);

  const unassignedGuards = useMemo(
    () => guards.filter((g) => !g.org_node_id),
    [guards],
  );

  // Auto-seed the default chain once when a pooled client has no nodes yet.
  useEffect(() => {
    if (nodes.length > 0 || didSeed.current) return;
    didSeed.current = true;
    void seedDefaultChain();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [nodes.length]);

  async function seedDefaultChain() {
    setSeeding(true);
    const supabase = createSupabaseClient();
    let parentId: string | null = null;
    for (const step of DEFAULT_CHAIN) {
      const { data, error } = await supabase
        .from("org_nodes")
        .insert({
          client_id: clientId,
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
    await onChanged();
    setSeeding(false);
  }

  function siblingsOf(parentId: string | null): OrgNode[] {
    return nodes
      .filter((n) => (n.parent_node_id ?? null) === parentId)
      .sort(sortSiblings);
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
    const sortOrder = siblingsOf(parent.id).length;
    const { error } = await supabase.from("org_nodes").insert({
      client_id: clientId,
      parent_node_id: parent.id,
      label,
      level: parent.level + 1,
      sort_order: sortOrder,
    });
    setBusy(false);
    if (error) {
      showToast(error.message, "error");
      return;
    }
    setModal(null);
    showToast("Position added", "success");
    await onChanged();
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
    await onChanged();
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
    // Unassign every guard in the subtree first so the cascade can't touch
    // guard rows, regardless of the org_node_id FK's delete rule.
    const { error: unassignErr } = await supabase
      .from("guards")
      .update({ org_node_id: null })
      .in("org_node_id", ids);
    if (unassignErr) {
      setBusy(false);
      showToast(unassignErr.message, "error");
      return;
    }
    // Delete the subtree root; DB cascades to descendant nodes.
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
    await onChanged();
  }

  async function handleReorder(node: OrgNode, direction: "up" | "down") {
    const siblings = siblingsOf(node.parent_node_id ?? null);
    const idx = siblings.findIndex((s) => s.id === node.id);
    const swapWith = direction === "up" ? idx - 1 : idx + 1;
    if (swapWith < 0 || swapWith >= siblings.length) return;

    const reordered = [...siblings];
    [reordered[idx], reordered[swapWith]] = [
      reordered[swapWith],
      reordered[idx],
    ];

    setBusy(true);
    const supabase = createSupabaseClient();
    // Rewrite every sibling's sort_order to its new index — simple and avoids
    // duplicate sort_order ambiguity from the seeded all-zero values.
    const results = await Promise.all(
      reordered.map((s, i) =>
        supabase.from("org_nodes").update({ sort_order: i }).eq("id", s.id),
      ),
    );
    setBusy(false);
    const firstErr = results.find((r) => r.error)?.error;
    if (firstErr) {
      showToast(firstErr.message, "error");
      return;
    }
    await onChanged();
  }

  async function handleAssign(nodeId: string, guardId: string) {
    setBusy(true);
    const supabase = createSupabaseClient();
    const { error } = await supabase
      .from("guards")
      .update({ org_node_id: nodeId })
      .eq("id", guardId);
    setBusy(false);
    if (error) {
      showToast(error.message, "error");
      return;
    }
    showToast("Guard assigned", "success");
    await onChanged();
  }

  async function handleUnassign(guardId: string) {
    setBusy(true);
    const supabase = createSupabaseClient();
    const { error } = await supabase
      .from("guards")
      .update({ org_node_id: null })
      .eq("id", guardId);
    setBusy(false);
    if (error) {
      showToast(error.message, "error");
      return;
    }
    showToast("Guard unassigned", "success");
    await onChanged();
  }

  return (
    <div style={{ marginBottom: 24 }}>
      <h2
        style={{
          fontSize: 16,
          fontWeight: 600,
          color: "#f5f5f7",
          letterSpacing: "-0.01em",
          marginBottom: 12,
        }}
      >
        Org chart
      </h2>

      {seeding ? (
        <GlassCard>
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
        </GlassCard>
      ) : nodes.length === 0 ? (
        <GlassCard>
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
              No org chart yet for this pooled client.
            </p>
            <button
              type="button"
              disabled={busy}
              onClick={() => {
                didSeed.current = true;
                void seedDefaultChain();
              }}
              style={{
                background: "rgba(255, 255, 255, 0.04)",
                border: "1px solid rgba(255, 255, 255, 0.12)",
                color: "rgba(245, 245, 247, 0.8)",
                borderRadius: 8,
                padding: "10px 16px",
                fontWeight: 500,
                fontSize: 14,
                fontFamily: "inherit",
                cursor: busy ? "wait" : "pointer",
              }}
            >
              Create default structure
            </button>
          </div>
        </GlassCard>
      ) : (
        <GlassCard style={{ overflow: "hidden" }}>
          <div className="org-tree">
            <ul>
              {tree.map((root) => (
                <TreeBranch
                  key={root.id}
                  node={root}
                  guardsByNode={guardsByNode}
                  unassignedGuards={unassignedGuards}
                  busy={busy}
                  hasSiblings={tree.length > 1}
                  isFirst={tree[0]?.id === root.id}
                  isLast={tree[tree.length - 1]?.id === root.id}
                  onAddChild={(parent) => setModal({ mode: "add-child", parent })}
                  onRename={(n) => setModal({ mode: "rename", node: n })}
                  onDelete={handleDelete}
                  onReorder={handleReorder}
                  onAssign={handleAssign}
                  onUnassign={handleUnassign}
                />
              ))}
            </ul>
          </div>
        </GlassCard>
      )}

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

function TreeBranch({
  node,
  guardsByNode,
  unassignedGuards,
  busy,
  hasSiblings,
  isFirst,
  isLast,
  onAddChild,
  onRename,
  onDelete,
  onReorder,
  onAssign,
  onUnassign,
}: {
  node: TreeNode;
  guardsByNode: Map<string, Guard[]>;
  unassignedGuards: Guard[];
  busy: boolean;
  hasSiblings: boolean;
  isFirst: boolean;
  isLast: boolean;
  onAddChild: (parent: OrgNode) => void;
  onRename: (node: OrgNode) => void;
  onDelete: (node: OrgNode) => void;
  onReorder: (node: OrgNode, dir: "up" | "down") => void;
  onAssign: (nodeId: string, guardId: string) => void;
  onUnassign: (guardId: string) => void;
}) {
  const children = node.children;
  return (
    <li>
      <NodeBox
        node={node}
        assignedGuards={guardsByNode.get(node.id) ?? []}
        unassignedGuards={unassignedGuards}
        busy={busy}
        canMoveUp={hasSiblings && !isFirst}
        canMoveDown={hasSiblings && !isLast}
        onAddChild={() => onAddChild(node)}
        onRename={() => onRename(node)}
        onDelete={() => onDelete(node)}
        onMoveUp={() => onReorder(node, "up")}
        onMoveDown={() => onReorder(node, "down")}
        onAssign={(guardId) => onAssign(node.id, guardId)}
        onUnassign={onUnassign}
      />
      {children.length > 0 ? (
        <ul>
          {children.map((child, i) => (
            <TreeBranch
              key={child.id}
              node={child}
              guardsByNode={guardsByNode}
              unassignedGuards={unassignedGuards}
              busy={busy}
              hasSiblings={children.length > 1}
              isFirst={i === 0}
              isLast={i === children.length - 1}
              onAddChild={onAddChild}
              onRename={onRename}
              onDelete={onDelete}
              onReorder={onReorder}
              onAssign={onAssign}
              onUnassign={onUnassign}
            />
          ))}
        </ul>
      ) : null}
    </li>
  );
}
