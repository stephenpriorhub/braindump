import { NextRequest, NextResponse } from 'next/server'
import { getChat, saveChat, deleteChat } from '@/lib/chats'

export async function GET(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const chat = getChat(id)
  if (!chat) return NextResponse.json({ error: 'Not found' }, { status: 404 })
  return NextResponse.json(chat)
}

export async function PUT(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const body = await req.json()
  const existing = getChat(id)
  const now = new Date().toISOString()
  const updated = {
    ...(existing || { createdAt: now }),
    ...body,
    id,
    updatedAt: now,
  }
  saveChat(updated)
  return NextResponse.json(updated)
}

export async function DELETE(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  deleteChat(id)
  return new NextResponse(null, { status: 204 })
}
