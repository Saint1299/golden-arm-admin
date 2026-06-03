// Hand-written mirror of the deployed Supabase schema (project
// yxtzqlxjjxwswkuixrdx). Matches the accounting app's types/database.ts
// convention. No `updated_at` columns exist on these tables.

export type ClientType = "single_post" | "pooled";

export type Client = {
  id: string;
  name: string;
  type: ClientType;
  industry: string | null;
  conglomerate: string | null;
  created_at: string;
};

export type OrgNode = {
  id: string;
  client_id: string;
  parent_node_id: string | null;
  label: string;
  level: number;
  sort_order: number;
  created_at: string;
};

export type GuardStatus = "active" | "reliever" | "on_leave" | "inactive";

export type Guard = {
  id: string;
  // Nullable as of migration 0009 — a guard can exist before being assigned
  // to a client ("Unassigned" on the deployment board).
  client_id: string | null;
  org_node_id: string | null;
  // Auto-derived from the name parts on save (see deriveFullName). Kept as a
  // stored column so existing reads/search/sorts that key on full_name still
  // work without joining the parts.
  full_name: string;
  // Personal info (migration 0009)
  first_name: string | null;
  middle_name: string | null;
  last_name: string | null;
  birthdate: string | null;
  birth_place: string | null;
  address: string | null;
  educational_attainment: string | null;
  // Employment
  id_number: string | null;
  employee_no: string | null;
  deployment_location: string | null;
  // License — sosia_license was renamed to license_no in migration 0009.
  license_category: string | null;
  license_no: string | null;
  license_expiry: string | null;
  // Contact
  contact_no: string | null;
  emergency_contact_no: string | null;
  // Government IDs (free text — formats vary)
  sss: string | null;
  philhealth: string | null;
  pagibig: string | null;
  tin: string | null;
  date_deployed: string | null;
  status: GuardStatus;
  notes: string | null;
  created_at: string;
};

// Server-side derivation of full_name from the three name parts. Concatenates,
// collapses whitespace, and trims. Falls back to whatever the caller typed in
// `fallback` (e.g. a raw full-name string from a CSV) when no parts are given.
export function deriveFullName(
  first: string | null | undefined,
  middle: string | null | undefined,
  last: string | null | undefined,
  fallback?: string | null,
): string {
  const joined = [first, middle, last]
    .map((p) => (p ?? "").trim())
    .filter(Boolean)
    .join(" ")
    .replace(/\s+/g, " ")
    .trim();
  if (joined) return joined;
  return (fallback ?? "").replace(/\s+/g, " ").trim();
}

export const CLIENT_TYPE_LABEL: Record<ClientType, string> = {
  single_post: "Single Post",
  pooled: "Pooled",
};

export const GUARD_STATUS_LABEL: Record<GuardStatus, string> = {
  active: "Active",
  reliever: "Reliever",
  on_leave: "On Leave",
  inactive: "Inactive",
};

export type InventoryCategory =
  | "uniform"
  | "firearm"
  | "detector"
  | "radio"
  | "flashlight"
  | "baton"
  | "vehicle"
  | "other";

export type InventoryStatus = "available" | "issued" | "maintenance" | "retired";

export type InventoryItem = {
  id: string;
  name: string;
  // Legacy enum column — kept nullable-in-spirit for backward compat. New
  // writes go through item_type_id; reads fall back to this label when an
  // older row has no item_type_id.
  category: InventoryCategory;
  serial_no: string | null;
  status: InventoryStatus;
  notes: string | null;
  created_at: string;
  item_type_id: string | null;
  asset_code: string | null;
  date_acquired: string | null;
};

export type ItemCategory = {
  id: string;
  code: string;
  name: string;
  description: string | null;
  sort_order: number;
  created_at: string;
};

export type ItemType = {
  id: string;
  category_id: string;
  code: string;
  name: string;
  description: string | null;
  sort_order: number;
  created_at: string;
};

export type GuardInventoryEntry = {
  id: string;
  guard_id: string;
  item_id: string;
  issued_date: string;
  returned_date: string | null;
  notes: string | null;
  created_at: string;
};

export const INVENTORY_CATEGORY_LABEL: Record<InventoryCategory, string> = {
  uniform: "Uniform",
  firearm: "Firearm",
  detector: "Detector",
  radio: "Radio",
  flashlight: "Flashlight",
  baton: "Baton",
  vehicle: "Vehicle",
  other: "Other",
};

export const INVENTORY_STATUS_LABEL: Record<InventoryStatus, string> = {
  available: "Available",
  issued: "Issued",
  maintenance: "Maintenance",
  retired: "Retired",
};

export const INVENTORY_CATEGORY_VALUES: InventoryCategory[] = [
  "uniform",
  "firearm",
  "detector",
  "radio",
  "flashlight",
  "baton",
  "vehicle",
  "other",
];

export const INVENTORY_STATUS_VALUES: InventoryStatus[] = [
  "available",
  "issued",
  "maintenance",
  "retired",
];

export type DocumentScope = "guard" | "client" | "company";

// View column type — exposed as text by the view, narrowed on read. As of
// migration 0004 the view returns "ok" for null-expiry docs (treated as
// "Valid"); there is no longer a separate "no_expiry" status.
export type AlertStatus = "expired" | "due_soon" | "ok";

export type ApiDocument = {
  id: string;
  scope: DocumentScope;
  guard_id: string | null;
  // Free-text client name for client-scope docs (migration 0008 replaced the
  // client_id FK). Non-empty when scope=client, null otherwise.
  client_name_text: string | null;
  // Free-text issuing body (e.g. SOSIA, NBI). Optional on any scope — lets
  // admin/HR know where to renew.
  issuing_agency: string | null;
  doc_type: string;
  doc_number: string | null;
  issue_date: string | null;
  expiry_date: string | null;
  file_url: string | null;
  notes: string | null;
  created_at: string;
};

export type ComplianceBoardRow = {
  id: string;
  scope: DocumentScope;
  doc_type: string;
  doc_number: string | null;
  expiry_date: string | null;
  days_remaining: number | null;
  alert_status: AlertStatus | null;
  guard_name: string | null;
  // Exposed by the compliance_board view: client_name_text for client scope,
  // guard's client name for guard scope, NULL for company scope.
  client_name: string | null;
  // Exposed by the view straight from documents.issuing_agency.
  issuing_agency: string | null;
  // Not exposed by the compliance_board view (which carries only the
  // computed columns). The page/refetch joins it in from the underlying
  // documents table so the board card can show its file action.
  file_url: string | null;
};

export const DOCUMENT_SCOPE_LABEL: Record<DocumentScope, string> = {
  guard: "Guard",
  client: "Client",
  company: "Company",
};

export const ALERT_STATUS_LABEL: Record<AlertStatus, string> = {
  expired: "Expired",
  due_soon: "Due Soon",
  ok: "Valid",
};

export const DOCUMENT_SCOPE_VALUES: DocumentScope[] = ["guard", "client", "company"];

export const DOC_TYPE_SUGGESTIONS: string[] = [
  "SOSIA License",
  "NBI Clearance",
  "Drug Test",
  "Neuro Test",
  "Police Clearance",
  "Firearms LTOPF",
  "Contract",
  "PADPAO Bond",
  "DOLE Permit",
  "BIR Registration",
  "Business Permit",
];

// Common issuing bodies for PH security-agency compliance docs. Surfaced as a
// datalist on the document form's Issuing Agency field — suggestions only, the
// field stays free text.
export const ISSUING_AGENCY_SUGGESTIONS: string[] = [
  "SOSIA",
  "NBI",
  "PNP",
  "DOLE",
  "PADPAO",
  "BIR",
  "LTO",
  "Pag-IBIG",
  "PhilHealth",
  "SSS",
];
