import { ConvexError, v } from "convex/values";
import { mutation, query } from "./_generated/server";

/**
 * Step 1 of upload flow.
 * Frontend calls this to get a short-lived upload URL, then POSTs the video file directly to it.
 * Returns the upload URL and the storageId to pass into createSession.
 */
export const generateUploadUrl = mutation({
  args: {},
  handler: async (ctx) => {
    return await ctx.storage.generateUploadUrl();
  },
});

/**
 * Get a temporary serving URL for a stored video by storageId.
 * Returns null if the file does not exist.
 */
export const getVideoUrl = query({
  args: {
    storageId: v.id("_storage"),
  },
  handler: async (ctx, args) => {
    return await ctx.storage.getUrl(args.storageId);
  },
});

/**
 * Get the video URL for a session directly by sessionId.
 */
export const getSessionVideoUrl = query({
  args: {
    sessionId: v.id("sessions"),
  },
  handler: async (ctx, args) => {
    const session = await ctx.db.get(args.sessionId);
    if (!session) {
      throw new ConvexError(`Session ${args.sessionId} not found`);
    }
    return await ctx.storage.getUrl(session.videoStorageId);
  },
});

/**
 * Delete a stored video file. Called when a session is deleted.
 */
export const deleteVideo = mutation({
  args: {
    storageId: v.id("_storage"),
  },
  handler: async (ctx, args) => {
    await ctx.storage.delete(args.storageId);
  },
});
