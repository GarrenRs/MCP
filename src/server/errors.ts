// Stable machine-readable error codes for API responses.
//
// Contract: every error response keeps the legacy `{ error: "<message>" }`
// shape for compatibility AND gains a stable `code` that the client can map to
// a localized message. Clients that only read `error` keep working unchanged.

export type ApiErrorBody = {
  error: string;
  code: string;
};

export const ErrorCode = {
  invalid_id: "invalid_id",
  not_found: "not_found",
  validation: "validation",
  invalid_json: "invalid_json",
  no_fields: "no_fields",
  invalid_body: "invalid_body",
  period_required: "period_required",
  charge_not_found: "charge_not_found",
} as const;

/** Build an error body carrying both the legacy message and the stable code. */
export function err(code: string, message: string): ApiErrorBody {
  return { error: message, code };
}