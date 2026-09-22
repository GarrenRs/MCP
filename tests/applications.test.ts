import { beforeEach, describe, expect, it } from "vitest";
import { createTestEnv, type TestEnv } from "./helpers/d1";
import { call } from "./helpers/api";
import app from "../src/server/index";
import { resetSeedForTests } from "../src/server/index";

let env: TestEnv;

beforeEach(() => {
  env = createTestEnv();
  resetSeedForTests();
});

async function createApplication(patch: Record<string, unknown> = {}) {
  const res = await call<{ application: { id: number; status: string; first_name: string; last_name: string } }>(
    env, "POST", "/api/applications",
    { first_name: "Amina", last_name: "Belkacem", ...patch },
  );
  return res;
}

async function getApplication(id: number) {
  const res = await call<{ applications: Array<{ id: number; status: string }> }>(env, "GET", "/api/applications");
  const row = res.body.applications.find((a) => a.id === id);
  if (!row) throw new Error(`application ${id} not found`);
  return row;
}

describe("applications CRUD (P10)", () => {
  it("defaults a new application to the new status", async () => {
    const res = await createApplication();
    expect(res.status).toBe(201);
    expect(res.body.application.status).toBe("new");
    expect(res.body.application.first_name).toBe("Amina");
  });

  it("lists, updates, and deletes an application", async () => {
    const created = await createApplication({ phone: "0555000000" });
    const id = created.body.application.id;

    const list = await call<{ applications: Array<{ id: number }> }>(env, "GET", "/api/applications");
    expect(list.status).toBe(200);
    expect(list.body.applications.some((a) => a.id === id)).toBe(true);

    const updated = await call<{ application: { status: string; last_name: string } }>(
      env, "PUT", `/api/applications/${id}`, { status: "screening", last_name: "Belkacem-Amir" },
    );
    expect(updated.status).toBe(200);
    expect(updated.body.application.status).toBe("screening");
    expect(updated.body.application.last_name).toBe("Belkacem-Amir");

    const del = await call(env, "DELETE", `/api/applications/${id}`);
    expect(del.status).toBe(200);

    const after = await call<{ applications: Array<{ id: number }> }>(env, "GET", "/api/applications");
    expect(after.body.applications.some((a) => a.id === id)).toBe(false);
  });

  it("rejects a create without first and last name", async () => {
    const res = await call<{ code?: string }>(env, "POST", "/api/applications", { first_name: "NoLast" });
    expect(res.status).toBe(400);
    expect(res.body.code).toBe("validation");
  });

  it("returns 404 for a nonexistent application", async () => {
    const res = await call<{ code?: string }>(env, "PUT", "/api/applications/99999", { status: "screening" });
    expect(res.status).toBe(404);
    expect(res.body.code).toBe("not_found");
  });

  it("returns 400 no_fields for an empty patch", async () => {
    const created = await createApplication();
    const res = await call<{ code?: string }>(env, "PUT", `/api/applications/${created.body.application.id}`, {});
    expect(res.status).toBe(400);
    expect(res.body.code).toBe("no_fields");
  });

  it("returns 400 invalid_id for a non-numeric id", async () => {
    const res = await call<{ code?: string }>(env, "DELETE", "/api/applications/abc");
    expect(res.status).toBe(400);
    expect(res.body.code).toBe("invalid_id");
  });
});

describe("application status workflow (P10)", () => {
  it("accepts each workflow status as stored", async () => {
    const created = await createApplication();
    const id = created.body.application.id;
    for (const status of ["screening", "approved", "declined", "withdrawn"]) {
      const res = await call<{ application: { status: string } }>(env, "PUT", `/api/applications/${id}`, { status });
      expect(res.status).toBe(200);
      expect(res.body.application.status).toBe(status);
      expect((await getApplication(id)).status).toBe(status);
    }
  });

  it("rejects an unknown status", async () => {
    const res = await call<{ code?: string }>(env, "POST", "/api/applications", {
      first_name: "Sami", last_name: "Khelifi", status: "archived",
    });
    expect(res.status).toBe(400);
    expect(res.body.code).toBe("validation");
  });
});
