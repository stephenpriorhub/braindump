import { NextRequest } from 'next/server'
import Anthropic from '@anthropic-ai/sdk'
import { readFile, listDirectory, getVaultStructure, searchVault, writeFile, VAULT_PATH } from '@/lib/vault'
import { existsSync } from 'fs'

const client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY })

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

When the user provides information:
1. Use list_directory and get_vault_structure to understand where things belong
2. Read existing files before updating them (use read_file)
3. Determine the correct vault location — be specific about WHY you chose it
4. Use write_file to stage the change — explain what you're writing and where
5. If the info updates industry relationships or publisher/guru connections, also update Resources/Financial Publishing Knowledge Graph.md
6. If the info is MTA-specific (publications, promos, gurus, strategy), explicitly ask: "This looks MTA-related — would you like me to also update the MTA Wiki?"
7. After staging all files, summarize exactly what you've written and ask the user to confirm before it's saved

Important: Stage ALL related files before asking for confirmation. Never commit automatically — always wait for user confirmation.`

const DISCOVER_SYSTEM = `You are BrainDump in Discover mode — a knowledge retrieval assistant for the MTA brain vault.

Your job: find and synthesize information from the vault to answer questions accurately.

Always:
- Use search_vault to find relevant content before answering
- Read the actual files with read_file before quoting them
- Cite the exact file paths you used (e.g. "From Resources/Nate Bear - Claims & Track Record.md:")
- If you can't find something, say so clearly and suggest where it might be stored

Never write or modify any files in discover mode.`

const TRAIN_TOOLS: Anthropic.Tool[] = [
  {
    name: 'get_vault_structure',
    description: 'Get the top-level folder structure of the brain vault. Use this first to understand where things belong.',
    input_schema: { type: 'object' as const, properties: {} }
  },
  {
    name: 'list_directory',
    description: 'List the contents of a specific vault directory.',
    input_schema: {
      type: 'object' as const,
      properties: { path: { type: 'string', description: 'Relative path within vault, e.g. "Resources/Promos"' } },
      required: ['path']
    }
  },
  {
    name: 'read_file',
    description: 'Read an existing vault file. Always read before updating.',
    input_schema: {
      type: 'object' as const,
      properties: { path: { type: 'string', description: 'Relative path, e.g. "Resources/Nate Bear - Claims & Track Record.md"' } },
      required: ['path']
    }
  },
  {
    name: 'search_vault',
    description: 'Search for text across all markdown files in the vault.',
    input_schema: {
      type: 'object' as const,
      properties: { query: { type: 'string', description: 'Search term' } },
      required: ['query']
    }
  },
  {
    name: 'write_file',
    description: 'Stage a file write to the vault. This does NOT immediately save — the user must confirm. Always explain why you chose this location.',
    input_schema: {
      type: 'object' as const,
      properties: {
        path: { type: 'string', description: 'Relative path in vault where file should be written' },
        content: { type: 'string', description: 'Full file content to write' },
        reason: { type: 'string', description: 'Why this location was chosen' }
      },
      required: ['path', 'content', 'reason']
    }
  }
]

const DISCOVER_TOOLS: Anthropic.Tool[] = TRAIN_TOOLS.filter(t => t.name !== 'write_file')

type StagedFile = { path: string; content: string; reason: string }

function executeTool(name: string, input: Record<string, string>, staged: StagedFile[]): string {
  switch (name) {
    case 'get_vault_structure': return existsSync(VAULT_PATH) ? getVaultStructure() : 'Vault not yet synced. BRAIN_REPO_URL may not be set.'
    case 'list_directory': return listDirectory(input.path)
    case 'read_file': return readFile(input.path)
    case 'search_vault': return searchVault(input.query)
    case 'write_file':
      staged.push({ path: input.path, content: input.content, reason: input.reason })
      return `✅ Staged: "${input.path}" — ${input.reason}`
    default: return `Unknown tool: ${name}`
  }
}

export async function POST(req: NextRequest) {
  const body = await req.json()
  const { messages, mode = 'train', imageData } = body

  const system = mode === 'train' ? TRAIN_SYSTEM : DISCOVER_SYSTEM
  const tools = mode === 'train' ? TRAIN_TOOLS : DISCOVER_TOOLS

  const encoder = new TextEncoder()
  const staged: StagedFile[] = []

  const stream = new ReadableStream({
    async start(controller) {
      const send = (data: object) => {
        controller.enqueue(encoder.encode(`data: ${JSON.stringify(data)}\n\n`))
      }

      try {
        // Build message list — inject image if provided
        const apiMessages: Anthropic.MessageParam[] = messages.map((m: { role: string; content: string }) => ({
          role: m.role as 'user' | 'assistant',
          content: m.content
        }))

        // Replace last user message content with image + text if image provided
        if (imageData && apiMessages.length > 0) {
          const last = apiMessages[apiMessages.length - 1]
          if (last.role === 'user') {
            const text = typeof last.content === 'string' ? last.content : ''
            last.content = [
              { type: 'image', source: { type: 'base64', media_type: imageData.mediaType, data: imageData.data } },
              { type: 'text', text: text || 'Please analyze this image and store it appropriately in the vault.' }
            ] as Anthropic.ContentBlockParam[]
          }
        }

        let continueLoop = true
        let loopMessages = [...apiMessages]

        while (continueLoop) {
          const response = await client.messages.create({
            model: 'claude-opus-4-5',
            max_tokens: 4096,
            system,
            tools,
            messages: loopMessages,
          })

          // Stream text blocks
          for (const block of response.content) {
            if (block.type === 'text') {
              // Stream word by word for responsiveness
              const words = block.text.split(' ')
              for (const word of words) {
                send({ type: 'text', content: word + ' ' })
              }
            }
            if (block.type === 'tool_use') {
              send({ type: 'tool_call', name: block.name, input: block.input })
              const result = executeTool(block.name, block.input as Record<string, string>, staged)
              send({ type: 'tool_result', name: block.name, result })

              // Add assistant message + tool result to continue loop
              loopMessages = [
                ...loopMessages,
                { role: 'assistant', content: response.content },
                {
                  role: 'user',
                  content: [{ type: 'tool_result', tool_use_id: block.id, content: result }]
                }
              ]
            }
          }

          // Stop if no tool use or model says end_turn
          continueLoop = response.stop_reason === 'tool_use' &&
            response.content.some(b => b.type === 'tool_use')
        }

        // Send staged files for confirmation UI
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
      'Cache-Control': 'no-cache',
      'Connection': 'keep-alive',
    }
  })
}
