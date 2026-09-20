import { useState } from "react";
import { api, ApiError } from "@/api";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { t } from "@/i18n";

interface SessionUser {
  id: number;
  email: string;
  role: string;
  display_name: string;
}

export function LoginPage({ onLogin }: { onLogin: (user: SessionUser) => void }) {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setSaving(true);
    try {
      const res = await api<{ user: SessionUser }>("POST", "/api/auth/login", { email, password });
      onLogin(res.user);
    } catch (err) {
      if (err instanceof ApiError && err.status === 401) {
        setError(t("auth.invalid_credentials"));
      } else {
        setError((err as Error).message);
      }
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="flex min-h-screen items-center justify-center bg-background p-4">
      <Card className="w-full max-w-sm p-6">
        <div className="mb-6 text-center">
          <h1 className="text-lg font-semibold">{t("auth.login_title")}</h1>
          <p className="mt-1 text-sm text-muted-foreground">{t("auth.login_desc")}</p>
        </div>
        <form onSubmit={handleSubmit} className="grid gap-4">
          <div>
            <Label htmlFor="email">{t("auth.email")}</Label>
            <Input
              id="email"
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              required
              autoComplete="email"
              autoFocus
            />
          </div>
          <div>
            <Label htmlFor="password">{t("auth.password")}</Label>
            <Input
              id="password"
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required
              autoComplete="current-password"
            />
          </div>
          {error && (
            <p className="text-sm text-destructive">{error}</p>
          )}
          <Button type="submit" disabled={saving || !email || !password}>
            {saving ? t("common.loading") : t("auth.login")}
          </Button>
        </form>
      </Card>
    </div>
  );
}
