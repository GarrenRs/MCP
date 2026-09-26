/**
 * Centralized permission model — V1.
 *
 * Source of truth: Docs/execution/governance/permission-model-gate-2026-09-26.md
 * (Permission Model Gate, READY FOR IMPLEMENTATION) plus the Product Owner
 * Decision Register (D1–D3).
 *
 * Model: Role → Domain → Resource → Action → Permission → Data Scope.
 * The decision tables in this module are the SINGLE source of role rules: route
 * handlers must not inline their own role comparisons. The capability
 * vocabulary maps 1:1 to the gate matrix rows that vary by role. The base
 * operational plane (rows 1–39 plus operational exports 50–51) is uniformly
 * ALLOW for the three V1 roles, so it does not need role checks — session
 * presence alone grants it, exactly as before this gate.
 *
 * No Finance role is introduced. The manager boundary (D1–D3) is exactly the
 * restricted surface below: sensitive charge edits/waives, payment deletion,
 * financial (rent-ledger) export, settings update, reconcile, user management,
 * and audit read. Data scope is instance/global in V1 (§13) — no per-record
 * scoping exists.
 */

import type { SessionUser } from "./auth";

export type RoleName = "manager" | "admin" | "owner";

/**
 * Capability identifiers — the grant vocabulary of the gate matrix. These
 * strings are also surfaced read-only to the UI for presentation gating (never
 * enforcement); the server-side grants below remain authoritative.
 */
export const CAP = {
  settingsUpdate: "settings:update", // gate row 41
  reconcileManage: "reconcile:manage", // gate row 42
  usersRead: "users:read", // gate row 43
  usersCreate: "users:create", // gate row 44
  usersUpdate: "users:update", // gate row 45
  usersAssign: "users:assign", // gate row 46 (non-owner assignment)
  usersAssignOwner: "users:assign-owner", // gate row 46 owner-principal surface
  usersDelete: "users:delete", // gate row 47
  auditRead: "audit:read", // gate row 48
  exportRentLedger: "export:rent-ledger", // gate row 49
  rentChargesUpdateSensitive: "rent-charges:update-sensitive", // gate row 21
  rentChargesWaive: "rent-charges:waive", // gate row 22
  paymentsDelete: "payments:delete", // gate row 26
} as const;

export type Capability = (typeof CAP)[keyof typeof CAP];

/** Manager: the full day-to-day operational plane, with no restricted surface. */
const MANAGER_GRANTS: readonly Capability[] = [];

/** Admin: Manager plane + the administrative layer + D1 sensitive financials. */
const ADMIN_GRANTS: readonly Capability[] = [
  CAP.settingsUpdate,
  CAP.reconcileManage,
  CAP.usersRead,
  CAP.usersCreate,
  CAP.usersUpdate,
  CAP.usersAssign,
  CAP.auditRead,
  CAP.exportRentLedger,
  CAP.rentChargesUpdateSensitive,
  CAP.rentChargesWaive,
  CAP.paymentsDelete,
];

/** Owner: Admin plane + Principal posture (D3) — user deletion, owner-role assignment. */
const OWNER_GRANTS: readonly Capability[] = [
  ...ADMIN_GRANTS,
  CAP.usersAssignOwner,
  CAP.usersDelete,
];

const ROLE_GRANTS: Record<RoleName, ReadonlySet<Capability>> = {
  manager: new Set(MANAGER_GRANTS),
  admin: new Set(ADMIN_GRANTS),
  owner: new Set(OWNER_GRANTS),
};

/**
 * Does this user hold the capability? Denies null, unknown roles, and Manager
 * wherever the gate says DENY. The base operational plane is not enumerated
 * here — it is granted by session presence (all three roles), per the matrix.
 */
export function can(user: SessionUser | null, capability: Capability): boolean {
  if (!user) return false;
  const grants = ROLE_GRANTS[user.role as RoleName];
  return grants?.has(capability) ?? false;
}

/**
 * The read-only capability list surfaced to the UI for presentation gating
 * (gate §17: "surface a read-only capability view to the UI for presentation
 * (never enforcement)"). Empty for unknown/unsupported roles.
 */
export function capabilitiesForRole(role: string): Capability[] {
  const grants = ROLE_GRANTS[role as RoleName];
  return grants ? [...grants].sort() : [];
}

/** Owner-principal posture (D3, gate §8): the caller is the Owner. */
export function isOwnerRole(user: SessionUser | null): boolean {
  return user?.role === "owner";
}

/**
 * Sensitive charge-edit boundary (gate §11 #2): a rent-charge patch touching
 * `amount`, `due_date`, or `status` (including any status transition) is a
 * sensitive edit. Notes-only patches are routine (gate row 20, ALLOW all).
 * The boundary is deliberately not broadened beyond these three fields.
 */
export function isSensitiveChargePatch(patch: {
  amount?: unknown;
  due_date?: unknown;
  status?: unknown;
}): boolean {
  return patch.amount !== undefined || patch.due_date !== undefined || patch.status !== undefined;
}

/** Gate row 44 — Owner may create any account; Admin only manager/admin. */
export function mayCreateUser(caller: SessionUser | null, role: string): boolean {
  if (!caller) return false;
  return role !== "owner" || isOwnerRole(caller);
}

/** Gate row 45 — only an Owner may modify an owner account. */
export function mayModifyOwnerAccount(caller: SessionUser | null, targetRole: string): boolean {
  if (!caller) return false;
  return targetRole !== "owner" || isOwnerRole(caller);
}

/** Gate row 46 — only an Owner may assign the owner role. */
export function mayAssignOwnerRole(caller: SessionUser | null, requestedRole?: string): boolean {
  if (!caller) return false;
  return requestedRole !== "owner" || isOwnerRole(caller);
}