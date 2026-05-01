import { beforeEach, describe, expect, test, vi } from "vitest";

vi.mock("../src/db/client.js", () => import("./helpers/sql-mock.js"));

import { queueRows, resetSqlMock } from "./helpers/sql-mock.js";
import { auth } from "../src/routes/auth.js";
import { authHeaders } from "./helpers/auth.js";
import { signToken, verifyToken } from "../src/lib/auth.js";

beforeEach(() => resetSqlMock());

async function post(path: string, body: unknown, headers: Record<string, string> = { "Content-Type": "application/json" }) {
  return auth.request(path, {
    method: "POST",
    headers,
    body: JSON.stringify(body),
  });
}

describe("token round-trip", () => {
  test("signed token verifies back to the same userId", () => {
    const token = signToken("user-42");
    expect(verifyToken(token)).toEqual({ userId: "user-42" });
  });

  test("tampered signature is rejected", () => {
    const [h, p] = signToken("user-42").split(".");
    const tampered = `${h}.${p}.AAAA`;
    expect(() => verifyToken(tampered)).toThrowError(/invalid token/);
  });

  test("expired token is rejected", () => {
    const token = signToken("user-42", -10); // already expired
    expect(() => verifyToken(token)).toThrowError(/expired/);
  });
});

describe("/login", () => {
  test("happy path — returns token + user", async () => {
    queueRows([
      {
        id: "user-1",
        name: "Alice",
        email: "alice@example.com",
        sports: ["tennis"],
        created_at: 1,
      },
    ]);

    const res = await post("/login", { email: "alice@example.com" });
    expect(res.status).toBe(200);
    const body = (await res.json()) as { token: string; user: { _id: string } };
    expect(body.user._id).toBe("user-1");
    expect(verifyToken(body.token)).toEqual({ userId: "user-1" });
  });

  test("404 when no user exists for the email", async () => {
    queueRows([]);
    const res = await post("/login", { email: "ghost@example.com" });
    expect(res.status).toBe(404);
  });

  test("400 when email is malformed", async () => {
    const res = await post("/login", { email: "not-an-email" });
    expect(res.status).toBe(400);
  });
});

describe("/signup", () => {
  test("happy path — inserts new user and returns token", async () => {
    queueRows([]); // no existing user
    queueRows([
      { id: "user-new", name: "Bob", email: "bob@example.com", sports: ["tennis"], created_at: 1 },
    ]);

    const res = await post("/signup", {
      name: "Bob",
      email: "bob@example.com",
      sports: ["tennis"],
    });

    expect(res.status).toBe(200);
    const body = (await res.json()) as { token: string; user: { _id: string } };
    expect(body.user._id).toBe("user-new");
    expect(verifyToken(body.token)).toEqual({ userId: "user-new" });
  });

  test("returns existing user (idempotent) when email already registered", async () => {
    queueRows([
      { id: "user-existing", name: "Alice", email: "alice@example.com", sports: ["tennis"], created_at: 1 },
    ]);

    const res = await post("/signup", {
      name: "Alice 2",
      email: "alice@example.com",
      sports: ["tennis"],
    });

    expect(res.status).toBe(200);
    const body = (await res.json()) as { user: { _id: string } };
    expect(body.user._id).toBe("user-existing");
  });
});

describe("/me", () => {
  test("401 without Authorization header", async () => {
    const res = await post("/me", {});
    expect(res.status).toBe(401);
  });

  test("401 with malformed token", async () => {
    const res = await post(
      "/me",
      {},
      { "Content-Type": "application/json", Authorization: "Bearer not-a-real-token" }
    );
    expect(res.status).toBe(401);
  });

  test("returns the authenticated user", async () => {
    queueRows([
      { id: "test-user-1", name: "Alice", email: "alice@example.com", sports: ["tennis"], created_at: 1 },
    ]);

    const res = await post("/me", {}, authHeaders());
    expect(res.status).toBe(200);
    const body = (await res.json()) as { _id: string };
    expect(body._id).toBe("test-user-1");
  });
});
