import { Hono } from "hono";
import { z } from "zod";
import { sql } from "../db/client.js";
import { mapBadge } from "../db/mappers.js";
import { authedRpc } from "../lib/route.js";

export const badges = new Hono();

const NoArgs = z.object({});

badges.post(
  "/getUserBadges",
  authedRpc(NoArgs, async (_args, { userId }) => {
    const rows = await sql`
      SELECT * FROM badges WHERE user_id = ${userId}
    `;
    return rows.map(mapBadge);
  })
);

// ---------------------------------------------------------------------------
// checkAndAwardBadges — direct port of convex/badges.ts
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

interface ScoredSession {
  createdAt: number;
  technique: string;
  overallScore: number;
}

badges.post(
  "/checkAndAwardBadges",
  authedRpc(NoArgs, async (_args, { userId }) => {
    // Sessions joined with the latest analysis per session, oldest first so
    // trend-based checks see the chronological order.
    const rows = await sql`
      SELECT
        s.created_at AS created_at,
        a.technique  AS technique,
        a.overall_score AS overall_score
      FROM sessions s
      LEFT JOIN LATERAL (
        SELECT technique, overall_score
        FROM analyses
        WHERE session_id = s.id
        ORDER BY created_at DESC LIMIT 1
      ) a ON true
      WHERE s.user_id = ${userId}
      ORDER BY s.created_at ASC
    `;

    const sessionsAll = rows.map((r) => ({
      createdAt: Number(r.created_at),
      technique: (r.technique as string | null) ?? null,
      overallScore:
        r.overall_score === null || r.overall_score === undefined
          ? null
          : Number(r.overall_score),
    }));

    const scored: ScoredSession[] = sessionsAll.filter(
      (e): e is ScoredSession =>
        e.overallScore != null && e.technique != null
    );

    const existing = await sql`
      SELECT badge_id FROM badges WHERE user_id = ${userId}
    `;
    const earned = new Set(existing.map((b) => b.badge_id as string));

    async function award(badgeId: string) {
      if (earned.has(badgeId)) return;
      // Unique constraint on (user_id, badge_id) makes this idempotent under
      // concurrent calls — ON CONFLICT swallows the dup safely.
      await sql`
        INSERT INTO badges (user_id, badge_id, earned_at)
        VALUES (${userId}, ${badgeId}, ${Date.now()})
        ON CONFLICT (user_id, badge_id) DO NOTHING
      `;
      earned.add(badgeId);
    }

    // Score-threshold badges
    for (const { technique, overallScore } of scored) {
      if (technique === "serve"               && overallScore >= 75) await award("ace-machine");
      if (technique === "forehand"            && overallScore >= 80) await award("sharp-shooter");
      if (technique === "backhand_one_handed" && overallScore >= 80) await award("iron-wall");
      if (technique === "footwork"            && overallScore >= 80) await award("speed-demon");
    }

    // Net Ninja — volley improves by ≥ 15 points across sessions
    const volleyScores = scored
      .filter((s) => s.technique === "volley")
      .map((s) => s.overallScore);
    if (volleyScores.length >= 2 && Math.max(...volleyScores) - volleyScores[0]! >= 15) {
      await award("net-ninja");
    }

    // Hot Streak — sessions in 4 consecutive calendar weeks
    const weekKeys = new Set(
      sessionsAll.map((s) => {
        const d = new Date(s.createdAt);
        const jan1 = new Date(d.getFullYear(), 0, 1);
        const week = Math.ceil(
          ((d.getTime() - jan1.getTime()) / 86400000 + jan1.getDay() + 1) / 7
        );
        return `${d.getFullYear()}-${week}`;
      })
    );
    const sortedWeeks = Array.from(weekKeys).sort();
    let streak = 1;
    for (let i = 1; i < sortedWeeks.length; i++) {
      const [py, pw] = sortedWeeks[i - 1]!.split("-").map(Number) as [number, number];
      const [cy, cw] = sortedWeeks[i]!.split("-").map(Number) as [number, number];
      const consecutive =
        (cy === py && cw === pw + 1) || (cy === py + 1 && pw >= 52 && cw === 1);
      streak = consecutive ? streak + 1 : 1;
      if (streak >= 4) {
        await award("hot-streak");
        break;
      }
    }

    // Most Improved — OVR up ≥ 10 within any 30-day window
    for (let i = 0; i < scored.length; i++) {
      const base = scored[i]!;
      const windowEnd = base.createdAt + 30 * 24 * 60 * 60 * 1000;
      const later = scored.filter(
        (s) => s.createdAt > base.createdAt && s.createdAt <= windowEnd
      );
      if (
        later.length > 0 &&
        Math.max(...later.map((s) => s.overallScore)) - base.overallScore >= 10
      ) {
        await award("most-improved");
        break;
      }
    }

    // Comeback Kid — score improves after 2 consecutive declines
    for (let i = 4; i <= scored.length; i++) {
      const [a, b, c, d] = scored.slice(i - 4, i) as [
        ScoredSession,
        ScoredSession,
        ScoredSession,
        ScoredSession,
      ];
      if (
        b.overallScore < a.overallScore &&
        c.overallScore < b.overallScore &&
        d.overallScore > c.overallScore
      ) {
        await award("comeback-kid");
        break;
      }
    }

    return Array.from(earned);
  })
);
