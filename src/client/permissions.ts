/**
 * Presentation-only capability vocabulary for the UI.
 *
 * The server (src/server/permissions.ts) is the single source of authorization:
 * it decides the grants and surfaces a read-only capability list on the session
 * payload. These constants exist only so UI components can reference capability
 * names without string typos. They grant NOTHING — a control hidden here is
 * still enforced (or refused) by the server. Keep these values in sync with
 * `CAP` in src/server/permissions.ts.
 */
export const CAPS = {
  settingsUpdate: "settings:update",
  reconcileManage: "reconcile:manage",
  usersRead: "users:read",
  usersCreate: "users:create",
  usersUpdate: "users:update",
  usersAssign: "users:assign",
  usersAssignOwner: "users:assign-owner",
  usersDelete: "users:delete",
  auditRead: "audit:read",
  exportRentLedger: "export:rent-ledger",
  rentChargesUpdateSensitive: "rent-charges:update-sensitive",
  rentChargesWaive: "rent-charges:waive",
  paymentsDelete: "payments:delete",
} as const;

export type CapabilityName = (typeof CAPS)[keyof typeof CAPS];