import { v } from "convex/values";
import { mutation, query } from "./_generated/server";

export const getUserBadges = query({
  args: { userId: v.id("users") },
  handler: async (ctx, { userId }) => {
    return await ctx.db
      .query("badges")
      .withIndex("by_user", (q) => q.eq("userId", userId))
      .collect();
  },
});

// ---------------------------------------------------------------------------
// checkAndAwardBadges
//
// Evaluates all badge conditions against the user's full session history and
// inserts any newly earned badges. Safe to call multiple times — already-earned
// badges are skipped.
//
// Badge definitions:
//   ace-machine    — serve score ≥ 75
//   sharp-shooter  — forehand score ≥ 80
//   iron-wall      — backhand score ≥ 80
//   speed-demon    — footwork score ≥ 80
//   net-ninja      — volley improves by ≥ 15 points across sessions
//   hot-streak     — sessions in 4 consecutive calendar weeks
//   most-improved  — overall score up ≥ 10 points within a 30-day window
//   comeback-kid   — score improves after 2 consecutive declining sessions
// ---------------------------------------------------------------------------

export const checkAndAwardBadges = mutation({
  args: { userId: v.id("users") },
  handler: async (ctx, { userId }) => {
    // ── Gather all sessions + their latest analysis ───────────────────────────
    const sessions = await ctx.db
      .query("sessions")
      .withIndex("by_user", (q) => q.eq("userId", userId))
      .order("asc") // oldest first for trend analysis
      .collect();

    const enriched = await Promise.all(
      sessions.map(async (session) => {
        const analysis = await ctx.db
          .query("analyses")
          .withIndex("by_session", (q) => q.eq("sessionId", session._id))
          .order("desc")
          .first();
        return {
          createdAt: session.createdAt,
          technique: analysis?.technique ?? null,
          overallScore: analysis?.overallScore ?? null,
        };
      })
    );

    const scored = enriched.filter(
      (e): e is { createdAt: number; technique: string; overallScore: number } =>
        e.overallScore != null && e.technique != null
    );

    // ── Already-earned set ────────────────────────────────────────────────────
    const existing = await ctx.db
      .query("badges")
      .withIndex("by_user", (q) => q.eq("userId", userId))
      .collect();
    const earned = new Set(existing.map((b) => b.badgeId));

    async function award(badgeId: string) {
      if (!earned.has(badgeId)) {
        await ctx.db.insert("badges", { userId, badgeId, earnedAt: Date.now() });
        earned.add(badgeId);
      }
    }

    // ── Score threshold badges ────────────────────────────────────────────────
    for (const { technique, overallScore } of scored) {
      if (technique === "serve"              && overallScore >= 75) await award("ace-machine");
      if (technique === "forehand"           && overallScore >= 80) await award("sharp-shooter");
      if (technique === "backhand_one_handed"&& overallScore >= 80) await award("iron-wall");
      if (technique === "footwork"           && overallScore >= 80) await award("speed-demon");
    }

    // ── Net Ninja: volley improves by ≥ 15 points ────────────────────────────
    const volleyScores = scored
      .filter((s) => s.technique === "volley")
      .map((s) => s.overallScore);
    if (volleyScores.length >= 2 && Math.max(...volleyScores) - volleyScores[0] >= 15) {
      await award("net-ninja");
    }

    // ── Hot Streak: sessions in 4 consecutive calendar weeks ─────────────────
    const weekKeys = new Set(
      sessions.map((s) => {
        const d = new Date(s.createdAt);
        const jan1 = new Date(d.getFullYear(), 0, 1);
        const week = Math.ceil(((d.getTime() - jan1.getTime()) / 86400000 + jan1.getDay() + 1) / 7);
        return `${d.getFullYear()}-${week}`;
      })
    );
    const sortedWeeks = Array.from(weekKeys).sort();
    let streak = 1;
    for (let i = 1; i < sortedWeeks.length; i++) {
      const [py, pw] = sortedWeeks[i - 1].split("-").map(Number);
      const [cy, cw] = sortedWeeks[i].split("-").map(Number);
      const consecutive =
        (cy === py && cw === pw + 1) || (cy === py + 1 && pw >= 52 && cw === 1);
      streak = consecutive ? streak + 1 : 1;
      if (streak >= 4) { await award("hot-streak"); break; }
    }

    // ── Most Improved: OVR up ≥ 10 within any 30-day window ─────────────────
    for (let i = 0; i < scored.length; i++) {
      const base = scored[i];
      const windowEnd = base.createdAt + 30 * 24 * 60 * 60 * 1000;
      const later = scored.filter((s) => s.createdAt > base.createdAt && s.createdAt <= windowEnd);
      if (later.length > 0 && Math.max(...later.map((s) => s.overallScore)) - base.overallScore >= 10) {
        await award("most-improved");
        break;
      }
    }

    // ── Comeback Kid: score improves after 2 consecutive declines ────────────
    for (let i = 3; i <= scored.length; i++) {
      const slice = scored.slice(i - 3, i); // [a, b, c] — need b<a then c>b
      // Actually we need: decline(a→b), decline(b→c) is 2 declines then improve(c→d)
      // With 3 points we can check: b<a (1 decline) and c>b (recovery after 1)
      // For 2 declines: [a, b, c, d] where b<a, c<b, d>c — need 4 points
      if (i < 4) continue;
      const [a, b, c, d] = scored.slice(i - 4, i);
      if (b.overallScore < a.overallScore && c.overallScore < b.overallScore && d.overallScore > c.overallScore) {
        await award("comeback-kid");
        break;
      }
    }

    return Array.from(earned);
  },
});
