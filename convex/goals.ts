import { ConvexError, v } from "convex/values";
import { mutation, query } from "./_generated/server";

export const getGoal = query({
  args: { userId: v.id("users") },
  handler: async (ctx, { userId }) => {
    return await ctx.db
      .query("goals")
      .withIndex("by_user", (q) => q.eq("userId", userId))
      .first();
  },
});

export const setGoal = mutation({
  args: {
    userId: v.id("users"),
    targetOvr: v.number(),
    deadline: v.string(),
  },
  handler: async (ctx, { userId, targetOvr, deadline }) => {
    if (targetOvr < 1 || targetOvr > 100) {
      throw new ConvexError("targetOvr must be between 1 and 100");
    }
    if (!deadline) {
      throw new ConvexError("deadline is required");
    }

    const existing = await ctx.db
      .query("goals")
      .withIndex("by_user", (q) => q.eq("userId", userId))
      .first();

    if (existing) {
      await ctx.db.patch(existing._id, { targetOvr, deadline, updatedAt: Date.now() });
      return existing._id;
    }

    return await ctx.db.insert("goals", {
      userId,
      targetOvr,
      deadline,
      createdAt: Date.now(),
      updatedAt: Date.now(),
    });
  },
});
