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
  if (supabaseUrl && supabaseKey) return supabaseStore(table, normalizeSupabaseUrl(supabaseUrl), cleanKey(supabaseKey));
  return fileStore(path);
}

// Common copy-paste mistakes: spaces or quotes around the value, a trailing slash, the REST path
// (https://x.supabase.co/rest/v1/) or the dashboard address (supabase.com/dashboard/project/x).
export function normalizeSupabaseUrl(raw) {
  let u = String(raw).trim().replace(/^['"]|['"]$/g, '').trim();
  const dash = u.match(/supabase\.com\/dashboard\/project\/([a-z0-9]+)/i);
  if (dash) return `https://${dash[1]}.supabase.co`;
  if (!/^https?:\/\//i.test(u)) u = `https://${u}`;
  return u.replace(/\/+$/, '').replace(/\/rest\/v1$/i, '').replace(/\/+$/, '');
}

export function cleanKey(raw) {
  return String(raw).trim().replace(/^['"]|['"]$/g, '').replace(/^Bearer\s+/i, '').replace(/\s+/g, '');
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
    // Columns the table turned out not to have (e.g. db/schema.sql not re-run after new survey
    // questions). Insert drops them and retries, so one missing column never loses a whole answer.
    missingColumns: new Set(),
    async insert(row) {
      // Always try the full answer first, so columns added later (schema.sql re-run) are used at once.
      const body = { ...row };
      const dropped = new Set();
      for (let tries = 0; tries < 40; tries++) {
        try {
          const out = await call(url, { method: 'POST', headers: { prefer: 'return=representation' }, body: JSON.stringify(body) });
          this.missingColumns = dropped; // reflects the database as it is now
          return out?.[0] ?? body;
        } catch (err) {
          const col = missingColumnName(err.message);
          if (!col || !(col in body)) throw err;
          dropped.add(col);
          delete body[col];
          console.error(`Supabase ${table}: column "${col}" is missing; saved the answer without it. Run db/schema.sql to add it.`);
        }
      }
      throw new Error(`Supabase ${table} insert failed: too many missing columns`);
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

// Name of the column a Supabase/Postgres error says is missing, or null.
export function missingColumnName(message = '') {
  const m = String(message);
  return (m.match(/Could not find the '([^']+)' column/i) || m.match(/column "([^"]+)" of relation "[^"]+" does not exist/i) || [])[1] || null;
}

// Turns a Supabase error into a plain fix the team can act on.
export function explainSupabaseError(message = '') {
  const m = String(message);
  if (/PGRST204|Could not find the '.*' column/i.test(m))
    return 'The database is missing columns for the latest survey questions. In Supabase open SQL Editor, paste the latest db/schema.sql and click Run.';
  if (/42P01|does not exist|PGRST205|schema cache|Could not find the table/i.test(m))
    return 'The database tables are missing. In Supabase open SQL Editor, paste db/schema.sql and click Run.';
  if (/42501|permission denied/i.test(m))
    return 'The tables exist but the server is not allowed to use them. Run db/schema.sql again in the Supabase SQL Editor (it now includes the GRANT lines), and make sure SUPABASE_SERVICE_KEY is the service_role key.';
  if (/\b401\b|\b403\b|Invalid API key|JWT|No API key|Unregistered API key/i.test(m))
    return 'Supabase rejected the key. Set SUPABASE_SERVICE_KEY to the service_role key (Project Settings > API Keys > Legacy API keys), not the anon or publishable key, then redeploy.';
  if (/PGRST125|Invalid path|<!doctype|<html|\b404\b/i.test(m))
    return 'SUPABASE_URL points to the wrong address. Use the Project URL only, like https://abcdefgh.supabase.co (Project Settings > Data API), then redeploy.';
  if (/PGRST106|schema must be one of/i.test(m))
    return 'The "public" schema is not exposed. In Supabase: Project Settings > Data API > Exposed schemas: add public.';
  if (/fetch failed|ENOTFOUND|getaddrinfo|Invalid URL|ECONNREFUSED|certificate/i.test(m))
    return 'The server could not reach Supabase. Check SUPABASE_URL looks like https://xxxx.supabase.co, and that the Supabase project is not paused, then redeploy.';
  if (/header|ByteString|character/i.test(m))
    return 'SUPABASE_SERVICE_KEY contains invalid characters. Paste the key again with nothing before or after it, then redeploy.';
  return 'Database error. Check SUPABASE_URL and SUPABASE_SERVICE_KEY, and that db/schema.sql was run.';
}
