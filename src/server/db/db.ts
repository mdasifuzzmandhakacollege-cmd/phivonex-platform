import { PGlite } from '@electric-sql/pglite';
import { Pool } from 'pg';
import fs from 'fs';
import path from 'path';
import { generatePublicId, generateReferralCode, normalizeReferralCode } from '../utils/idGenerator';
import { v4 as uuidv4 } from 'uuid';
import { GENESIS_NODE_CAP, formatPublicNodeId } from '../../config/nodeConfig';

export interface QueryResult<T = any> {
  rows: T[];
  rowCount: number;
}

export interface DatabaseClient {
  query<T = any>(sql: string, params?: any[]): Promise<QueryResult<T>>;
  exec(sql: string): Promise<void>;
}

declare global {
  // eslint-disable-next-line no-var
  var __phivonexDb: DatabaseClient | undefined;
  // eslint-disable-next-line no-var
  var __phivonexDbPromise: Promise<DatabaseClient> | undefined;
}

export async function getDb(): Promise<DatabaseClient> {
  // 1. If singleton instance is ready, return immediately
  if (globalThis.__phivonexDb) {
    return globalThis.__phivonexDb;
  }

  // 2. If initialization is already in progress, await shared promise (concurrency barrier)
  if (globalThis.__phivonexDbPromise) {
    return globalThis.__phivonexDbPromise;
  }

  // 3. Initiate single initialization lifecycle
  globalThis.__phivonexDbPromise = (async () => {
    try {
      const databaseUrl = process.env.DATABASE_URL;
      let client: DatabaseClient;

      if (databaseUrl && !databaseUrl.includes('placeholder')) {
        console.log('[DB] Connecting to PostgreSQL via DATABASE_URL...');
        const pool = new Pool({
          connectionString: databaseUrl,
          ssl: process.env.NODE_ENV === 'production' ? { rejectUnauthorized: false } : undefined,
        });

        client = {
          async query<T = any>(sql: string, params?: any[]): Promise<QueryResult<T>> {
            const res = await pool.query(sql, params);
            return {
              rows: res.rows as T[],
              rowCount: res.rowCount ?? res.rows.length,
            };
          },
          async exec(sql: string): Promise<void> {
            await pool.query(sql);
          },
        };
      } else {
        // Embedded WebAssembly PostgreSQL (PGLite)
        const dataDir = process.env.PGLITE_DATA_DIR || path.resolve(process.cwd(), '.data/pglite_db');
        if (!fs.existsSync(dataDir)) {
          fs.mkdirSync(dataDir, { recursive: true });
        }

        console.log('[DB] Initializing embedded PostgreSQL (PGlite) singleton in:', dataDir);
        let pglite: PGlite;
        try {
          pglite = new PGlite(dataDir);
          await pglite.waitReady;
        } catch (pgInitErr: any) {
          console.warn(`[DB] PGlite failed to initialize from existing data directory (${dataDir}). Recovering clean state:`, pgInitErr?.message || pgInitErr);
          try {
            if (fs.existsSync(dataDir)) {
              fs.rmSync(dataDir, { recursive: true, force: true });
              fs.mkdirSync(dataDir, { recursive: true });
            }
            pglite = new PGlite(dataDir);
            await pglite.waitReady;
            console.log('[DB] PGlite recovered and initialized successfully.');
          } catch (recoverErr) {
            console.error('[DB] Fatal error during PGlite recovery:', recoverErr);
            throw recoverErr;
          }
        }

        client = {
          async query<T = any>(sql: string, params?: any[]): Promise<QueryResult<T>> {
            const res = await pglite.query<T>(sql, params);
            return {
              rows: res.rows as T[],
              rowCount: res.rows.length,
            };
          },
          async exec(sql: string): Promise<void> {
            await pglite.exec(sql);
          },
        };
      }

      // Run schema migration and Genesis node verification once
      await initSchema(client);

      globalThis.__phivonexDb = client;
      return client;
    } catch (err) {
      // Clear promise so subsequent requests can retry cleanly
      globalThis.__phivonexDbPromise = undefined;
      globalThis.__phivonexDb = undefined;
      console.error('[DB] Fatal error during database singleton initialization:', err);
      throw err;
    }
  })();

  return globalThis.__phivonexDbPromise;
}

async function initSchema(client: DatabaseClient) {
  try {
    // 1. Run core DDL statements individually or with client.exec
    await client.exec(`
      CREATE TABLE IF NOT EXISTS users (
        id UUID PRIMARY KEY,
        public_id VARCHAR(50),
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

      CREATE TABLE IF NOT EXISTS security_events (
        id UUID PRIMARY KEY,
        user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
        event_type VARCHAR(100) NOT NULL,
        description TEXT NOT NULL,
        user_agent_summary VARCHAR(255) NULL,
        created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT CURRENT_TIMESTAMP
      );

      CREATE TABLE IF NOT EXISTS auth_tokens (
        id UUID PRIMARY KEY,
        user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
        type VARCHAR(50) NOT NULL,
        token_hash TEXT NOT NULL,
        expires_at TIMESTAMP WITH TIME ZONE NOT NULL,
        used_at TIMESTAMP WITH TIME ZONE NULL,
        created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT CURRENT_TIMESTAMP
      );

      CREATE TABLE IF NOT EXISTS user_referrals (
        user_id UUID PRIMARY KEY REFERENCES users(id) ON DELETE CASCADE,
        referral_code VARCHAR(50) UNIQUE NOT NULL,
        sponsor_user_id UUID NULL REFERENCES users(id) ON DELETE SET NULL,
        created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT CURRENT_TIMESTAMP,
        CONSTRAINT chk_no_self_referral CHECK (user_id != sponsor_user_id)
      );

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

      -- Task #10: Binary Volume Engine Tables
      CREATE TABLE IF NOT EXISTS binary_volume_events (
        id UUID PRIMARY KEY,
        public_event_id VARCHAR(50) UNIQUE NOT NULL,
        beneficiary_user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
        source_user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
        source_node_id UUID NOT NULL REFERENCES nodes(id) ON DELETE CASCADE,
        side VARCHAR(10) NOT NULL,
        volume_units INTEGER NOT NULL DEFAULT 1,
        status VARCHAR(20) NOT NULL DEFAULT 'ACTIVE',
        business_date DATE NOT NULL,
        occurred_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT CURRENT_TIMESTAMP,
        reversed_at TIMESTAMP WITH TIME ZONE NULL,
        created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT CURRENT_TIMESTAMP,
        CONSTRAINT uq_bve_beneficiary_node UNIQUE (beneficiary_user_id, source_node_id),
        CONSTRAINT chk_bve_side CHECK (side IN ('LEFT', 'RIGHT')),
        CONSTRAINT chk_bve_status CHECK (status IN ('ACTIVE', 'REVERSED')),
        CONSTRAINT chk_bve_units CHECK (volume_units > 0)
      );

      CREATE TABLE IF NOT EXISTS binary_daily_volumes (
        id UUID PRIMARY KEY,
        user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
        business_date DATE NOT NULL,
        left_units INTEGER NOT NULL DEFAULT 0,
        right_units INTEGER NOT NULL DEFAULT 0,
        created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT CURRENT_TIMESTAMP,
        CONSTRAINT uq_bdv_user_date UNIQUE (user_id, business_date),
        CONSTRAINT chk_bdv_left CHECK (left_units >= 0),
        CONSTRAINT chk_bdv_right CHECK (right_units >= 0)
      );

      CREATE TABLE IF NOT EXISTS binary_volume_balances (
        user_id UUID PRIMARY KEY REFERENCES users(id) ON DELETE CASCADE,
        carry_left_units INTEGER NOT NULL DEFAULT 0,
        carry_right_units INTEGER NOT NULL DEFAULT 0,
        last_settled_business_date DATE NULL,
        updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT CURRENT_TIMESTAMP,
        CONSTRAINT chk_bvb_carry_left CHECK (carry_left_units >= 0),
        CONSTRAINT chk_bvb_carry_right CHECK (carry_right_units >= 0)
      );
    `);

    // Ensure public_id column exists on users (if created in previous version)
    try {
      await client.exec(`ALTER TABLE users ADD COLUMN IF NOT EXISTS public_id VARCHAR(50);`);
    } catch {
      // Column may already exist
    }

    // Ensure user_agent and ip_address columns exist on sessions
    try {
      await client.exec(`ALTER TABLE sessions ADD COLUMN IF NOT EXISTS user_agent TEXT;`);
      await client.exec(`ALTER TABLE sessions ADD COLUMN IF NOT EXISTS ip_address VARCHAR(100);`);
    } catch {
      // Columns may already exist
    }

    // 2. Create indexes
    await client.exec(`
      CREATE UNIQUE INDEX IF NOT EXISTS idx_users_public_id ON users (public_id);
      CREATE UNIQUE INDEX IF NOT EXISTS idx_users_email_lower ON users (LOWER(email));
      CREATE UNIQUE INDEX IF NOT EXISTS idx_users_phone ON users (phone) WHERE phone IS NOT NULL AND phone != '';
      CREATE INDEX IF NOT EXISTS idx_users_status ON users (status);

      CREATE INDEX IF NOT EXISTS idx_sessions_token_hash ON sessions (token_hash);
      CREATE INDEX IF NOT EXISTS idx_sessions_user_id ON sessions (user_id);
      CREATE INDEX IF NOT EXISTS idx_sessions_expires_at ON sessions (expires_at);

      CREATE INDEX IF NOT EXISTS idx_security_events_user ON security_events (user_id, created_at DESC);

      CREATE INDEX IF NOT EXISTS idx_auth_tokens_hash_type ON auth_tokens (token_hash, type);
      CREATE INDEX IF NOT EXISTS idx_auth_tokens_user_id ON auth_tokens (user_id);

      CREATE UNIQUE INDEX IF NOT EXISTS idx_user_referrals_code ON user_referrals (referral_code);
      CREATE INDEX IF NOT EXISTS idx_user_referrals_sponsor ON user_referrals (sponsor_user_id);

      CREATE UNIQUE INDEX IF NOT EXISTS idx_nodes_node_number ON nodes (node_number);
      CREATE UNIQUE INDEX IF NOT EXISTS idx_nodes_public_node_id ON nodes (public_node_id);
      CREATE INDEX IF NOT EXISTS idx_nodes_status ON nodes (status);
      CREATE INDEX IF NOT EXISTS idx_nodes_owner ON nodes (owner_user_id);

      CREATE UNIQUE INDEX IF NOT EXISTS idx_node_orders_public_id ON node_orders (public_order_id);
      CREATE UNIQUE INDEX IF NOT EXISTS idx_node_orders_idempotency ON node_orders (idempotency_key) WHERE idempotency_key IS NOT NULL AND idempotency_key != '';
      CREATE INDEX IF NOT EXISTS idx_node_orders_user ON node_orders (user_id);
      CREATE INDEX IF NOT EXISTS idx_node_orders_status ON node_orders (status);
      CREATE INDEX IF NOT EXISTS idx_node_orders_node_id ON node_orders (node_id);
      CREATE INDEX IF NOT EXISTS idx_node_orders_expires_at ON node_orders (expires_at);

      CREATE UNIQUE INDEX IF NOT EXISTS idx_referral_commissions_public_id ON referral_commissions (public_commission_id);
      CREATE UNIQUE INDEX IF NOT EXISTS idx_referral_commissions_node_id ON referral_commissions (node_id);
      CREATE INDEX IF NOT EXISTS idx_referral_commissions_sponsor ON referral_commissions (sponsor_user_id);
      CREATE INDEX IF NOT EXISTS idx_referral_commissions_referred ON referral_commissions (referred_user_id);
      CREATE INDEX IF NOT EXISTS idx_referral_commissions_order ON referral_commissions (node_order_id);
      CREATE INDEX IF NOT EXISTS idx_referral_commissions_status ON referral_commissions (status);

      CREATE UNIQUE INDEX IF NOT EXISTS idx_binary_parent_side ON binary_placements (parent_user_id, side) WHERE parent_user_id IS NOT NULL AND side IS NOT NULL;
      CREATE INDEX IF NOT EXISTS idx_binary_placements_parent ON binary_placements (parent_user_id);
      CREATE INDEX IF NOT EXISTS idx_binary_placements_status ON binary_placements (status);

      -- Task #10: Indexes for binary volume engine
      CREATE INDEX IF NOT EXISTS idx_bve_beneficiary ON binary_volume_events (beneficiary_user_id);
      CREATE INDEX IF NOT EXISTS idx_bve_source_user ON binary_volume_events (source_user_id);
      CREATE INDEX IF NOT EXISTS idx_bve_source_node ON binary_volume_events (source_node_id);
      CREATE INDEX IF NOT EXISTS idx_bve_business_date ON binary_volume_events (business_date);
      CREATE INDEX IF NOT EXISTS idx_bve_status ON binary_volume_events (status);
      CREATE INDEX IF NOT EXISTS idx_bve_beneficiary_date ON binary_volume_events (beneficiary_user_id, business_date);

      CREATE INDEX IF NOT EXISTS idx_bdv_user_date ON binary_daily_volumes (user_id, business_date);
    `);

    // 3. Backfill existing users with missing public_id, user_referrals, and binary_placements
    await backfillExistingUsers(client);

    // 4. Seed Genesis Nodes inventory (10,000 nodes)
    await seedGenesisNodes(client);

    console.log('[DB] PostgreSQL schema & Task #6 Genesis Node migrations initialized successfully.');
  } catch (err) {
    console.error('[DB] Error initializing schema:', err);
    throw err;
  }
}

/**
 * Backfill existing users:
 * 1. Assign public_id if missing
 * 2. Assign referral_code in user_referrals if missing
 * 3. Resolve pending_referral_code if sponsor relationship not yet set
 */
async function backfillExistingUsers(client: DatabaseClient) {
  try {
    // 1. Users missing public_id
    const usersMissingPublicId = await client.query<{ id: string }>(
      `SELECT id FROM users WHERE public_id IS NULL OR public_id = ''`
    );

    for (const u of usersMissingPublicId.rows) {
      let assigned = false;
      while (!assigned) {
        const candidate = generatePublicId();
        const existing = await client.query(`SELECT 1 FROM users WHERE public_id = $1`, [candidate]);
        if (existing.rowCount === 0) {
          await client.query(`UPDATE users SET public_id = $1 WHERE id = $2`, [candidate, u.id]);
          assigned = true;
        }
      }
    }

    // 2. Users missing user_referrals row
    const usersMissingReferralRow = await client.query<{ id: string; pending_referral_code: string | null }>(
      `SELECT u.id, u.pending_referral_code 
       FROM users u 
       LEFT JOIN user_referrals r ON u.id = r.user_id 
       WHERE r.user_id IS NULL`
    );

    for (const u of usersMissingReferralRow.rows) {
      let codeAssigned = false;
      let newReferralCode = '';
      while (!codeAssigned) {
        const candidate = generateReferralCode();
        const existing = await client.query(`SELECT 1 FROM user_referrals WHERE referral_code = $1`, [candidate]);
        if (existing.rowCount === 0) {
          newReferralCode = candidate;
          codeAssigned = true;
        }
      }

      await client.query(
        `INSERT INTO user_referrals (user_id, referral_code, sponsor_user_id, created_at)
         VALUES ($1, $2, NULL, CURRENT_TIMESTAMP)`,
        [u.id, newReferralCode]
      );
    }

    // 3. Resolve pending_referral_code for users who do not have a sponsor_user_id yet
    const pendingUsers = await client.query<{ id: string; pending_referral_code: string }>(
      `SELECT u.id, u.pending_referral_code 
       FROM users u 
       JOIN user_referrals r ON u.id = r.user_id 
       WHERE u.pending_referral_code IS NOT NULL 
         AND u.pending_referral_code != '' 
         AND r.sponsor_user_id IS NULL`
    );

    for (const u of pendingUsers.rows) {
      const normCode = normalizeReferralCode(u.pending_referral_code);
      const sponsorResult = await client.query<{ user_id: string }>(
        `SELECT user_id FROM user_referrals WHERE referral_code = $1`,
        [normCode]
      );

      if (sponsorResult.rowCount > 0) {
        const sponsorUserId = sponsorResult.rows[0].user_id;
        if (sponsorUserId !== u.id) {
          await client.query(
            `UPDATE user_referrals SET sponsor_user_id = $1 WHERE user_id = $2`,
            [sponsorUserId, u.id]
          );
          await client.query(
            `UPDATE users SET pending_referral_code = NULL WHERE id = $1`,
            [u.id]
          );
          console.log(`[DB Migration] Resolved pending referral code ${normCode} for user ${u.id}`);
        }
      } else {
        console.log(`[DB Migration] Pending referral code ${normCode} for user ${u.id} could not be resolved (invalid code).`);
      }
    }

    // 4. Ensure all users exist in binary_placements (UNPLACED by default)
    await client.exec(`
      INSERT INTO binary_placements (user_id, parent_user_id, side, status, placed_at, created_at)
      SELECT u.id, NULL, NULL, 'UNPLACED', NULL, u.created_at
      FROM users u
      LEFT JOIN binary_placements bp ON u.id = bp.user_id
      WHERE bp.user_id IS NULL
      ON CONFLICT (user_id) DO NOTHING;
    `);

    // 5. Ensure all users have binary_volume_balances row initialized
    await client.exec(`
      INSERT INTO binary_volume_balances (user_id, carry_left_units, carry_right_units, updated_at)
      SELECT u.id, 0, 0, CURRENT_TIMESTAMP
      FROM users u
      LEFT JOIN binary_volume_balances bvb ON u.id = bvb.user_id
      WHERE bvb.user_id IS NULL
      ON CONFLICT (user_id) DO NOTHING;
    `);
  } catch (err) {
    console.error('[DB Migration] Error during backfill of existing users:', err);
  }
}

/**
 * Seed Genesis Nodes inventory (1 to 10,000) idempotently (Task #6)
 */
async function seedGenesisNodes(client: DatabaseClient) {
  try {
    const countRes = await client.query<{ count: string | number }>(
      `SELECT COUNT(*)::int AS count FROM nodes`
    );
    const currentCount = parseInt(String(countRes.rows[0]?.count || '0'), 10);

    if (currentCount < GENESIS_NODE_CAP) {
      console.log(`[DB Migration] Seeding Genesis Nodes inventory (${currentCount}/${GENESIS_NODE_CAP} existing)...`);

      try {
        // Fast PostgreSQL / PGlite batch insertion with generate_series
        await client.exec(`
          INSERT INTO nodes (id, node_number, public_node_id, status, created_at, updated_at)
          SELECT 
            gen_random_uuid(),
            s.n,
            'PHX-NODE-' || LPAD(s.n::text, 6, '0'),
            'AVAILABLE',
            CURRENT_TIMESTAMP,
            CURRENT_TIMESTAMP
          FROM generate_series(1, ${GENESIS_NODE_CAP}) AS s(n)
          ON CONFLICT (node_number) DO NOTHING;
        `);
      } catch (sqlErr) {
        console.warn('[DB Migration] SQL generate_series fallback to batch chunks:', sqlErr);
        const batchSize = 500;
        for (let start = 1; start <= GENESIS_NODE_CAP; start += batchSize) {
          const end = Math.min(start + batchSize - 1, GENESIS_NODE_CAP);
          const values: any[] = [];
          const placeholders: string[] = [];
          let paramIdx = 1;

          for (let n = start; n <= end; n++) {
            const id = uuidv4();
            const publicId = formatPublicNodeId(n);
            placeholders.push(`($${paramIdx}, $${paramIdx + 1}, $${paramIdx + 2}, 'AVAILABLE', CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)`);
            values.push(id, n, publicId);
            paramIdx += 3;
          }

          await client.query(
            `INSERT INTO nodes (id, node_number, public_node_id, status, created_at, updated_at)
             VALUES ${placeholders.join(', ')}
             ON CONFLICT (node_number) DO NOTHING`,
            values
          );
        }
      }

      const finalCountRes = await client.query<{ count: string | number }>(
        `SELECT COUNT(*)::int AS count FROM nodes`
      );
      console.log(`[DB Migration] Genesis Nodes inventory active: ${finalCountRes.rows[0]?.count} total nodes.`);
    }
  } catch (err) {
    console.error('[DB Migration] Error during Genesis Nodes seeding:', err);
  }
}

