import { NextRequest, NextResponse } from 'next/server'
import { listChats, saveChat } from '@/lib/chats'

export async function GET() {
  return NextResponse.json(listChats())
}

export async function POST(req: NextRequest) {
  const body = await req.json()
  const { id, title, mode, messages } = body
  const now = new Date().toISOString()
  const chat = { id, title: title || 'New Chat', mode: mode || 'train', createdAt: now, updatedAt: now, messages: messages || [] }
  saveChat(chat)
  return NextResponse.json(chat, { status: 201 })
}
