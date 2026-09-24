import { useEffect, useState } from "react";
import { Pencil, Plus, Trash2, Users } from "lucide-react";
import { api, ApiError } from "@/api";
import { cn } from "@/lib/utils";
import { EmptyState } from "@/components/empty-state";
import { Button } from "@/components/ui/button";
import { ConfirmDelete } from "@/components/ui/alert-dialog";
import { Card } from "@/components/ui/card";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { t } from "@/i18n";

interface UserRecord {
  id: number;
  email: string;
  display_name: string;
  role: string;
  created_at: string;
}

const ROLE_TONE: Record<string, string> = {
  owner: "tone-warning",
  admin: "tone-info",
  manager: "tone-neutral",
};

export function UsersTab({ currentUserRole }: { currentUserRole: string }) {
  const [users, setUsers] = useState<UserRecord[]>([]);
  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState<UserRecord | undefined>(undefined);
  const [loading, setLoading] = useState(true);

  const loadUsers = async () => {
    try {
      const res = await api<{ users: UserRecord[] }>("GET", "/api/users");
      setUsers(res.users);
    } catch {
      /* silently fail if not authorized */
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { loadUsers(); }, []);

  const canManage = currentUserRole === "owner" || currentUserRole === "admin";

  if (!canManage) return null;

  return (
    <Card>
      <div className="flex items-center justify-between border-b p-4">
        <div>
          <h2 className="text-sm font-semibold">{t("auth.users")}</h2>
          <p className="text-xs text-muted-foreground">{t("auth.users_desc")}</p>
        </div>
        <Button size="sm" onClick={() => { setEditing(undefined); setOpen(true); }}>
          <Plus className="me-1 h-4 w-4" /> {t("auth.add_user")}
        </Button>
      </div>
      {loading ? (
        <Card className="p-8 text-center text-sm text-muted-foreground">{t("common.loading")}</Card>
      ) : users.length === 0 ? (
        <EmptyState icon={<Users className="size-8" />} title={t("auth.no_users")} />
      ) : (
        <ul className="divide-y">
          {users.map((u) => (
            <li key={u.id} className="flex items-center justify-between gap-3 p-4">
              <div>
                <div className="font-medium">{u.display_name}</div>
                <div className="text-xs text-muted-foreground">{u.email}</div>
              </div>
              <div className="flex items-center gap-2">
                <span className={cn("badge-tone", ROLE_TONE[u.role] ?? "tone-neutral")}>{t(`auth.role_${u.role}`)}</span>
                {canManage && (
                  <Button size="icon" variant="ghost" onClick={() => { setEditing(u); setOpen(true); }}>
                    <Pencil className="h-4 w-4" />
                  </Button>
                )}
              </div>
            </li>
          ))}
        </ul>
      )}
      <UserDialog
        open={open}
        onOpenChange={setOpen}
        user={editing}
        currentUserRole={currentUserRole}
        onSaved={loadUsers}
      />
    </Card>
  );
}

function UserDialog({
  open, onOpenChange, user, currentUserRole, onSaved,
}: {
  open: boolean;
  onOpenChange: (o: boolean) => void;
  user?: UserRecord;
  currentUserRole: string;
  onSaved: () => void;
}) {
  const [email, setEmail] = useState("");
  const [displayName, setDisplayName] = useState("");
  const [password, setPassword] = useState("");
  const [role, setRole] = useState<string>("manager");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [confirming, setConfirming] = useState(false);

  useEffect(() => {
    if (!open) return;
    setEmail(user?.email ?? "");
    setDisplayName(user?.display_name ?? "");
    setPassword("");
    setRole(user?.role ?? "manager");
    setError(null);
  }, [open, user]);

  const isNew = !user;
  const canAssignOwner = currentUserRole === "owner";
  const availableRoles = canAssignOwner ? ["owner", "admin", "manager"] : ["admin", "manager"];

  async function save() {
    setSaving(true);
    setError(null);
    try {
      if (isNew) {
        await api("POST", "/api/users", {
          email: email.trim(),
          password,
          display_name: displayName.trim(),
          role,
        });
      } else {
        const patch: Record<string, unknown> = {};
        if (displayName.trim() !== user!.display_name) patch.display_name = displayName.trim();
        if (role !== user!.role) patch.role = role;
        if (password) patch.password = password;
        if (Object.keys(patch).length > 0) {
          await api("PUT", `/api/users/${user!.id}`, patch);
        }
      }
      onSaved();
      onOpenChange(false);
    } catch (err) {
      if (err instanceof ApiError) {
        setError(err.message);
      } else {
        setError((err as Error).message);
      }
    } finally {
      setSaving(false);
    }
  }

  async function remove() {
    if (!user) return;
    try {
      await api("DELETE", `/api/users/${user.id}`);
      onSaved();
      onOpenChange(false);
    } catch (err) {
      setError((err as Error).message);
    }
  }

  const canDelete = user && currentUserRole === "owner" && user.role !== "owner";

  return (
    <>
      <Dialog open={open} onOpenChange={onOpenChange}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{isNew ? t("auth.new_user") : t("auth.edit_user")}</DialogTitle>
          </DialogHeader>
          <div className="grid gap-3">
            <div>
              <Label htmlFor="u-name">{t("auth.display_name")}</Label>
              <Input id="u-name" value={displayName} onChange={(e) => setDisplayName(e.target.value)} />
            </div>
            <div>
              <Label htmlFor="u-email">{t("auth.email")}</Label>
              <Input id="u-email" type="email" value={email} onChange={(e) => setEmail(e.target.value)} disabled={!isNew} />
            </div>
            <div>
              <Label htmlFor="u-pass">{t("auth.password")}{!isNew ? ` (${t("users.unchanged")})` : ""}</Label>
              <Input id="u-pass" type="password" value={password} onChange={(e) => setPassword(e.target.value)} placeholder={isNew ? "" : "••••••••"} />
            </div>
            <div>
              <Label>{t("auth.role")}</Label>
              <Select value={role} onValueChange={setRole}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  {availableRoles.map((r) => (
                    <SelectItem key={r} value={r}>{t(`auth.role_${r}`)}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            {error && <p className="text-sm text-destructive">{error}</p>}
          </div>
          <DialogFooter>
            {canDelete && (
              <Button type="button" variant="destructive" className="sm:me-auto" onClick={() => setConfirming(true)}>
                <Trash2 className="me-1 h-4 w-4" /> {t("common.delete")}
              </Button>
            )}
            <Button type="button" variant="ghost" onClick={() => onOpenChange(false)}>{t("common.cancel")}</Button>
            <Button type="button" onClick={save} disabled={saving || !displayName.trim() || !email.trim()}>
              {isNew ? t("common.create") : t("common.save")}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
      {canDelete && user && (
        <ConfirmDelete
          open={confirming}
          onOpenChange={setConfirming}
          title={t("auth.delete_user")}
          description={t("auth.delete_user_desc")}
          onConfirm={remove}
        />
      )}
    </>
  );
}
