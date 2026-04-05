import { ConvexError, v } from "convex/values";
import { mutation, query } from "./_generated/server";

export const saveFeedback = mutation({
  args: {
    sessionId: v.id("sessions"),
    analysisId: v.id("analyses"),
    summary: v.string(),
    strengths: v.array(v.string()),
    improvements: v.array(v.string()),
    drills: v.array(v.string()),
  },
  handler: async (ctx, args) => {
    const session = await ctx.db.get(args.sessionId);
    if (!session) throw new ConvexError(`Session ${args.sessionId} not found`);

    return await ctx.db.insert("feedback", {
      sessionId: args.sessionId,
      analysisId: args.analysisId,
      summary: args.summary,
      strengths: args.strengths,
      improvements: args.improvements,
      drills: args.drills,
      createdAt: Date.now(),
    });
  },
});

export const getFeedback = query({
  args: {
    feedbackId: v.id("feedback"),
  },
  handler: async (ctx, args) => {
    const feedback = await ctx.db.get(args.feedbackId);
    if (!feedback) throw new ConvexError(`Feedback ${args.feedbackId} not found`);
    return feedback;
  },
});

export const getLatestFeedback = query({
  args: {
    sessionId: v.id("sessions"),
  },
  handler: async (ctx, args) => {
    return await ctx.db
      .query("feedback")
      .withIndex("by_session", (q) => q.eq("sessionId", args.sessionId))
      .order("desc")
      .first();
  },
});
