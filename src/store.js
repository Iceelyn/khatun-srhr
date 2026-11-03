// Tiny storage layer with two back ends:
//   1. Local JSONL file (default). Fine for running on a laptop.
//   2. Supabase (Postgres) via its REST API, when SUPABASE_URL and SUPABASE_SERVICE_KEY are set.
//      Use this when the app is hosted: free hosting (e.g. Render free tier) wipes local files
//      on every restart, so feedback would be lost.
//
// The Supabase key is used ONLY on the server and is never sent to the browser.
// Tables are created with db/schema.sql (Row Level Security on, no public policies).

import { appendFileSync, existsSync, readFileSync, writeFileSync, mkdirSync } from 'node:fs';
import { dirname } from 'node:path';
import { randomUUID } from 'node:crypto';

export function createStore({ table, path, supabaseUrl, supabaseKey }) {
  if (supabaseUrl && supabaseKey) return supabaseStore(table, supabaseUrl.replace(/\/$/, ''), supabaseKey);
  return fileStore(path);
}

function fileStore(path) {
  const readAll = () => {
    if (!existsSync(path)) return [];
    const rows = [];
    for (const line of readFileSync(path, 'utf8').split('\n')) {
      if (!line.trim()) continue;
      try {
        rows.push(JSON.parse(line));
      } catch {
        /* skip a damaged line */
      }
    }
    return rows;
  };
  const writeAll = (rows) => writeFileSync(path, rows.map((r) => JSON.stringify(r)).join('\n') + (rows.length ? '\n' : ''));
  mkdirSync(dirname(path), { recursive: true });

  return {
    kind: 'file',
    async ping() {
      return { ok: true };
    },
    async insert(row) {
      const full = { id: randomUUID(), created_at: new Date().toISOString(), ...row };
      appendFileSync(path, JSON.stringify(full) + '\n');
      return full;
    },
    async list() {
      return readAll().sort((a, b) => String(b.created_at).localeCompare(String(a.created_at)));
    },
    async update(id, patch) {
      const rows = readAll();
      const i = rows.findIndex((r) => r.id === id);
      if (i < 0) return null;
      rows[i] = { ...rows[i], ...patch };
      writeAll(rows);
      return rows[i];
    },
    async remove(id) {
      const rows = readAll();
      const kept = rows.filter((r) => r.id !== id);
      writeAll(kept);
      return kept.length !== rows.length;
    },
  };
}

function supabaseStore(table, base, key) {
  const url = `${base}/rest/v1/${table}`;
  const headers = { apikey: key, authorization: `Bearer ${key}`, 'content-type': 'application/json' };
  const call = async (u, opts) => {
    const res = await fetch(u, { ...opts, headers: { ...headers, ...(opts?.headers || {}) } });
    if (!res.ok) throw new Error(`Supabase ${table} ${opts?.method || 'GET'} failed: ${res.status} ${await res.text()}`);
    const text = await res.text();
    return text ? JSON.parse(text) : null;
  };
  return {
    kind: 'supabase',
    // Cheap connection test for /health: reads one id. Never returns the key.
    async ping() {
      try {
        await call(`${url}?select=id&limit=1`, { method: 'GET' });
        return { ok: true };
      } catch (err) {
        return { ok: false, hint: explainSupabaseError(err.message) };
      }
    },
    async insert(row) {
      const out = await call(url, { method: 'POST', headers: { prefer: 'return=representation' }, body: JSON.stringify(row) });
      return out?.[0] ?? row;
    },
    async list() {
      return call(`${url}?select=*&order=created_at.desc`, { method: 'GET' });
    },
    async update(id, patch) {
      const out = await call(`${url}?id=eq.${encodeURIComponent(id)}`, {
        method: 'PATCH',
        headers: { prefer: 'return=representation' },
        body: JSON.stringify(patch),
      });
      return out?.[0] ?? null;
    },
    async remove(id) {
      await call(`${url}?id=eq.${encodeURIComponent(id)}`, { method: 'DELETE' });
      return true;
    },
  };
}

// Turns a Supabase error into a plain fix the team can act on.
export function explainSupabaseError(message = '') {
  const m = String(message);
  if (/42P01|does not exist|PGRST205|schema cache/i.test(m))
    return 'The database tables are missing. In Supabase open SQL Editor, paste db/schema.sql and click Run.';
  if (/\b401\b|\b403\b|Invalid API key|JWT|permission denied/i.test(m))
    return 'Supabase rejected the key. Set SUPABASE_SERVICE_KEY to the service_role key (Project Settings > API Keys > Legacy API keys), not the anon key, then redeploy.';
  if (/fetch failed|ENOTFOUND|getaddrinfo|Invalid URL/i.test(m))
    return 'The server could not reach Supabase. Check SUPABASE_URL looks like https://xxxx.supabase.co (no extra path), then redeploy.';
  return 'Database error. Check SUPABASE_URL and SUPABASE_SERVICE_KEY, and that db/schema.sql was run.';
}
