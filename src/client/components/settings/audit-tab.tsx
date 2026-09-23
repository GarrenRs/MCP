import { useEffect, useState } from "react";
import { api } from "@/api";
import { Card } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { formatDate } from "@/lib/utils";
import { t } from "@/i18n";

interface AuditRow {
  id: number;
  actor_user_id: number | null;
  actor_name: string | null;
  action: string;
  entity: string;
  record_id: number | null;
  old_value: string | null;
  new_value: string | null;
  created_at: string;
}

function formatChanges(oldValue: string | null, newValue: string | null): string {
  if (!oldValue && !newValue) return t("audit.no_changes");
  let oldObj: Record<string, unknown> | null = null;
  let newObj: Record<string, unknown> | null = null;
  try { oldObj = oldValue ? JSON.parse(oldValue) as Record<string, unknown> : null; } catch { /* ignore */ }
  try { newObj = newValue ? JSON.parse(newValue) as Record<string, unknown> : null; } catch { /* ignore */ }
  const parts: string[] = [];
  if (oldObj && newObj) {
    for (const key of new Set([...Object.keys(oldObj), ...Object.keys(newObj)])) {
      const oldV = oldObj[key];
      const newV = newObj[key];
      if (oldV !== newV) {
        parts.push(`${key}: ${oldV ?? "—"} -> ${newV ?? "—"}`);
      }
    }
    return parts.length ? parts.join(", ") : t("audit.no_changes");
  }
  if (newObj) {
    return Object.entries(newObj).map(([k, v]) => `${k}: ${v ?? "—"}`).join(", ");
  }
  if (oldObj) {
    return Object.entries(oldObj).map(([k, v]) => `${k}: ${v ?? "—"}`).join(", ");
  }
  return t("audit.no_changes");
}

export function AuditTab() {
  const [rows, setRows] = useState<AuditRow[]>([]);
  const [loading, setLoading] = useState(true);

  const load = async () => {
    try {
      const res = await api<AuditRow[]>("GET", "/api/audit?limit=100");
      setRows(res);
    } catch {
      /* silently fail if not authorized */
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { load(); }, []);

  return (
    <Card>
      <div className="border-b p-4">
        <h2 className="text-sm font-semibold">{t("audit.tab")}</h2>
        <p className="text-xs text-muted-foreground">{t("audit.empty")}</p>
      </div>
      {loading ? (
        <div className="p-8 text-center text-sm text-muted-foreground">{t("audit.loading")}</div>
      ) : rows.length === 0 ? (
        <div className="p-8 text-center text-sm text-muted-foreground">{t("audit.empty")}</div>
      ) : (
        <div className="overflow-x-auto">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>{t("audit.col_time")}</TableHead>
                <TableHead>{t("audit.col_actor")}</TableHead>
                <TableHead>{t("audit.col_action")}</TableHead>
                <TableHead>{t("audit.col_entity")}</TableHead>
                <TableHead>{t("audit.col_record")}</TableHead>
                <TableHead>{t("audit.col_changes")}</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {rows.map((r) => (
                <TableRow key={r.id}>
                  <TableCell className="whitespace-nowrap text-sm">{formatDate(r.created_at)}</TableCell>
                  <TableCell className="text-sm">{r.actor_name ?? "—"}</TableCell>
                  <TableCell className="text-sm">{t(`audit.action.${r.action}`)}</TableCell>
                  <TableCell className="text-sm">{t(`audit.entity.${r.entity}`)}</TableCell>
                  <TableCell className="text-sm">{r.record_id ?? "—"}</TableCell>
                  <TableCell className="max-w-xs truncate text-sm text-muted-foreground" title={formatChanges(r.old_value, r.new_value)}>
                    {formatChanges(r.old_value, r.new_value)}
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      )}
    </Card>
  );
}
