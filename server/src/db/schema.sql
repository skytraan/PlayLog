-- DEPRECATED SNAPSHOT — use server/migrations/ instead.
-- This file is kept as a reference but is no longer applied by `npm run migrate`.
--
-- Conventions:
--   * Primary keys are uuid (text-encoded on the wire as `_id`).
--   * Timestamps stored as bigint epoch-ms to match Convex's number-based time.
--   * Arrays use Postgres native text[].
--   * Indexes name-mirror Convex indexes ("by_user", "by_session", "by_email").

CREATE EXTENSION IF NOT EXISTS pgcrypto;

CREATE TABLE IF NOT EXISTS users (
  id           uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name         text NOT NULL,
  email        text NOT NULL,
  sports       text[] NOT NULL,
  created_at   bigint NOT NULL
);
CREATE INDEX IF NOT EXISTS users_by_email ON users (email);

CREATE TABLE IF NOT EXISTS sessions (
  id                 uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id            uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  sport              text NOT NULL,
  video_storage_id   text NOT NULL,
  requested_sections text[] NOT NULL,
  status             text NOT NULL CHECK (status IN ('uploading','processing','complete','error')),
  error_message      text,
  created_at         bigint NOT NULL
);
CREATE INDEX IF NOT EXISTS sessions_by_user ON sessions (user_id, created_at DESC);

CREATE TABLE IF NOT EXISTS analyses (
  id                    uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  session_id            uuid NOT NULL REFERENCES sessions(id) ON DELETE CASCADE,
  twelve_labs_index_id  text,
  twelve_labs_video_id  text,
  twelve_labs_result    text,
  pose_analysis         text,
  overall_score         double precision,
  technique             text,
  created_at            bigint NOT NULL
);
CREATE INDEX IF NOT EXISTS analyses_by_session ON analyses (session_id, created_at DESC);

CREATE TABLE IF NOT EXISTS messages (
  id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  session_id  uuid NOT NULL REFERENCES sessions(id) ON DELETE CASCADE,
  role        text NOT NULL CHECK (role IN ('user','model')),
  content     text NOT NULL,
  created_at  bigint NOT NULL
);
CREATE INDEX IF NOT EXISTS messages_by_session ON messages (session_id, created_at);

CREATE TABLE IF NOT EXISTS goals (
  id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id     uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  target_ovr  integer NOT NULL,
  deadline    text NOT NULL,
  created_at  bigint NOT NULL,
  updated_at  bigint NOT NULL
);
CREATE INDEX IF NOT EXISTS goals_by_user ON goals (user_id);

CREATE TABLE IF NOT EXISTS badges (
  id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id     uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  badge_id    text NOT NULL,
  earned_at   bigint NOT NULL,
  UNIQUE (user_id, badge_id)
);
CREATE INDEX IF NOT EXISTS badges_by_user ON badges (user_id);

CREATE TABLE IF NOT EXISTS feedback (
  id            uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  session_id    uuid NOT NULL REFERENCES sessions(id) ON DELETE CASCADE,
  analysis_id   uuid NOT NULL REFERENCES analyses(id) ON DELETE CASCADE UNIQUE,
  summary       text NOT NULL,
  strengths     text[] NOT NULL,
  improvements  text[] NOT NULL,
  drills        text[] NOT NULL,
  created_at    bigint NOT NULL
);
CREATE INDEX IF NOT EXISTS feedback_by_session  ON feedback (session_id, created_at DESC);
CREATE INDEX IF NOT EXISTS feedback_by_analysis ON feedback (analysis_id, created_at DESC);
