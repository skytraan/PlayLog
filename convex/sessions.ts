import { ConvexError, v } from "convex/values";
import { mutation, query } from "./_generated/server";

export const createSession = mutation({
  args: {
    userId: v.id("users"),
    sport: v.string(),
    videoStorageId: v.id("_storage"),
    requestedSections: v.array(v.string()),
  },
  handler: async (ctx, args) => {
    if (!args.sport.trim()) {
      throw new ConvexError("sport is required");
    }
    if (args.requestedSections.length === 0) {
      throw new ConvexError("at least one section must be requested");
    }

    const user = await ctx.db.get(args.userId);
    if (!user) {
      throw new ConvexError(`User ${args.userId} not found`);
    }

    return await ctx.db.insert("sessions", {
      userId: args.userId,
      sport: args.sport.trim(),
      videoStorageId: args.videoStorageId,
      requestedSections: args.requestedSections,
      status: "uploading",
      createdAt: Date.now(),
    });
  },
});

export const updateSessionStatus = mutation({
  args: {
    sessionId: v.id("sessions"),
    status: v.union(
      v.literal("uploading"),
      v.literal("processing"),
      v.literal("complete"),
      v.literal("error")
    ),
    errorMessage: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const session = await ctx.db.get(args.sessionId);
    if (!session) {
      throw new ConvexError(`Session ${args.sessionId} not found`);
    }

    await ctx.db.patch(args.sessionId, {
      status: args.status,
      ...(args.errorMessage !== undefined && { errorMessage: args.errorMessage }),
    });
  },
});

export const getSession = query({
  args: {
    sessionId: v.id("sessions"),
  },
  handler: async (ctx, args) => {
    const session = await ctx.db.get(args.sessionId);
    if (!session) {
      throw new ConvexError(`Session ${args.sessionId} not found`);
    }
    return session;
  },
});

export const listSessions = query({
  args: {
    userId: v.id("users"),
  },
  handler: async (ctx, args) => {
    return await ctx.db
      .query("sessions")
      .withIndex("by_user", (q) => q.eq("userId", args.userId))
      .order("desc")
      .collect();
  },
});

export const listSessionsWithFeedback = query({
  args: {
    userId: v.id("users"),
  },
  handler: async (ctx, args) => {
    const sessions = await ctx.db
      .query("sessions")
      .withIndex("by_user", (q) => q.eq("userId", args.userId))
      .order("desc")
      .collect();

    return await Promise.all(
      sessions.map(async (session) => {
        const [feedback, analysis] = await Promise.all([
          ctx.db
            .query("feedback")
            .withIndex("by_session", (q) => q.eq("sessionId", session._id))
            .order("desc")
            .first(),
          ctx.db
            .query("analyses")
            .withIndex("by_session", (q) => q.eq("sessionId", session._id))
            .order("desc")
            .first(),
        ]);
        return {
          session,
          feedback: feedback ?? null,
          overallScore: analysis?.overallScore ?? null,
          technique: analysis?.technique ?? null,
          poseAnalysis: analysis?.poseAnalysis ?? null,
        };
      })
    );
  },
});
