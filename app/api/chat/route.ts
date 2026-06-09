import { NextRequest } from 'next/server'
import Anthropic from '@anthropic-ai/sdk'
import { readFile, listDirectory, getVaultStructure, searchVault, writeFile, moveFile, VAULT_PATH } from '@/lib/vault'
import { scrapeWebpage } from '@/lib/scraper'
import { existsSync } from 'fs'

const TRAIN_SYSTEM = `You are BrainDump, an intelligent knowledge organizer for the Monument Traders Alliance brain vault.

The vault is an Obsidian-format knowledge base using the PARA system:
- Areas/MTA/ — Ongoing MTA business (publications, people, operations)
- Resources/ — Reference material
  - Resources/Promos/ — Promo scripts organized by publication and performance tier
  - Resources/Promo Analysis/ — Analysis files per service (PSU, WAR, TPU, etc.)
  - Resources/Assets/Gallery/ — Guru photos (Bryan Bottarelli/, Karim Rahemtulla/, Nate Bear/, Chris Johnson/)
  - Resources/Financial Publishing Knowledge Graph.md — Industry relationship map
  - Resources/Competitors/ — Competitor intelligence
- Projects/ — Active projects with a finish line
- Archive/ — Completed/inactive items
- Inbox/ — Unprocessed raw content

Key people: Bryan Bottarelli (WAR/PMK/WNM/TPU), Karim Rahemtulla (WAR/TPU), Nate Bear (PSU/DPL/DPS/NBS), Chris Johnson (MTLIV host), Stephen Prior (Publisher), Ryan Fitzwater (CEO)

## Your behavior in Train Mode

**Step 1 — Ask clarifying questions first.**
Before doing anything, ask 2-4 focused questions to get the full picture. Examples:
- What is the start date / timeline?
- What products or services are involved?
- Is this confirmed or speculative?
- Any context on why this matters for MTA?
- Do you have more details on X?

Keep questions short and numbered. Wait for the user's answers before proceeding.

**Step 2 — Research the vault silently.**
Once you have enough information, use tools to check existing files and understand where this belongs. Do this in the background — don't narrate every tool call.

**Step 3 — Present a clear save plan.**
Summarize exactly what you plan to write in a clean, readable format:

"Here's what I'll save to the brain:

📄 **Areas/MTA/People/Matt McCall.md** — New guru profile
📄 **Resources/Financial Publishing Knowledge Graph.md** — Add Matt McCall node under MTA

This is MTA-related — would you also like me to update the MTA Wiki?"

Then ask: "Ready to save, or would you like to change anything?"

**Step 4 — Stage files only after confirmation.**
Use write_file only after the user says yes. Never stage without explicit approval.

Never commit automatically. Always wait for the user to click "Save to Brain".`

const DISCOVER_SYSTEM = `You are BrainDump in Discover mode — a knowledge retrieval assistant for the MTA brain vault.

Find and synthesize information from the vault to answer questions accurately.
- Use search_vault to find relevant content
- Read actual files with read_file before quoting
- Always cite exact file paths you used
- Never write or modify files in discover mode`

const TRAIN_TOOLS: Anthropic.Tool[] = [
  {
    name: 'get_vault_structure',
    description: 'Get the top-level folder structure of the brain vault.',
    input_schema: { type: 'object' as const, properties: {} }
  },
  {
    name: 'list_directory',
    description: 'List the contents of a specific vault directory.',
    input_schema: {
      type: 'object' as const,
      properties: { path: { type: 'string' } },
      required: ['path']
    }
  },
  {
    name: 'read_file',
    description: 'Read an existing vault file. Always read before updating.',
    input_schema: {
      type: 'object' as const,
      properties: { path: { type: 'string' } },
      required: ['path']
    }
  },
  {
    name: 'search_vault',
    description: 'Search for text across all markdown files in the vault.',
    input_schema: {
      type: 'object' as const,
      properties: { query: { type: 'string' } },
      required: ['query']
    }
  },
  {
    name: 'write_file',
    description: 'Stage a file write to the vault (does NOT save until user confirms). Explain why you chose this location.',
    input_schema: {
      type: 'object' as const,
      properties: {
        path: { type: 'string', description: 'Relative path in vault' },
        content: { type: 'string', description: 'Full file content' },
        reason: { type: 'string', description: 'Why this location was chosen' }
      },
      required: ['path', 'content', 'reason']
    }
  },
  {
    name: 'move_file',
    description: 'Move or rename a file within the vault. Stages the move — user must still confirm before committing.',
    input_schema: {
      type: 'object' as const,
      properties: {
        from: { type: 'string', description: 'Current relative path' },
        to: { type: 'string', description: 'New relative path' },
        reason: { type: 'string', description: 'Why this move is being made' }
      },
      required: ['from', 'to', 'reason']
    }
  },
  {
    name: 'scrape_webpage',
    description: 'Fetch and read the content of a webpage. Use when the user shares a URL or asks you to "check out", "scrape", "read", or "learn from" a webpage.',
    input_schema: {
      type: 'object' as const,
      properties: {
        url: { type: 'string', description: 'Full URL including https://' }
      },
      required: ['url']
    }
  }
]

const DISCOVER_TOOLS = TRAIN_TOOLS.filter(t => t.name !== 'write_file')

type StagedFile = { path: string; content: string; reason: string }

async function executeTool(name: string, input: Record<string, string>, staged: StagedFile[]): Promise<string> {
  try {
    switch (name) {
      case 'get_vault_structure':
        return existsSync(VAULT_PATH) ? getVaultStructure() : 'Vault not synced yet.'
      case 'list_directory': return listDirectory(input.path)
      case 'read_file': return readFile(input.path)
      case 'search_vault': return searchVault(input.query)
      case 'write_file':
        staged.push({ path: input.path, content: input.content, reason: input.reason })
        return `Staged: ${input.path}`
      case 'move_file': {
        // Stage a move: read content from source and stage write to destination
        const content = readFile(input.from)
        staged.push({ path: input.to, content, reason: `Moved from ${input.from}: ${input.reason}` })
        // Mark old path for deletion by staging a tombstone
        staged.push({ path: `__delete__:${input.from}`, content: '', reason: 'delete original after move' })
        return `Staged move: ${input.from} → ${input.to}`
      }
      case 'scrape_webpage':
        return await scrapeWebpage(input.url)
      default: return `Unknown tool: ${name}`
    }
  } catch (e) {
    return `Tool error: ${e instanceof Error ? e.message : String(e)}`
  }
}

export async function POST(req: NextRequest) {
  const client = new Anthropic({ apiKey: process.env.BRAINDUMP_API_KEY })
  const body = await req.json()
  const { messages, mode = 'train', imageData } = body

  const system = mode === 'train' ? TRAIN_SYSTEM : DISCOVER_SYSTEM
  const tools = mode === 'train' ? TRAIN_TOOLS : DISCOVER_TOOLS
  const staged: StagedFile[] = []

  // Build Anthropic messages
  const apiMessages: Anthropic.MessageParam[] = messages.map((m: { role: string; content: string }) => ({
    role: m.role as 'user' | 'assistant',
    content: m.content
  }))

  // Inject image into last user message if provided
  if (imageData && apiMessages.length > 0) {
    const last = apiMessages[apiMessages.length - 1]
    if (last.role === 'user') {
      const text = typeof last.content === 'string' ? last.content : ''
      last.content = [
        { type: 'image', source: { type: 'base64', media_type: imageData.mediaType, data: imageData.data } },
        { type: 'text', text: text || 'Please analyze this image and store it in the vault.' }
      ] as Anthropic.ContentBlockParam[]
    }
  }

  const encoder = new TextEncoder()

  const stream = new ReadableStream({
    async start(controller) {
      function send(obj: object) {
        controller.enqueue(encoder.encode(`data: ${JSON.stringify(obj)}\n\n`))
      }

      try {
        let loopMessages = [...apiMessages]
        let iterations = 0
        const MAX_ITERATIONS = 10

        while (iterations < MAX_ITERATIONS) {
          iterations++

          const response = await client.messages.create({
            model: 'claude-opus-4-5',
            max_tokens: 4096,
            system,
            tools,
            messages: loopMessages,
          })

          // Stream all text content
          for (const block of response.content) {
            if (block.type === 'text' && block.text) {
              send({ type: 'text', content: block.text })
            }
          }

          // Handle tool use
          const toolUseBlocks = response.content.filter(b => b.type === 'tool_use') as Anthropic.ToolUseBlock[]

          if (toolUseBlocks.length === 0 || response.stop_reason !== 'tool_use') {
            break
          }

          // Execute tools and collect results
          const toolResults: Anthropic.ToolResultBlockParam[] = []
          for (const block of toolUseBlocks) {
            send({ type: 'tool_call', name: block.name })
            const result = await executeTool(block.name, block.input as Record<string, string>, staged)
            send({ type: 'tool_result', name: block.name, result: result.slice(0, 500) })
            toolResults.push({ type: 'tool_result', tool_use_id: block.id, content: result })
          }

          // Continue conversation with tool results
          loopMessages = [
            ...loopMessages,
            { role: 'assistant' as const, content: response.content },
            { role: 'user' as const, content: toolResults }
          ]
        }

        // Send staged files for confirmation
        if (staged.length > 0) {
          send({ type: 'staged', files: staged })
        }

        send({ type: 'done' })
      } catch (err) {
        send({ type: 'error', message: err instanceof Error ? err.message : 'Unknown error' })
      }

      controller.close()
    }
  })

  return new Response(stream, {
    headers: {
      'Content-Type': 'text/event-stream',
      'Cache-Control': 'no-cache, no-transform',
      'X-Accel-Buffering': 'no',
      'Connection': 'keep-alive',
    }
  })
}
