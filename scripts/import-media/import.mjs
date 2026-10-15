// Run by .github/workflows/import-media.yml for images too large for a Pages
// CMS upload: downloads the temporary upload, runs the image optimizer on it
// (resize, metadata cleanup; same rules as every other image) and commits the
// result to preview. The original is never committed. Inputs come from env.
import { spawnSync } from 'node:child_process'
import { createHash } from 'node:crypto'
import fs from 'node:fs'
import path from 'node:path'

const MAX_BYTES = 100 * 1024 * 1024
const ROOT = process.cwd()
const MANIFEST = path.join(ROOT, 'scripts/optimize-images/manifest.json')
const summary = (text) => process.env.GITHUB_STEP_SUMMARY && fs.appendFileSync(process.env.GITHUB_STEP_SUMMARY, `${text}\n`)
const fail = (message) => {
  console.error(`::error title=Image not imported::${message}`)
  summary(`### Image not imported\n\n${message}`)
  process.exit(1)
}
const git = (...args) => spawnSync('git', args, { stdio: 'inherit' }).status === 0
const sha256 = (buffer) => createHash('sha256').update(buffer).digest('hex')

const host = String(process.env.BLOB_HOST || '').toLowerCase()
const url = String(process.env.UPLOAD_URL || '')
const target = String(process.env.MEDIA_PATH || '')

const urlMatch = url.match(/^https:\/\/([a-z0-9.-]+)\/tmp\/media\/[a-z0-9]{16}\/(\d{1,9})-[A-Za-z0-9._-]+\.(jpe?g|png|webp)$/i)
if (!host || !urlMatch || urlMatch[1].toLowerCase() !== host) fail('The upload link is not a temporary upload on our store.')
if (!/^public\/media\/([A-Za-z0-9._-]+\/)*[A-Za-z0-9][A-Za-z0-9._-]*\.(jpe?g|png|webp)$/i.test(target) || target.includes('..')) {
  fail('The image path is not inside public/media or has an unsupported name.')
}
const expectedSize = Number(urlMatch[2])
if (expectedSize > MAX_BYTES) fail('The image is over 100 MB.')

const response = await fetch(url)
if (!response.ok) fail(`Downloading the upload failed (${response.status}).`)
const original = Buffer.from(await response.arrayBuffer())
if (original.length !== expectedSize) fail('The upload did not arrive complete.')

const file = path.join(ROOT, target)
const mediaKey = `/${target.replace(/^public\//, '')}`
git('config', 'user.name', 'Image Optimizer')
git('config', 'user.email', '41898282+github-actions[bot]@users.noreply.github.com')

for (let attempt = 1; attempt <= 3; attempt++) {
  if (fs.existsSync(file)) fail(`${target} already exists. Upload the image again; it will get a new name.`)
  fs.mkdirSync(path.dirname(file), { recursive: true })
  fs.writeFileSync(file, original)

  spawnSync('node', ['scripts/optimize-images/optimize.mjs'], { stdio: 'inherit' })
  const manifest = JSON.parse(fs.readFileSync(MANIFEST, 'utf8'))
  const entry = manifest.files?.[mediaKey]
  if (!entry || entry.sha256 !== sha256(fs.readFileSync(file))) {
    fail(manifest.failed?.[mediaKey]?.note ? `The optimizer could not process it: ${manifest.failed[mediaKey].note}` : 'The optimizer did not process it.')
  }

  git('add', '--', target)
  git('add', '-u', 'public/media')
  git('add', 'scripts/optimize-images/manifest.json')
  git('commit', '-q', '-m', `Add ${target} (via Pages CMS)`, '-m', 'Large image imported and optimized by .github/workflows/import-media.yml')
  if (git('push', 'origin', 'HEAD:preview')) {
    summary(`### Imported ${target}\n\n${entry.action}, ${entry.width}×${entry.height}, ${(entry.bytesAfter / 1048576).toFixed(1)} MB (uploaded ${(original.length / 1048576).toFixed(1)} MB).`)
    process.exit(0)
  }
  console.log(`::warning::preview changed while importing; retrying on the new tip (attempt ${attempt} of 3).`)
  git('fetch', '-q', 'origin', 'preview')
  git('reset', '-q', '--hard', 'origin/preview')
}
fail('Could not push to preview after 3 attempts. Upload the image again.')
