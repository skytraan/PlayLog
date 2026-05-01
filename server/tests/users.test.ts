import { beforeEach, describe, expect, test, vi } from "vitest";

vi.mock("../src/db/client.js", () => import("./helpers/sql-mock.js"));

import { queueRows, resetSqlMock } from "./helpers/sql-mock.js";
import { users } from "../src/routes/users.js";

beforeEach(() => resetSqlMock());

async function post(path: string, body: unknown) {
  return users.request(path, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
}

describe("createUser", () => {
  test("happy path — inserts new user and returns id", async () => {
    queueRows([]); // no existing user with that email
    queueRows([{ id: "user-123" }]); // INSERT RETURNING id

    const res = await post("/createUser", {
      name: "Alice",
      email: "alice@example.com",
      sports: ["tennis"],
    });

    expect(res.status).toBe(200);
    expect(await res.json()).toBe("user-123");
  });

  test("returns existing id when email already registered", async () => {
    queueRows([{ id: "existing-user" }]); // SELECT finds existing

    const res = await post("/createUser", {
      name: "Alice",
      email: "alice@example.com",
      sports: ["tennis"],
    });

    expect(res.status).toBe(200);
    expect(await res.json()).toBe("existing-user");
  });

  test("validation failure — 400 when email has no @", async () => {
    const res = await post("/createUser", {
      name: "Alice",
      email: "not-an-email",
      sports: ["tennis"],
    });

    expect(res.status).toBe(400);
    const body = await res.json() as { error: string };
    expect(body.error).toMatch(/email/i);
  });
});

describe("getUser", () => {
  test("not-found — 404 for unknown userId", async () => {
    queueRows([]); // SELECT returns no rows

    const res = await post("/getUser", { userId: "nonexistent" });

    expect(res.status).toBe(404);
  });
});

describe("findUser", () => {
  test("returns null (not 404) when user does not exist", async () => {
    queueRows([]);

    const res = await post("/findUser", { userId: "nonexistent" });

    expect(res.status).toBe(200);
    expect(await res.json()).toBeNull();
  });
});
