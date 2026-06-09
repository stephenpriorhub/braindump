import { NextRequest, NextResponse } from 'next/server'
import { writeFile, commitAndPush } from '@/lib/vault'

export async function POST(req: NextRequest) {
  const { files, message } = await req.json()

  if (!files || !Array.isArray(files) || files.length === 0) {
    return NextResponse.json({ error: 'No files to commit' }, { status: 400 })
  }

  try {
    // Write all staged files (handle move tombstones)
    for (const file of files) {
      if (file.path.startsWith('__delete__:')) {
        // Delete the original file after a move
        const { unlinkSync, existsSync } = await import('fs')
        const { join } = await import('path')
        const { VAULT_PATH } = await import('@/lib/vault')
        const realPath = join(VAULT_PATH, file.path.replace('__delete__:', ''))
        if (existsSync(realPath)) unlinkSync(realPath)
      } else {
        writeFile(file.path, file.content)
      }
    }

    // Commit and push
    const commitMsg = message || `BrainDump: update ${files.map((f: { path: string }) => f.path.split('/').pop()).join(', ')}`
    const result = commitAndPush(commitMsg)

    return NextResponse.json({ ok: true, message: result, files: files.map((f: { path: string }) => f.path) })
  } catch (err) {
    return NextResponse.json({ error: err instanceof Error ? err.message : 'Commit failed' }, { status: 500 })
  }
}
