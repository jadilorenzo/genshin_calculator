#!/usr/bin/env node
/**
 * Apply is_public migration to the linked Supabase project.
 *
 * Usage (either):
 *   SUPABASE_ACCESS_TOKEN=sbp_... node scripts/applyIsPublicMigration.mjs
 *   SUPABASE_DB_URL='postgresql://postgres....' node scripts/applyIsPublicMigration.mjs
 */
import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { spawnSync } from 'node:child_process'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const root = path.resolve(__dirname, '..')
const sqlPath = path.join(
  root,
  'supabase/migrations/20260723154000_community_rotations_is_public.sql',
)
const sql = fs.readFileSync(sqlPath, 'utf8')
const projectRef =
  fs.existsSync(path.join(root, 'supabase/.temp/project-ref'))
    ? fs.readFileSync(path.join(root, 'supabase/.temp/project-ref'), 'utf8').trim()
    : 'fdzrnuxnaedeolqerxtq'

async function viaManagementApi(token) {
  const response = await fetch(
    `https://api.supabase.com/v1/projects/${projectRef}/database/query`,
    {
      method: 'POST',
      headers: {
        authorization: `Bearer ${token}`,
        'content-type': 'application/json',
      },
      body: JSON.stringify({ query: sql }),
    },
  )
  const body = await response.text()
  if (!response.ok) {
    throw new Error(`Management API ${response.status}: ${body}`)
  }
  console.log('Migration applied via Supabase Management API.')
  console.log(body || 'ok')
}

function viaPsql(dbUrl) {
  const result = spawnSync('psql', [dbUrl, '-v', 'ON_ERROR_STOP=1', '-c', sql], {
    encoding: 'utf8',
  })
  if (result.status !== 0) {
    throw new Error(result.stderr || result.stdout || 'psql failed')
  }
  console.log(result.stdout || 'Migration applied via psql.')
}

async function main() {
  const token = process.env.SUPABASE_ACCESS_TOKEN
  const dbUrl = process.env.SUPABASE_DB_URL || process.env.DATABASE_URL
  if (token) {
    await viaManagementApi(token)
    return
  }
  if (dbUrl) {
    viaPsql(dbUrl)
    return
  }
  console.error(`Missing credentials.

Run one of:

  1) Management API token (Dashboard → Account → Access Tokens):
       SUPABASE_ACCESS_TOKEN=sbp_... node scripts/applyIsPublicMigration.mjs

  2) Database URL (Project Settings → Database → URI):
       SUPABASE_DB_URL='postgresql://postgres....' node scripts/applyIsPublicMigration.mjs

  3) Paste this SQL in the Supabase SQL editor:
${sql}`)
  process.exit(1)
}

main().catch((err) => {
  console.error(err.message || err)
  process.exit(1)
})
