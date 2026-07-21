/**
 * Downloads open gcsim character PRs into GCSIM_CHARS (default /tmp/gcsim-chars)
 * so extractAnimationTimings.mjs can parse frames that are not on main yet.
 *
 *   node scripts/fetchGcsimPrChars.mjs
 *
 * Requires: gh (GitHub CLI) authenticated.
 */
import { execFileSync } from 'node:child_process'
import fs from 'node:fs'
import path from 'node:path'

const DEST =
  process.env.GCSIM_CHARS ||
  (fs.existsSync('/tmp/gcsim-chars') ? '/tmp/gcsim-chars' : '/tmp/gcsim-chars')

/** Open PRs with usable character frame packages (as of last audit). */
const PR_CHARS = [
  { pr: 2374, repo: 'imring/gcsim', branch: 'iansan', char: 'iansan' },
  { pr: 2639, repo: 'Matoba004/gcsim', branch: 'ifa', char: 'ifa' },
  { pr: 2538, repo: 'Khoi0612/gcsim', branch: 'jahoda', char: 'jahoda' },
  { pr: 2587, repo: 'aurceive/gcsim', branch: 'nefer', char: 'nefer' },
  { pr: 2677, repo: 'Matoba004/gcsim', branch: 'illuga', char: 'illuga' },
  { pr: 2668, repo: 'Charlie-Zheng/gcsim', branch: 'varka-dev', char: 'varka' },
  { pr: 2596, repo: 'comfsim/comfsim', branch: 'linnea', char: 'linnea' },
]

function ghJson(args) {
  const out = execFileSync('gh', ['api', ...args], { encoding: 'utf8' })
  return JSON.parse(out)
}

function downloadChar({ pr, repo, branch, char }) {
  const out = path.join(DEST, char)
  console.log(`>>> ${char}  PR #${pr}  ${repo}@${branch}`)
  fs.rmSync(out, { recursive: true, force: true })
  fs.mkdirSync(out, { recursive: true })

  const entries = ghJson([
    `repos/${repo}/contents/internal/characters/${char}?ref=${branch}`,
  ])
  if (!Array.isArray(entries)) {
    throw new Error(`Unexpected listing for ${char}: ${JSON.stringify(entries)}`)
  }

  for (const entry of entries) {
    if (entry.type !== 'file') continue
    const file = ghJson([
      `repos/${repo}/contents/internal/characters/${char}/${entry.name}?ref=${branch}`,
    ])
    const buf = Buffer.from(file.content.replace(/\n/g, ''), 'base64')
    fs.writeFileSync(path.join(out, entry.name), buf)
    console.log(`    ${entry.name} (${buf.length} B)`)
  }

  fs.writeFileSync(
    path.join(out, '.gcsim-pr-source.json'),
    `${JSON.stringify({ pr, repo, branch, char }, null, 2)}\n`,
  )
}

fs.mkdirSync(DEST, { recursive: true })
for (const spec of PR_CHARS) {
  downloadChar(spec)
}
console.log(`Done. Wrote ${PR_CHARS.length} packages under ${DEST}`)
