import { ConvexError, v } from "convex/values";
import { mutation, query } from "./_generated/server";

export const createUser = mutation({
  args: {
    name: v.string(),
    email: v.string(),
    sports: v.array(v.string()),
  },
  handler: async (ctx, args) => {
    if (!args.name.trim()) {
      throw new ConvexError("name is required");
    }
    if (!args.email.trim() || !args.email.includes("@")) {
      throw new ConvexError("valid email is required");
    }
    if (args.sports.length === 0) {
      throw new ConvexError("at least one sport must be selected");
    }

    const existing = await ctx.db
      .query("users")
      .withIndex("by_email", (q) => q.eq("email", args.email.trim()))
      .first();
    if (existing) {
      return existing._id;
    }

    return await ctx.db.insert("users", {
      name: args.name.trim(),
      email: args.email.trim(),
      sports: args.sports,
      createdAt: Date.now(),
    });
  },
});

export const getUser = query({
  args: {
    userId: v.id("users"),
  },
  handler: async (ctx, args) => {
    const user = await ctx.db.get(args.userId);
    if (!user) {
      throw new ConvexError(`User ${args.userId} not found`);
    }
    return user;
  },
});

// Returns null instead of throwing — safe to use for existence checks
export const findUser = query({
  args: {
    userId: v.id("users"),
  },
  handler: async (ctx, args) => {
    return await ctx.db.get(args.userId);
  },
});

export const getUserByEmail = query({
  args: {
    email: v.string(),
  },
  handler: async (ctx, args) => {
    return await ctx.db
      .query("users")
      .withIndex("by_email", (q) => q.eq("email", args.email.trim()))
      .first();
  },
});
