import { convexTest } from "convex-test";
import { expect, test, describe } from "vitest";
import { api } from "../_generated/api";
import schema from "../schema";

// ─── Helpers ─────────────────────────────────────────────────────────────────

async function seedUser(t: ReturnType<typeof convexTest>) {
  return t.run(async (ctx) => {
    return await ctx.db.insert("users", {
      name: "Test User",
      email: "test@example.com",
      sports: ["tennis"],
      createdAt: Date.now(),
    });
  });
}

async function seedStorage(t: ReturnType<typeof convexTest>) {
  return t.run(async (ctx) => {
    return ctx.storage.store(new Blob(["fake-video"], { type: "video/mp4" }));
  });
}

// ─── createSession ────────────────────────────────────────────────────────────

describe("createSession", () => {
  test("happy path — creates session with correct fields", async () => {
    const t = convexTest(schema);
    const userId = await seedUser(t);
    const storageId = await seedStorage(t);

    const sessionId = await t.mutation(api.sessions.createSession, {
      userId,
      sport: "tennis",
      videoStorageId: storageId,
      requestedSections: ["forehand", "serve"],
    });

    const session = await t.run(async (ctx) => ctx.db.get(sessionId));
    expect(session).toMatchObject({
      userId,
      sport: "tennis",
      status: "uploading",
      requestedSections: ["forehand", "serve"],
    });
  });

  test("trims whitespace from sport", async () => {
    const t = convexTest(schema);
    const userId = await seedUser(t);
    const storageId = await seedStorage(t);

    const sessionId = await t.mutation(api.sessions.createSession, {
      userId,
      sport: "  tennis  ",
      videoStorageId: storageId,
      requestedSections: ["backhand"],
    });

    const session = await t.run(async (ctx) => ctx.db.get(sessionId));
    expect(session?.sport).toBe("tennis");
  });

  test("throws when sport is empty", async () => {
    const t = convexTest(schema);
    const userId = await seedUser(t);
    const storageId = await seedStorage(t);

    await expect(
      t.mutation(api.sessions.createSession, {
        userId,
        sport: "   ",
        videoStorageId: storageId,
        requestedSections: ["forehand"],
      })
    ).rejects.toThrow("sport is required");
  });

  test("throws when requestedSections is empty", async () => {
    const t = convexTest(schema);
    const userId = await seedUser(t);
    const storageId = await seedStorage(t);

    await expect(
      t.mutation(api.sessions.createSession, {
        userId,
        sport: "tennis",
        videoStorageId: storageId,
        requestedSections: [],
      })
    ).rejects.toThrow("at least one section must be requested");
  });

  test("throws when userId does not exist", async () => {
    const t = convexTest(schema);
    const storageId = await seedStorage(t);

    // Use a well-formed but nonexistent ID
    const fakeUserId = "jd7f2k3m4n5p6q7r8s9t0" as any;

    await expect(
      t.mutation(api.sessions.createSession, {
        userId: fakeUserId,
        sport: "tennis",
        videoStorageId: storageId,
        requestedSections: ["serve"],
      })
    ).rejects.toThrow();
  });
});

// ─── updateSessionStatus ──────────────────────────────────────────────────────

describe("updateSessionStatus", () => {
  test("happy path — transitions status", async () => {
    const t = convexTest(schema);
    const userId = await seedUser(t);
    const storageId = await seedStorage(t);

    const sessionId = await t.mutation(api.sessions.createSession, {
      userId,
      sport: "tennis",
      videoStorageId: storageId,
      requestedSections: ["footwork"],
    });

    await t.mutation(api.sessions.updateSessionStatus, {
      sessionId,
      status: "processing",
    });

    const session = await t.run(async (ctx) => ctx.db.get(sessionId));
    expect(session?.status).toBe("processing");
  });

  test("sets errorMessage on error status", async () => {
    const t = convexTest(schema);
    const userId = await seedUser(t);
    const storageId = await seedStorage(t);

    const sessionId = await t.mutation(api.sessions.createSession, {
      userId,
      sport: "tennis",
      videoStorageId: storageId,
      requestedSections: ["volley"],
    });

    await t.mutation(api.sessions.updateSessionStatus, {
      sessionId,
      status: "error",
      errorMessage: "upload timed out",
    });

    const session = await t.run(async (ctx) => ctx.db.get(sessionId));
    expect(session?.status).toBe("error");
    expect(session?.errorMessage).toBe("upload timed out");
  });

  test("throws when session does not exist", async () => {
    const t = convexTest(schema);
    const fakeId = "jd7f2k3m4n5p6q7r8s9t0" as any;

    await expect(
      t.mutation(api.sessions.updateSessionStatus, {
        sessionId: fakeId,
        status: "complete",
      })
    ).rejects.toThrow();
  });
});

// ─── getSession ───────────────────────────────────────────────────────────────

describe("getSession", () => {
  test("returns session by ID", async () => {
    const t = convexTest(schema);
    const userId = await seedUser(t);
    const storageId = await seedStorage(t);

    const sessionId = await t.mutation(api.sessions.createSession, {
      userId,
      sport: "tennis",
      videoStorageId: storageId,
      requestedSections: ["backhand"],
    });

    const session = await t.query(api.sessions.getSession, { sessionId });
    expect(session._id).toBe(sessionId);
    expect(session.sport).toBe("tennis");
  });

  test("throws when session does not exist", async () => {
    const t = convexTest(schema);
    const fakeId = "jd7f2k3m4n5p6q7r8s9t0" as any;

    await expect(
      t.query(api.sessions.getSession, { sessionId: fakeId })
    ).rejects.toThrow();
  });
});

// ─── listSessions ─────────────────────────────────────────────────────────────

describe("listSessions", () => {
  test("returns all sessions for a user ordered newest first", async () => {
    const t = convexTest(schema);
    const userId = await seedUser(t);
    const storageId = await seedStorage(t);

    const id1 = await t.mutation(api.sessions.createSession, {
      userId,
      sport: "tennis",
      videoStorageId: storageId,
      requestedSections: ["forehand"],
    });
    const id2 = await t.mutation(api.sessions.createSession, {
      userId,
      sport: "tennis",
      videoStorageId: storageId,
      requestedSections: ["serve"],
    });

    const sessions = await t.query(api.sessions.listSessions, { userId });
    expect(sessions).toHaveLength(2);
    // Most recent first
    expect(sessions[0]._id).toBe(id2);
    expect(sessions[1]._id).toBe(id1);
  });

  test("returns empty array when user has no sessions", async () => {
    const t = convexTest(schema);
    const userId = await seedUser(t);

    const sessions = await t.query(api.sessions.listSessions, { userId });
    expect(sessions).toHaveLength(0);
  });
});
