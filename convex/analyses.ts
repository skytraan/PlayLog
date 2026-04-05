import { ConvexError, v } from "convex/values";
import { mutation, query } from "./_generated/server";

export const createAnalysis = mutation({
  args: {
    sessionId: v.id("sessions"),
    promptId: v.optional(v.id("prompts")),
  },
  handler: async (ctx, args) => {
    const session = await ctx.db.get(args.sessionId);
    if (!session) throw new ConvexError(`Session ${args.sessionId} not found`);

    return await ctx.db.insert("analyses", {
      sessionId: args.sessionId,
      promptId: args.promptId,
      createdAt: Date.now(),
    });
  },
});

export const updateAnalysis = mutation({
  args: {
    analysisId: v.id("analyses"),
    twelveLabsIndexId: v.optional(v.string()),
    twelveLabsVideoId: v.optional(v.string()),
    twelveLabsResult: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const analysis = await ctx.db.get(args.analysisId);
    if (!analysis) throw new ConvexError(`Analysis ${args.analysisId} not found`);

    const { analysisId, ...fields } = args;
    const patch = Object.fromEntries(
      Object.entries(fields).filter(([, v]) => v !== undefined)
    );
    await ctx.db.patch(analysisId, patch);
  },
});

export const getAnalysis = query({
  args: {
    analysisId: v.id("analyses"),
  },
  handler: async (ctx, args) => {
    const analysis = await ctx.db.get(args.analysisId);
    if (!analysis) {
      throw new ConvexError(`Analysis ${args.analysisId} not found`);
    }
    return analysis;
  },
});

export const getAnalysisForSession = query({
  args: {
    sessionId: v.id("sessions"),
  },
  handler: async (ctx, args) => {
    return await ctx.db
      .query("analyses")
      .withIndex("by_session", (q) => q.eq("sessionId", args.sessionId))
      .order("desc")
      .collect();
  },
});
