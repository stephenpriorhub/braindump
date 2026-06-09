import { existsSync, readFileSync, writeFileSync, mkdirSync, readdirSync, unlinkSync } from 'fs'
import { join } from 'path'

const CHATS_DIR = process.env.CHATS_PATH
  ? process.env.CHATS_PATH
  : join(process.cwd(), 'chats')

export interface ChatMessage {
  role: 'user' | 'assistant'
  content: string
}

export interface Chat {
  id: string
  title: string
  mode: 'train' | 'discover'
  createdAt: string
  updatedAt: string
  messages: ChatMessage[]
}

export type ChatMeta = Omit<Chat, 'messages'>

function ensureDir() {
  if (!existsSync(CHATS_DIR)) mkdirSync(CHATS_DIR, { recursive: true })
}

export function listChats(): ChatMeta[] {
  ensureDir()
  try {
    return readdirSync(CHATS_DIR)
      .filter(f => f.endsWith('.json'))
      .map(f => {
        try {
          const chat = JSON.parse(readFileSync(join(CHATS_DIR, f), 'utf8')) as Chat
          return { id: chat.id, title: chat.title, mode: chat.mode, createdAt: chat.createdAt, updatedAt: chat.updatedAt }
        } catch { return null }
      })
      .filter((c): c is ChatMeta => c !== null)
      .sort((a, b) => new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime())
  } catch { return [] }
}

export function getChat(id: string): Chat | null {
  ensureDir()
  const path = join(CHATS_DIR, `${id}.json`)
  if (!existsSync(path)) return null
  try { return JSON.parse(readFileSync(path, 'utf8')) } catch { return null }
}

export function saveChat(chat: Chat): void {
  ensureDir()
  writeFileSync(join(CHATS_DIR, `${chat.id}.json`), JSON.stringify(chat, null, 2))
}

export function deleteChat(id: string): void {
  ensureDir()
  const path = join(CHATS_DIR, `${id}.json`)
  if (existsSync(path)) unlinkSync(path)
}
