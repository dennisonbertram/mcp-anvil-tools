import Database from "better-sqlite3";
import { join } from "path";

const DB_PATH =
  process.env.AUDIT_MCP_DB_PATH || join(process.cwd(), "audit-mcp.db");

export class StateManager {
  private db: Database.Database;

  constructor(dbPath: string = DB_PATH) {
    this.db = new Database(dbPath);

    // Enable SQLite optimizations
    this.db.pragma("foreign_keys = ON");
    this.db.pragma("journal_mode = WAL");

    this.initializeSchema();
  }

  private initializeSchema() {
    // Deployments table
    this.db.exec(`
      CREATE TABLE IF NOT EXISTS deployments (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        address TEXT NOT NULL UNIQUE,
        contract_name TEXT NOT NULL,
        network TEXT NOT NULL,
        deployed_at TEXT NOT NULL,
        deployer TEXT,
        transaction_hash TEXT,
        abi TEXT NOT NULL,
        source_code TEXT NOT NULL,
        constructor_args TEXT,
        compiler TEXT,
        optimization INTEGER,
        created_at TEXT DEFAULT CURRENT_TIMESTAMP
      );

      CREATE INDEX IF NOT EXISTS idx_deployments_address ON deployments(address);
      CREATE INDEX IF NOT EXISTS idx_deployments_network ON deployments(network);
    `);

    // Anvil instances table
    this.db.exec(`
      CREATE TABLE IF NOT EXISTS anvil_instances (
        id TEXT PRIMARY KEY,
        port INTEGER NOT NULL UNIQUE,
        status TEXT NOT NULL,
        forked_from TEXT,
        chain_id INTEGER,
        started_at TEXT NOT NULL,
        stopped_at TEXT,
        pid INTEGER,
        created_at TEXT DEFAULT CURRENT_TIMESTAMP
      );

      CREATE INDEX IF NOT EXISTS idx_anvil_status ON anvil_instances(status);
    `);

    // Audit sessions table
    this.db.exec(`
      CREATE TABLE IF NOT EXISTS audit_sessions (
        id TEXT PRIMARY KEY,
        contract_address TEXT NOT NULL,
        network TEXT NOT NULL,
        started_at TEXT NOT NULL,
        ended_at TEXT,
        agent_name TEXT,
        created_at TEXT DEFAULT CURRENT_TIMESTAMP
      );

      CREATE INDEX IF NOT EXISTS idx_audit_sessions_contract ON audit_sessions(contract_address);
    `);

    // Audit findings table
    this.db.exec(`
      CREATE TABLE IF NOT EXISTS audit_findings (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        session_id TEXT NOT NULL,
        severity TEXT NOT NULL,
        title TEXT NOT NULL,
        description TEXT NOT NULL,
        location TEXT,
        recommendation TEXT,
        found_at TEXT NOT NULL,
        created_at TEXT DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (session_id) REFERENCES audit_sessions(id)
      );

      CREATE INDEX IF NOT EXISTS idx_audit_findings_session ON audit_findings(session_id);
      CREATE INDEX IF NOT EXISTS idx_audit_findings_severity ON audit_findings(severity);
    `);

    // Audit notes table
    this.db.exec(`
      CREATE TABLE IF NOT EXISTS audit_notes (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        session_id TEXT NOT NULL,
        content TEXT NOT NULL,
        created_at TEXT DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (session_id) REFERENCES audit_sessions(id)
      );

      CREATE INDEX IF NOT EXISTS idx_audit_notes_session ON audit_notes(session_id);
    `);
  }

  // Deployment methods
  async saveDeployment(deployment: DeploymentInfo): Promise<void> {
    const stmt = this.db.prepare(`
      INSERT INTO deployments (
        address, contract_name, network, deployed_at, deployer,
        transaction_hash, abi, source_code, constructor_args,
        compiler, optimization
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      ON CONFLICT(address) DO UPDATE SET
        contract_name = excluded.contract_name,
        abi = excluded.abi,
        source_code = excluded.source_code
    `);

    stmt.run(
      deployment.address,
      deployment.contractName,
      deployment.network,
      deployment.deployedAt,
      deployment.deployer,
      deployment.transactionHash,
      JSON.stringify(deployment.abi),
      deployment.sourceCode,
      JSON.stringify(deployment.constructorArgs || []),
      deployment.compiler,
      deployment.optimization ? 1 : 0
    );
  }

  async getDeployment(address: string): Promise<DeploymentInfo | null> {
    const stmt = this.db.prepare(`
      SELECT * FROM deployments WHERE address = ?
    `);

    const row = stmt.get(address) as any;
    if (!row) return null;

    return {
      address: row.address,
      contractName: row.contract_name,
      network: row.network,
      deployedAt: row.deployed_at,
      deployer: row.deployer,
      transactionHash: row.transaction_hash,
      abi: JSON.parse(row.abi),
      sourceCode: row.source_code,
      constructorArgs: JSON.parse(row.constructor_args || "[]"),
      compiler: row.compiler,
      optimization: row.optimization === 1,
    };
  }

  async listDeployments(network?: string): Promise<DeploymentInfo[]> {
    const stmt = network
      ? this.db.prepare(
          `SELECT * FROM deployments WHERE network = ? ORDER BY created_at DESC`
        )
      : this.db.prepare(`SELECT * FROM deployments ORDER BY created_at DESC`);

    const rows = network ? stmt.all(network) : stmt.all();

    return (rows as any[]).map((row) => ({
      address: row.address,
      contractName: row.contract_name,
      network: row.network,
      deployedAt: row.deployed_at,
      deployer: row.deployer,
      transactionHash: row.transaction_hash,
      abi: JSON.parse(row.abi),
      sourceCode: row.source_code,
      constructorArgs: JSON.parse(row.constructor_args || "[]"),
      compiler: row.compiler,
      optimization: row.optimization === 1,
    }));
  }

  // Anvil instance methods
  async saveAnvilInstance(instance: AnvilInstanceInfo): Promise<void> {
    const stmt = this.db.prepare(`
      INSERT INTO anvil_instances (
        id, port, status, forked_from, chain_id, started_at, pid
      ) VALUES (?, ?, ?, ?, ?, ?, ?)
    `);

    stmt.run(
      instance.id,
      instance.port,
      instance.status,
      instance.forkedFrom || null,
      instance.chainId || null,
      instance.startedAt,
      instance.pid || null
    );
  }

  async updateAnvilStatus(
    id: string,
    status: string,
    stoppedAt?: string
  ): Promise<void> {
    const stmt = this.db.prepare(`
      UPDATE anvil_instances
      SET status = ?, stopped_at = ?
      WHERE id = ?
    `);

    stmt.run(status, stoppedAt || null, id);
  }

  async getAnvilInstance(id: string): Promise<AnvilInstanceInfo | null> {
    const stmt = this.db.prepare(`
      SELECT * FROM anvil_instances WHERE id = ?
    `);

    const row = stmt.get(id) as any;
    if (!row) return null;

    return {
      id: row.id,
      port: row.port,
      status: row.status,
      forkedFrom: row.forked_from,
      chainId: row.chain_id,
      startedAt: row.started_at,
      stoppedAt: row.stopped_at,
      pid: row.pid,
    };
  }

  async listAnvilInstances(status?: string): Promise<AnvilInstanceInfo[]> {
    const stmt = status
      ? this.db.prepare(
          `SELECT * FROM anvil_instances WHERE status = ? ORDER BY started_at DESC`
        )
      : this.db.prepare(
          `SELECT * FROM anvil_instances ORDER BY started_at DESC`
        );

    const rows = status ? stmt.all(status) : stmt.all();

    return (rows as any[]).map((row) => ({
      id: row.id,
      port: row.port,
      status: row.status,
      forkedFrom: row.forked_from,
      chainId: row.chain_id,
      startedAt: row.started_at,
      stoppedAt: row.stopped_at,
      pid: row.pid,
    }));
  }

  // Audit session methods
  async createAuditSession(session: AuditSessionInfo): Promise<void> {
    const stmt = this.db.prepare(`
      INSERT INTO audit_sessions (
        id, contract_address, network, started_at, agent_name
      ) VALUES (?, ?, ?, ?, ?)
    `);

    stmt.run(
      session.id,
      session.contractAddress,
      session.network,
      session.startedAt,
      session.agentName || null
    );
  }

  async saveAuditFinding(
    sessionId: string,
    finding: AuditFinding
  ): Promise<void> {
    const stmt = this.db.prepare(`
      INSERT INTO audit_findings (
        session_id, severity, title, description, location, recommendation, found_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?)
    `);

    stmt.run(
      sessionId,
      finding.severity,
      finding.title,
      finding.description,
      finding.location || null,
      finding.recommendation || null,
      finding.foundAt
    );
  }

  async getAuditFindings(sessionId: string): Promise<AuditFinding[]> {
    const stmt = this.db.prepare(`
      SELECT * FROM audit_findings WHERE session_id = ? ORDER BY found_at ASC
    `);

    const rows = stmt.all(sessionId) as any[];

    return rows.map((row) => ({
      severity: row.severity,
      title: row.title,
      description: row.description,
      location: row.location,
      recommendation: row.recommendation,
      foundAt: row.found_at,
    }));
  }

  async getAuditNotes(sessionId: string): Promise<any[]> {
    const stmt = this.db.prepare(`
      SELECT * FROM audit_notes WHERE session_id = ? ORDER BY created_at ASC
    `);
    return stmt.all(sessionId);
  }

  async listAuditSessions(): Promise<any[]> {
    const stmt = this.db.prepare(`
      SELECT * FROM audit_sessions ORDER BY started_at DESC
    `);
    return stmt.all();
  }

  close() {
    this.db.close();
  }
}

// Types
export interface DeploymentInfo {
  address: string;
  contractName: string;
  network: string;
  deployedAt: string;
  deployer?: string;
  transactionHash?: string;
  abi: any[];
  sourceCode: string;
  constructorArgs?: any[];
  compiler?: string;
  optimization?: boolean;
}

export interface AnvilInstanceInfo {
  id: string;
  port: number;
  status: "starting" | "running" | "stopped" | "orphaned" | "error";
  forkedFrom?: string;
  chainId?: number;
  startedAt: string;
  stoppedAt?: string;
  pid?: number;
}

export interface AuditSessionInfo {
  id: string;
  contractAddress: string;
  network: string;
  startedAt: string;
  agentName?: string;
}

export interface AuditFinding {
  severity: "critical" | "high" | "medium" | "low" | "info";
  title: string;
  description: string;
  location?: string;
  recommendation?: string;
  foundAt: string;
}

// Singleton instance
let stateManager: StateManager | null = null;

export function getStateManager(): StateManager {
  if (!stateManager) {
    stateManager = new StateManager();
  }
  return stateManager;
}
