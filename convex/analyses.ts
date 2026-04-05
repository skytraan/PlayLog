import { ConvexError, v } from "convex/values";
import { query } from "./_generated/server";

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
