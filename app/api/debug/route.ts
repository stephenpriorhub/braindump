import { NextResponse } from 'next/server'
import { existsSync } from 'fs'
import { join } from 'path'

export async function GET() {
  const key = process.env.BRAINDUMP_API_KEY
  const vaultPath = process.env.VAULT_PATH || '(not set)'
  const bryanFile = join(vaultPath, 'Resources', 'Bryan Bottarelli.md')

  return NextResponse.json({
    hasKey: !!key,
    keyStart: key?.slice(0, 15) ?? 'undefined',
    vaultPath,
    vaultExists: existsSync(vaultPath),
    bryanFileExists: existsSync(bryanFile),
    allEnvKeys: Object.keys(process.env).filter(k =>
      k.includes('ANTHROPIC') || k.includes('HUB') || k.includes('BRAINDUMP') || k.includes('VAULT')
    ),
  })
}
