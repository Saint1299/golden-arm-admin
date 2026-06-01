"use client";

import { useState } from "react";
import { Modal } from "@/components/ui/Modal";
import {
  CancelButton,
  Field,
  FormError,
  GoldButton,
  TextInput,
} from "@/components/ui/form";
import { useToast } from "@/components/ui/Toast";
import { createClient as createSupabaseClient } from "@/lib/supabase/client";
import type { Region } from "@/types/database";

export function RegionManagerModal({
  regions,
  onClose,
  onChanged,
}: {
  regions: Region[];
  onClose: () => void;
  onChanged: () => void;
}) {
  const [newName, setNewName] = useState("");
  const [adding, setAdding] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editingName, setEditingName] = useState("");
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const { showToast } = useToast();

  async function handleAdd(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const name = newName.trim();
    if (!name) {
      setErrorMessage("Region name is required");
      return;
    }
    setAdding(true);
    setErrorMessage(null);
    const supabase = createSupabaseClient();
    const { error } = await supabase.from("regions").insert({ name });
    setAdding(false);
    if (error) {
      setErrorMessage(error.message);
      showToast(error.message, "error");
      return;
    }
    setNewName("");
    showToast("Region added", "success");
    onChanged();
  }

  function startEdit(region: Region) {
    setEditingId(region.id);
    setEditingName(region.name);
    setErrorMessage(null);
  }

  async function saveEdit(region: Region) {
    const name = editingName.trim();
    if (!name) {
      setErrorMessage("Region name is required");
      return;
    }
    const supabase = createSupabaseClient();
    const { error } = await supabase
      .from("regions")
      .update({ name })
      .eq("id", region.id);
    if (error) {
      setErrorMessage(error.message);
      showToast(error.message, "error");
      return;
    }
    setEditingId(null);
    showToast("Region updated", "success");
    onChanged();
  }

  async function handleDelete(region: Region) {
    const ok = window.confirm(
      `Delete region "${region.name}"? Regions with clients cannot be deleted until their clients are reassigned or removed.`,
    );
    if (!ok) return;
    const supabase = createSupabaseClient();
    const { error } = await supabase
      .from("regions")
      .delete()
      .eq("id", region.id);
    if (error) {
      setErrorMessage(error.message);
      showToast(error.message, "error");
      return;
    }
    showToast("Region deleted", "success");
    onChanged();
  }

  return (
    <Modal title="Manage regions" onClose={onClose}>
      <form onSubmit={handleAdd}>
        <Field label="New region">
          <div style={{ display: "flex", gap: 8 }}>
            <div style={{ flex: 1 }}>
              <TextInput
                value={newName}
                onChange={setNewName}
                placeholder="e.g. Metro Manila"
                disabled={adding}
              />
            </div>
            <GoldButton type="submit" disabled={adding} fullWidth={false}>
              {adding ? "Adding…" : "Add"}
            </GoldButton>
          </div>
        </Field>
      </form>

      <div
        style={{
          marginTop: 8,
          borderTop: "1px solid rgba(255, 255, 255, 0.08)",
          paddingTop: 16,
        }}
      >
        {regions.length === 0 ? (
          <p
            style={{
              fontSize: 13,
              color: "rgba(245, 245, 247, 0.45)",
              margin: 0,
            }}
          >
            No regions yet.
          </p>
        ) : (
          <div style={{ display: "flex", flexDirection: "column", gap: 4 }}>
            {regions.map((region) => (
              <div
                key={region.id}
                style={{
                  display: "flex",
                  alignItems: "center",
                  gap: 8,
                  padding: "8px 0",
                  borderBottom: "1px solid rgba(255, 255, 255, 0.04)",
                }}
              >
                {editingId === region.id ? (
                  <>
                    <div style={{ flex: 1 }}>
                      <TextInput
                        value={editingName}
                        onChange={setEditingName}
                        autoFocus
                      />
                    </div>
                    <RowAction label="Save" onClick={() => saveEdit(region)} />
                    <RowAction
                      label="Cancel"
                      onClick={() => setEditingId(null)}
                    />
                  </>
                ) : (
                  <>
                    <span
                      style={{ flex: 1, fontSize: 14, color: "#f5f5f7" }}
                    >
                      {region.name}
                    </span>
                    <RowAction label="Edit" onClick={() => startEdit(region)} />
                    <RowAction
                      label="Delete"
                      danger
                      onClick={() => handleDelete(region)}
                    />
                  </>
                )}
              </div>
            ))}
          </div>
        )}
      </div>

      <FormError message={errorMessage} />

      <div
        style={{
          height: 1,
          margin: "20px 0 12px",
          backgroundColor: "rgba(255, 255, 255, 0.06)",
        }}
      />
      <div style={{ display: "flex", justifyContent: "center" }}>
        <CancelButton onClick={onClose}>Done</CancelButton>
      </div>
    </Modal>
  );
}

function RowAction({
  label,
  onClick,
  danger,
}: {
  label: string;
  onClick: () => void;
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
      onMouseEnter={() => setHover(true)}
      onMouseLeave={() => setHover(false)}
      style={{
        background: "transparent",
        border: "none",
        padding: "2px 4px",
        fontSize: 12,
        fontWeight: 500,
        fontFamily: "inherit",
        cursor: "pointer",
        color,
        transition: "color 150ms ease-out",
      }}
    >
      {label}
    </button>
  );
}
