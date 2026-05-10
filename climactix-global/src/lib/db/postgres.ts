/**
 * PostgreSQL connection utility (server-only).
 *
 * Uses the native pg module via dynamic require so that it is only loaded
 * in the Node.js runtime and never bundled for the browser.
 *
 * Production: set DATABASE_URL in your environment.
 * Development: uses the Docker Compose default from docker-compose.yml.
 *
 * NOTE: Install `pg` and `@types/pg` when ready to activate:
 *   npm install pg @types/pg
 */

type PoolClient = {
  query: (sql: string, params?: unknown[]) => Promise<{ rows: unknown[] }>;
  end: () => Promise<void>;
};

let _pool: PoolClient | null = null;

function getPool(): PoolClient | null {
  if (_pool) return _pool;

  try {
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const { Pool } = require("pg");
    _pool = new Pool({
      connectionString:
        process.env.DATABASE_URL ??
        "postgresql://climactix:climactix@localhost:5432/climactix",
      max: 10,
      idleTimeoutMillis: 30000,
      connectionTimeoutMillis: 5000,
    });
    return _pool;
  } catch {
    return null;
  }
}

export async function query<T = unknown>(
  sql: string,
  params: unknown[] = []
): Promise<T[]> {
  const pool = getPool();
  if (!pool) {
    // pg not installed yet — return empty
    return [];
  }
  const result = await pool.query(sql, params);
  return result.rows as T[];
}

export async function queryOne<T = unknown>(
  sql: string,
  params: unknown[] = []
): Promise<T | null> {
  const rows = await query<T>(sql, params);
  return rows[0] ?? null;
}

// ── Company helpers ───────────────────────────────────────────────────────────

export interface DBCompany {
  id: string;
  name: string;
  ticker: string | null;
  sector: string | null;
  country_code: string | null;
  revenue_usd_m: number | null;
}

export async function getCompanies(): Promise<DBCompany[]> {
  return query<DBCompany>(
    "SELECT id, name, ticker, sector, country_code, revenue_usd_m FROM companies ORDER BY name LIMIT 100"
  );
}

export async function getCompanyById(id: string): Promise<DBCompany | null> {
  return queryOne<DBCompany>(
    "SELECT id, name, ticker, sector, country_code, revenue_usd_m FROM companies WHERE id = $1",
    [id]
  );
}

// ── ESG Score helpers ─────────────────────────────────────────────────────────

export interface DBEsgScore {
  id: string;
  company_id: string;
  assessment_date: string;
  environmental: number;
  social: number;
  governance: number;
  overall: number;
  esg_rating: string;
}

export async function getLatestEsgScore(companyId: string): Promise<DBEsgScore | null> {
  return queryOne<DBEsgScore>(
    `SELECT * FROM esg_scores WHERE company_id = $1 ORDER BY assessment_date DESC LIMIT 1`,
    [companyId]
  );
}

// ── Climate signals helper ────────────────────────────────────────────────────

export interface DBClimateSignal {
  time: string;
  signal_type: string;
  region: string;
  value: number;
  unit: string;
  source: string;
}

export async function getRecentSignals(
  signalType: string,
  limit = 50
): Promise<DBClimateSignal[]> {
  return query<DBClimateSignal>(
    `SELECT time, signal_type, region, value, unit, source
     FROM climate_signals
     WHERE signal_type = $1
     ORDER BY time DESC
     LIMIT $2`,
    [signalType, limit]
  );
}
