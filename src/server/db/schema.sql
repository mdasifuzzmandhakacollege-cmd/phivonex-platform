-- PHIVONEX Authentication & Referral Database Schema
-- Task #2 & Task #3 Backend

-- Users Table
CREATE TABLE IF NOT EXISTS users (
  id UUID PRIMARY KEY,
  public_id VARCHAR(50) UNIQUE NOT NULL,
  full_name VARCHAR(255) NOT NULL,
  email VARCHAR(255) NOT NULL,
  phone VARCHAR(50) NULL,
  country VARCHAR(100) NOT NULL,
  password_hash TEXT NOT NULL,
  status VARCHAR(50) NOT NULL DEFAULT 'ACTIVE',
  email_verified_at TIMESTAMP WITH TIME ZONE NULL,
  pending_referral_code VARCHAR(50) NULL,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT CURRENT_TIMESTAMP,
  last_login_at TIMESTAMP WITH TIME ZONE NULL
);

-- Unique constraints and indexes on users
CREATE UNIQUE INDEX IF NOT EXISTS idx_users_public_id ON users (public_id);
CREATE UNIQUE INDEX IF NOT EXISTS idx_users_email_lower ON users (LOWER(email));
CREATE UNIQUE INDEX IF NOT EXISTS idx_users_phone ON users (phone) WHERE phone IS NOT NULL AND phone != '';
CREATE INDEX IF NOT EXISTS idx_users_status ON users (status);

-- Sessions Table
CREATE TABLE IF NOT EXISTS sessions (
  id UUID PRIMARY KEY,
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  token_hash TEXT NOT NULL,
  user_agent TEXT NULL,
  ip_address VARCHAR(100) NULL,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT CURRENT_TIMESTAMP,
  expires_at TIMESTAMP WITH TIME ZONE NOT NULL,
  last_used_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT CURRENT_TIMESTAMP,
  revoked_at TIMESTAMP WITH TIME ZONE NULL
);

CREATE INDEX IF NOT EXISTS idx_sessions_token_hash ON sessions (token_hash);
CREATE INDEX IF NOT EXISTS idx_sessions_user_id ON sessions (user_id);
CREATE INDEX IF NOT EXISTS idx_sessions_expires_at ON sessions (expires_at);

-- Security Activity Log Table (Task #5)
CREATE TABLE IF NOT EXISTS security_events (
  id UUID PRIMARY KEY,
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  event_type VARCHAR(100) NOT NULL,
  description TEXT NOT NULL,
  user_agent_summary VARCHAR(255) NULL,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_security_events_user ON security_events (user_id, created_at DESC);

-- Auth Tokens Table (Email Verification and Password Reset)
CREATE TABLE IF NOT EXISTS auth_tokens (
  id UUID PRIMARY KEY,
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  type VARCHAR(50) NOT NULL, -- 'EMAIL_VERIFY', 'PASSWORD_RESET'
  token_hash TEXT NOT NULL,
  expires_at TIMESTAMP WITH TIME ZONE NOT NULL,
  used_at TIMESTAMP WITH TIME ZONE NULL,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_auth_tokens_hash_type ON auth_tokens (token_hash, type);
CREATE INDEX IF NOT EXISTS idx_auth_tokens_user_id ON auth_tokens (user_id);

-- User Referrals Table (Task #3)
CREATE TABLE IF NOT EXISTS user_referrals (
  user_id UUID PRIMARY KEY REFERENCES users(id) ON DELETE CASCADE,
  referral_code VARCHAR(50) UNIQUE NOT NULL,
  sponsor_user_id UUID NULL REFERENCES users(id) ON DELETE SET NULL,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT chk_no_self_referral CHECK (user_id != sponsor_user_id)
);

CREATE UNIQUE INDEX IF NOT EXISTS idx_user_referrals_code ON user_referrals (referral_code);
CREATE INDEX IF NOT EXISTS idx_user_referrals_sponsor ON user_referrals (sponsor_user_id);

-- Genesis Nodes Inventory Table (Task #6)
CREATE TABLE IF NOT EXISTS nodes (
  id UUID PRIMARY KEY,
  node_number INTEGER UNIQUE NOT NULL,
  public_node_id VARCHAR(50) UNIQUE NOT NULL,
  status VARCHAR(50) NOT NULL,
  owner_user_id UUID NULL REFERENCES users(id) ON DELETE SET NULL,
  reserved_by_user_id UUID NULL REFERENCES users(id) ON DELETE SET NULL,
  reserved_at TIMESTAMP WITH TIME ZONE NULL,
  activated_at TIMESTAMP WITH TIME ZONE NULL,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT chk_node_number_range CHECK (node_number >= 1 AND node_number <= 10000),
  CONSTRAINT chk_node_status_valid CHECK (status IN ('AVAILABLE', 'RESERVED', 'ACTIVE', 'RETIRED')),
  CONSTRAINT chk_node_available_owner CHECK (status != 'AVAILABLE' OR owner_user_id IS NULL),
  CONSTRAINT chk_node_active_owner CHECK (status != 'ACTIVE' OR owner_user_id IS NOT NULL)
);

CREATE UNIQUE INDEX IF NOT EXISTS idx_nodes_node_number ON nodes (node_number);
CREATE UNIQUE INDEX IF NOT EXISTS idx_nodes_public_node_id ON nodes (public_node_id);
CREATE INDEX IF NOT EXISTS idx_nodes_status ON nodes (status);
CREATE INDEX IF NOT EXISTS idx_nodes_owner ON nodes (owner_user_id);

-- Genesis Node Orders Table (Task #7)
CREATE TABLE IF NOT EXISTS node_orders (
  id UUID PRIMARY KEY,
  public_order_id VARCHAR(50) UNIQUE NOT NULL,
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  node_id UUID NOT NULL REFERENCES nodes(id) ON DELETE CASCADE,
  node_number INTEGER NOT NULL,
  amount_usd NUMERIC(12, 2) NOT NULL DEFAULT 1000.00,
  currency VARCHAR(20) NOT NULL DEFAULT 'USD',
  status VARCHAR(50) NOT NULL DEFAULT 'PENDING',
  payment_method VARCHAR(50) NOT NULL DEFAULT 'SIMULATED_INSTANT',
  payment_reference VARCHAR(255) NULL,
  idempotency_key VARCHAR(100) NULL,
  reserved_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT CURRENT_TIMESTAMP,
  expires_at TIMESTAMP WITH TIME ZONE NOT NULL,
  completed_at TIMESTAMP WITH TIME ZONE NULL,
  cancelled_at TIMESTAMP WITH TIME ZONE NULL,
  failed_at TIMESTAMP WITH TIME ZONE NULL,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT chk_node_order_status CHECK (status IN ('PENDING', 'SETTLING', 'COMPLETED', 'CANCELLED', 'EXPIRED', 'FAILED')),
  CONSTRAINT chk_node_order_amount CHECK (amount_usd = 1000.00)
);

CREATE UNIQUE INDEX IF NOT EXISTS idx_node_orders_public_id ON node_orders (public_order_id);
CREATE UNIQUE INDEX IF NOT EXISTS idx_node_orders_idempotency ON node_orders (idempotency_key) WHERE idempotency_key IS NOT NULL AND idempotency_key != '';
CREATE INDEX IF NOT EXISTS idx_node_orders_user ON node_orders (user_id);
CREATE INDEX IF NOT EXISTS idx_node_orders_status ON node_orders (status);
CREATE INDEX IF NOT EXISTS idx_node_orders_node_id ON node_orders (node_id);
CREATE INDEX IF NOT EXISTS idx_node_orders_expires_at ON node_orders (expires_at);

-- Direct Referral Commissions Table (Task #8)
CREATE TABLE IF NOT EXISTS referral_commissions (
  id UUID PRIMARY KEY,
  public_commission_id VARCHAR(50) UNIQUE NOT NULL,
  sponsor_user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  referred_user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  node_id UUID UNIQUE NOT NULL REFERENCES nodes(id) ON DELETE CASCADE,
  node_order_id UUID NOT NULL REFERENCES node_orders(id) ON DELETE CASCADE,
  amount_usd NUMERIC(12, 2) NOT NULL DEFAULT 50.00,
  status VARCHAR(50) NOT NULL DEFAULT 'EARNED',
  earned_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT CURRENT_TIMESTAMP,
  reversed_at TIMESTAMP WITH TIME ZONE NULL,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT chk_commission_amount CHECK (amount_usd = 50.00),
  CONSTRAINT chk_commission_status CHECK (status IN ('EARNED', 'REVERSED')),
  CONSTRAINT chk_commission_no_self CHECK (sponsor_user_id != referred_user_id)
);

CREATE UNIQUE INDEX IF NOT EXISTS idx_referral_commissions_public_id ON referral_commissions (public_commission_id);
CREATE UNIQUE INDEX IF NOT EXISTS idx_referral_commissions_node_id ON referral_commissions (node_id);
CREATE INDEX IF NOT EXISTS idx_referral_commissions_sponsor ON referral_commissions (sponsor_user_id);
CREATE INDEX IF NOT EXISTS idx_referral_commissions_referred ON referral_commissions (referred_user_id);
CREATE INDEX IF NOT EXISTS idx_referral_commissions_order ON referral_commissions (node_order_id);
CREATE INDEX IF NOT EXISTS idx_referral_commissions_status ON referral_commissions (status);

-- Binary Network Placements Table (Task #9)
CREATE TABLE IF NOT EXISTS binary_placements (
  user_id UUID PRIMARY KEY REFERENCES users(id) ON DELETE CASCADE,
  parent_user_id UUID NULL REFERENCES users(id) ON DELETE SET NULL,
  side VARCHAR(10) NULL,
  status VARCHAR(20) NOT NULL DEFAULT 'UNPLACED',
  placed_at TIMESTAMP WITH TIME ZONE NULL,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT chk_no_self_parent CHECK (parent_user_id IS NULL OR user_id != parent_user_id),
  CONSTRAINT chk_placement_side CHECK (side IS NULL OR side IN ('LEFT', 'RIGHT')),
  CONSTRAINT chk_placement_status CHECK (status IN ('UNPLACED', 'PLACED'))
);

CREATE UNIQUE INDEX IF NOT EXISTS idx_binary_parent_side ON binary_placements (parent_user_id, side) WHERE parent_user_id IS NOT NULL AND side IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_binary_placements_parent ON binary_placements (parent_user_id);
CREATE INDEX IF NOT EXISTS idx_binary_placements_status ON binary_placements (status);

