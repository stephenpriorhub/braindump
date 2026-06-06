import { existsSync, readFileSync, writeFileSync, readdirSync, mkdirSync, statSync } from 'fs'
import { join, dirname, resolve } from 'path'
import { execFileSync } from 'child_process'

export const VAULT_PATH = process.env.VAULT_PATH || '/data/vault'

// Safety: prevent path traversal outside vault
function safePath(relativePath: string): string {
  const full = resolve(join(VAULT_PATH, relativePath))
  if (!full.startsWith(resolve(VAULT_PATH))) {
    throw new Error(`Path traversal blocked: ${relativePath}`)
  }
  return full
}

export function readFile(path: string): string {
  const full = safePath(path)
  if (!existsSync(full)) return `[File not found: ${path}]`
  return readFileSync(full, 'utf8')
}

export function writeFile(path: string, content: string): void {
  const full = safePath(path)
  mkdirSync(dirname(full), { recursive: true })
  writeFileSync(full, content, 'utf8')
}

export function listDirectory(path: string = ''): string {
  const full = safePath(path)
  if (!existsSync(full)) return `[Directory not found: ${path}]`
  const entries = readdirSync(full, { withFileTypes: true })
  return entries
    .filter(e => !e.name.startsWith('.'))
    .map(e => `${e.isDirectory() ? '📁' : '📄'} ${e.name}`)
    .join('\n')
}

export function getVaultStructure(): string {
  const top = readdirSync(VAULT_PATH, { withFileTypes: true })
    .filter(e => !e.name.startsWith('.') && e.isDirectory())
  const lines: string[] = ['Vault root directories:']
  for (const dir of top) {
    lines.push(`📁 ${dir.name}/`)
    try {
      const sub = readdirSync(join(VAULT_PATH, dir.name), { withFileTypes: true })
        .filter(e => !e.name.startsWith('.'))
        .slice(0, 6)
      sub.forEach(e => lines.push(`  ${e.isDirectory() ? '📁' : '📄'} ${e.name}`))
      if (sub.length === 6) lines.push('  ...')
    } catch { /* skip */ }
  }
  return lines.join('\n')
}

export function searchVault(query: string): string {
  try {
    const result = execFileSync('grep', [
      '-r', '-l', '-i', '--include=*.md', query, VAULT_PATH
    ], { encoding: 'utf8', timeout: 10000 })
    const files = result.trim().split('\n')
      .filter(Boolean)
      .map(f => f.replace(VAULT_PATH + '/', ''))
      .slice(0, 20)
    if (!files.length) return 'No files found matching: ' + query
    // Return matching lines too
    const snippets = files.slice(0, 5).map(f => {
      try {
        const lines = readFileSync(join(VAULT_PATH, f), 'utf8').split('\n')
        const matching = lines.filter(l => l.toLowerCase().includes(query.toLowerCase())).slice(0, 2)
        return `${f}:\n${matching.map(l => '  ' + l.trim()).join('\n')}`
      } catch { return f }
    })
    return `Found in ${files.length} file(s):\n\n${snippets.join('\n\n')}`
  } catch {
    return 'No results found for: ' + query
  }
}

export function commitAndPush(message: string): string {
  try {
    execFileSync('git', ['-C', VAULT_PATH, 'add', '-A'], { encoding: 'utf8' })
    execFileSync('git', ['-C', VAULT_PATH, 'commit', '-m', message], { encoding: 'utf8' })
    execFileSync('git', ['-C', VAULT_PATH, 'push'], { encoding: 'utf8', timeout: 30000 })
    return 'Changes committed and pushed to brain repo.'
  } catch (e: unknown) {
    const msg = e instanceof Error ? e.message : String(e)
    if (msg.includes('nothing to commit')) return 'Nothing to commit — no changes detected.'
    return `Git error: ${msg.slice(0, 200)}`
  }
}
