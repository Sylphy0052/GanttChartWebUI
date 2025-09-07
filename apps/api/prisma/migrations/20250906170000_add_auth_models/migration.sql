-- Add authentication-related models for T012

-- Rate limit tracking for enhanced security
CREATE TABLE "rate_limit_attempts" (
  "id" TEXT NOT NULL PRIMARY KEY DEFAULT uuid_generate_v4(),
  "client_id" TEXT NOT NULL,
  "project_id" TEXT,
  "attempt_type" TEXT NOT NULL, -- 'login' | 'password_project'
  "attempts_count" INTEGER NOT NULL DEFAULT 0,
  "first_attempt_at" TIMESTAMP(3) NOT NULL DEFAULT NOW(),
  "last_attempt_at" TIMESTAMP(3) NOT NULL DEFAULT NOW(),
  "locked_until" TIMESTAMP(3),
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT NOW(),
  "updated_at" TIMESTAMP(3) NOT NULL DEFAULT NOW()
);

-- Session management for access tokens
CREATE TABLE "auth_sessions" (
  "id" TEXT NOT NULL PRIMARY KEY DEFAULT uuid_generate_v4(),
  "project_id" TEXT NOT NULL,
  "client_id" TEXT NOT NULL,
  "access_token" TEXT NOT NULL UNIQUE,
  "refresh_token" TEXT,
  "expires_at" TIMESTAMP(3) NOT NULL,
  "refresh_expires_at" TIMESTAMP(3),
  "is_active" BOOLEAN NOT NULL DEFAULT true,
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT NOW(),
  "updated_at" TIMESTAMP(3) NOT NULL DEFAULT NOW(),
  
  FOREIGN KEY ("project_id") REFERENCES "projects"("id") ON DELETE CASCADE
);

-- Token blacklist for secure logout
CREATE TABLE "token_blacklist" (
  "id" TEXT NOT NULL PRIMARY KEY DEFAULT uuid_generate_v4(),
  "token_hash" TEXT NOT NULL UNIQUE,
  "token_type" TEXT NOT NULL, -- 'access' | 'refresh'
  "expires_at" TIMESTAMP(3) NOT NULL,
  "blacklisted_at" TIMESTAMP(3) NOT NULL DEFAULT NOW(),
  "reason" TEXT -- 'logout' | 'security' | 'expired'
);

-- Admin override tokens for emergency access
CREATE TABLE "admin_override_tokens" (
  "id" TEXT NOT NULL PRIMARY KEY DEFAULT uuid_generate_v4(),
  "project_id" TEXT NOT NULL,
  "admin_user_id" TEXT,
  "override_token" TEXT NOT NULL UNIQUE,
  "reason" TEXT NOT NULL,
  "expires_at" TIMESTAMP(3) NOT NULL,
  "used_at" TIMESTAMP(3),
  "is_active" BOOLEAN NOT NULL DEFAULT true,
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT NOW(),
  "updated_at" TIMESTAMP(3) NOT NULL DEFAULT NOW(),
  
  FOREIGN KEY ("project_id") REFERENCES "projects"("id") ON DELETE CASCADE,
  FOREIGN KEY ("admin_user_id") REFERENCES "users"("id") ON DELETE SET NULL
);

-- Indexes for performance
CREATE INDEX "rate_limit_attempts_client_id_type_idx" ON "rate_limit_attempts"("client_id", "attempt_type");
CREATE INDEX "rate_limit_attempts_project_id_idx" ON "rate_limit_attempts"("project_id");
CREATE INDEX "rate_limit_attempts_locked_until_idx" ON "rate_limit_attempts"("locked_until");

CREATE INDEX "auth_sessions_project_id_idx" ON "auth_sessions"("project_id");
CREATE INDEX "auth_sessions_client_id_idx" ON "auth_sessions"("client_id");
CREATE INDEX "auth_sessions_expires_at_idx" ON "auth_sessions"("expires_at");
CREATE INDEX "auth_sessions_access_token_idx" ON "auth_sessions"("access_token");

CREATE INDEX "token_blacklist_token_hash_idx" ON "token_blacklist"("token_hash");
CREATE INDEX "token_blacklist_expires_at_idx" ON "token_blacklist"("expires_at");

CREATE INDEX "admin_override_tokens_project_id_idx" ON "admin_override_tokens"("project_id");
CREATE INDEX "admin_override_tokens_override_token_idx" ON "admin_override_tokens"("override_token");
CREATE INDEX "admin_override_tokens_expires_at_idx" ON "admin_override_tokens"("expires_at");