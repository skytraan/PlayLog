import { ConvexError, v } from "convex/values";
import { query } from "./_generated/server";

export const getFeedback = query({
  args: {
    feedbackId: v.id("feedback"),
  },
  handler: async (ctx, args) => {
    const feedback = await ctx.db.get(args.feedbackId);
    if (!feedback) {
      throw new ConvexError(`Feedback ${args.feedbackId} not found`);
    }
    return feedback;
  },
});

export const getFeedbackForSession = query({
  args: {
    sessionId: v.id("sessions"),
  },
  handler: async (ctx, args) => {
    return await ctx.db
      .query("feedback")
      .withIndex("by_session", (q) => q.eq("sessionId", args.sessionId))
      .order("asc")
      .collect();
  },
});
