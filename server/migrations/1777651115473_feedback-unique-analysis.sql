-- Up Migration

-- Issue #34: enforce one feedback row per analysis. Pre-existing duplicates
-- are collapsed to the most-recent row (which is what getLatestFeedback
-- already returns), so this is a no-op for read paths.
DELETE FROM feedback
WHERE id IN (
  SELECT id FROM (
    SELECT id, row_number() OVER (
      PARTITION BY analysis_id
      ORDER BY created_at DESC, id DESC
    ) AS rn
    FROM feedback
  ) ranked
  WHERE rn > 1
);

ALTER TABLE feedback ADD CONSTRAINT feedback_analysis_id_key UNIQUE (analysis_id);

-- Down Migration

ALTER TABLE feedback DROP CONSTRAINT IF EXISTS feedback_analysis_id_key;
