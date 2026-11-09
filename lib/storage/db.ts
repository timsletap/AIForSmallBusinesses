import { promises as fs } from "fs";
import path from "path";
import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import { DiscoveryRun, Tool } from "@/lib/schemas/tool";
import { domainKey } from "@/lib/discovery/canonical";

/**
 * Storage interface. Uses Supabase when SUPABASE keys are set; otherwise a JSON file in /data
 * (committed, so the seeded database ships with the deploy). On a read-only filesystem the JSON
 * store keeps writes in memory for the life of the server instance.
 */
export interface Store {
  listTools(opts?: { status?: Tool["status"] }): Promise<Tool[]>;
  getTool(idOrSlug: string): Promise<Tool | null>;
  getToolByDomain(url: string): Promise<Tool | null>;
  saveTool(tool: Tool): Promise<void>;
  createRun(run: DiscoveryRun): Promise<void>;
  saveRun(run: DiscoveryRun): Promise<void>;
  listRuns(limit?: number): Promise<DiscoveryRun[]>;
}

class SupabaseStore implements Store {
  constructor(private sb: SupabaseClient) {}

  async listTools(opts: { status?: Tool["status"] } = {}) {
    let q = this.sb.from("tools").select("*").order("name");
    if (opts.status) q = q.eq("status", opts.status);
    const { data, error } = await q;
    if (error) throw new Error(error.message);
    return (data ?? []).map((r) => Tool.parse(r));
  }
  async getTool(idOrSlug: string) {
    const col = /^[0-9a-f-]{36}$/.test(idOrSlug) ? "id" : "slug";
    const { data, error } = await this.sb.from("tools").select("*").eq(col, idOrSlug).maybeSingle();
    if (error) throw new Error(error.message);
    return data ? Tool.parse(data) : null;
  }
  async getToolByDomain(url: string) {
    const d = domainKey(url);
    if (!d) return null;
    const { data, error } = await this.sb.from("tools").select("*").eq("canonical_url", `https://${d}`).maybeSingle();
    if (error) throw new Error(error.message);
    return data ? Tool.parse(data) : null;
  }
  async saveTool(tool: Tool) {
    const { error } = await this.sb.from("tools").upsert(tool, { onConflict: "id" });
    if (error) throw new Error(error.message);
  }
  async createRun(run: DiscoveryRun) {
    const { error } = await this.sb.from("discovery_runs").insert(run);
    if (error) throw new Error(error.message);
  }
  async saveRun(run: DiscoveryRun) {
    const { error } = await this.sb.from("discovery_runs").upsert(run);
    if (error) throw new Error(error.message);
  }
  async listRuns(limit = 10) {
    const { data, error } = await this.sb
      .from("discovery_runs")
      .select("*")
      .order("started_at", { ascending: false })
      .limit(limit);
    if (error) throw new Error(error.message);
    return (data ?? []).map((r) => DiscoveryRun.parse(r));
  }
}

const DATA_DIR = path.join(process.cwd(), "data");
const TOOLS_FILE = path.join(DATA_DIR, "tools.json");
const RUNS_FILE = path.join(DATA_DIR, "runs.json");

/** Write to a temp file then rename, so readers never see a half-written file. */
async function writeAtomic(file: string, body: string) {
  const tmp = `${file}.${process.pid}.tmp`;
  await fs.writeFile(tmp, body);
  await fs.rename(tmp, file);
}

export class StorageNotConfiguredError extends Error {
  constructor() {
    super("Saving is turned off: this server has no database configured (set the Supabase environment variables).");
  }
}

class JsonStore implements Store {
  private tools: Tool[] | null = null;
  private runs: DiscoveryRun[] | null = null;

  /** readOnly: hosted servers without a database. Writes must fail loudly, never vanish into memory. */
  constructor(private readOnly = false) {}

  private async load() {
    if (!this.tools) {
      try {
        this.tools = Tool.array().parse(JSON.parse(await fs.readFile(TOOLS_FILE, "utf8")));
      } catch {
        this.tools = [];
      }
    }
    if (!this.runs) {
      try {
        this.runs = DiscoveryRun.array().parse(JSON.parse(await fs.readFile(RUNS_FILE, "utf8")));
      } catch {
        this.runs = [];
      }
    }
    return { tools: this.tools, runs: this.runs };
  }
  private async persist() {
    if (this.readOnly) throw new StorageNotConfiguredError();
    // Any write failure propagates: a save that didn't reach disk must not be reported as success.
    await fs.mkdir(DATA_DIR, { recursive: true });
    const sorted = [...(this.tools ?? [])].sort((a, b) => a.slug.localeCompare(b.slug));
    await writeAtomic(TOOLS_FILE, JSON.stringify(sorted, null, 2) + "\n");
    await writeAtomic(RUNS_FILE, JSON.stringify((this.runs ?? []).slice(0, 50), null, 2) + "\n");
  }

  async listTools(opts: { status?: Tool["status"] } = {}) {
    const { tools } = await this.load();
    return tools.filter((t) => !opts.status || t.status === opts.status).sort((a, b) => a.name.localeCompare(b.name));
  }
  async getTool(idOrSlug: string) {
    const { tools } = await this.load();
    return tools.find((t) => t.id === idOrSlug || t.slug === idOrSlug) ?? null;
  }
  async getToolByDomain(url: string) {
    const d = domainKey(url);
    const { tools } = await this.load();
    return tools.find((t) => domainKey(t.canonical_url) === d) ?? null;
  }
  async saveTool(tool: Tool) {
    if (this.readOnly) throw new StorageNotConfiguredError();
    const { tools } = await this.load();
    const i = tools.findIndex((t) => t.id === tool.id);
    if (i >= 0) tools[i] = tool;
    else tools.push(tool);
    await this.persist();
  }
  async createRun(run: DiscoveryRun) {
    if (this.readOnly) throw new StorageNotConfiguredError();
    const { runs } = await this.load();
    runs.unshift(run);
    await this.persist();
  }
  async saveRun(run: DiscoveryRun) {
    if (this.readOnly) throw new StorageNotConfiguredError();
    const { runs } = await this.load();
    const i = runs.findIndex((r) => r.id === run.id);
    if (i >= 0) runs[i] = run;
    else runs.unshift(run);
    await this.persist();
  }
  async listRuns(limit = 10) {
    const { runs } = await this.load();
    return runs.slice(0, limit);
  }
}

let store: Store | null = null;

export function getStore(): Store {
  if (store) return store;
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  // On Vercel the filesystem is ephemeral, so without Supabase the JSON store is read-only and writes throw.
  store = url && key ? new SupabaseStore(createClient(url, key, { auth: { persistSession: false } })) : new JsonStore(!!process.env.VERCEL);
  return store;
}

export const storageMode = () =>
  process.env.NEXT_PUBLIC_SUPABASE_URL && process.env.SUPABASE_SERVICE_ROLE_KEY ? "supabase" : "json";
