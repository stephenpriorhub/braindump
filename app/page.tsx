'use client'

import { useState, useRef, useEffect, useCallback } from 'react'

// ── Chat history types ────────────────────────────────────────────────────────
interface ChatMeta {
  id: string
  title: string
  mode: 'train' | 'discover'
  createdAt: string
  updatedAt: string
}

function genId() {
  return Date.now().toString(36) + Math.random().toString(36).slice(2, 7)
}

function timeAgo(iso: string) {
  const d = new Date(iso)
  const diff = Date.now() - d.getTime()
  const mins = Math.floor(diff / 60000)
  if (mins < 1) return 'just now'
  if (mins < 60) return `${mins}m ago`
  const hrs = Math.floor(mins / 60)
  if (hrs < 24) return `${hrs}h ago`
  const days = Math.floor(hrs / 24)
  if (days < 7) return `${days}d ago`
  return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })
}

// ── Chat history sidebar ──────────────────────────────────────────────────────
function ChatSidebar({
  chats,
  activeChatId,
  onSelect,
  onNew,
  onDelete,
}: {
  chats: ChatMeta[]
  activeChatId: string
  onSelect: (id: string) => void
  onNew: () => void
  onDelete: (id: string) => void
}) {
  return (
    <div className="w-52 shrink-0 flex flex-col bg-slate-950 border-r border-slate-800 h-full">
      <div className="p-3 border-b border-slate-800">
        <button
          onClick={onNew}
          className="w-full flex items-center gap-2 px-3 py-2 rounded-lg bg-violet-600 hover:bg-violet-500 text-white text-xs font-semibold transition-colors"
        >
          <span>✏️</span> New Chat
        </button>
      </div>
      <div className="flex-1 overflow-y-auto py-2 scrollbar-thin">
        {chats.length === 0 && (
          <div className="px-4 py-6 text-center text-xs text-slate-600">No past chats yet</div>
        )}
        {chats.map(chat => (
          <div
            key={chat.id}
            className={`group relative mx-2 mb-0.5 rounded-lg cursor-pointer transition-colors ${
              chat.id === activeChatId
                ? 'bg-slate-800 text-white'
                : 'hover:bg-slate-900 text-slate-400'
            }`}
            onClick={() => onSelect(chat.id)}
          >
            <div className="px-3 py-2 pr-7">
              <div className="text-xs font-medium truncate leading-snug">
                {chat.title}
              </div>
              <div className="flex items-center gap-1.5 mt-0.5">
                <span className={`text-[9px] px-1.5 py-0.5 rounded font-medium ${
                  chat.mode === 'train' ? 'bg-violet-900/60 text-violet-400' : 'bg-emerald-900/60 text-emerald-400'
                }`}>
                  {chat.mode}
                </span>
                <span className="text-[10px] text-slate-600">{timeAgo(chat.updatedAt)}</span>
              </div>
            </div>
            <button
              onClick={e => { e.stopPropagation(); onDelete(chat.id) }}
              className="absolute right-2 top-2 opacity-0 group-hover:opacity-100 text-slate-600 hover:text-red-400 text-xs transition-all"
              title="Delete"
            >
              ✕
            </button>
          </div>
        ))}
      </div>
    </div>
  )
}

type Mode = 'train' | 'discover'

interface StagedFile {
  path: string
  content: string
  reason: string
}

interface Message {
  id: string
  role: 'user' | 'assistant'
  content: string
  stagedFiles?: StagedFile[]
  committed?: boolean
  imagePreview?: string
}

function FileCard({ file }: { file: StagedFile }) {
  const [expanded, setExpanded] = useState(false)
  const lines = file.content.split('\n')
  const preview = lines.slice(0, 6).join('\n')
  const hasMore = lines.length > 6

  return (
    <div className="mt-2 rounded-lg border border-violet-500/30 bg-violet-950/30 overflow-hidden text-xs">
      <div className="flex items-center gap-2 px-3 py-2 bg-violet-900/20 border-b border-violet-500/20">
        <span className="text-violet-400">📄</span>
        <span className="text-violet-300 font-mono font-medium flex-1 truncate">{file.path}</span>
      </div>
      {file.reason && (
        <div className="px-3 py-1.5 text-slate-400 italic border-b border-violet-500/10">
          {file.reason}
        </div>
      )}
      <pre className="px-3 py-2 text-slate-300 overflow-x-auto whitespace-pre-wrap leading-relaxed">
        {expanded ? file.content : preview}
        {hasMore && !expanded && '\n...'}
      </pre>
      {hasMore && (
        <button
          onClick={() => setExpanded(e => !e)}
          className="w-full text-center py-1 text-violet-400 hover:text-violet-300 text-[11px] border-t border-violet-500/20"
        >
          {expanded ? '▲ Show less' : `▼ Show all ${lines.length} lines`}
        </button>
      )}
    </div>
  )
}

function CommitPanel({
  files,
  onCommit,
  onDiscard,
  committed,
}: {
  files: StagedFile[]
  onCommit: (msg: string) => void
  onDiscard: () => void
  committed: boolean
}) {
  const [msg, setMsg] = useState('')
  const [loading, setLoading] = useState(false)

  if (committed) {
    return (
      <div className="mt-3 flex items-center gap-2 text-emerald-400 text-sm bg-emerald-950/30 border border-emerald-500/30 rounded-lg px-3 py-2">
        <span>✅</span>
        <span>Saved to brain — {files.length} file{files.length > 1 ? 's' : ''} committed and pushed</span>
      </div>
    )
  }

  return (
    <div className="mt-3 p-3 bg-slate-900/60 border border-slate-700/50 rounded-xl">
      <div className="text-xs text-slate-400 mb-2">
        {files.length} file{files.length > 1 ? 's' : ''} staged — confirm to save to brain
      </div>
      <input
        value={msg}
        onChange={e => setMsg(e.target.value)}
        placeholder={`BrainDump: update ${files.map(f => f.path.split('/').pop()).join(', ')}`}
        className="w-full bg-slate-800 border border-slate-700 rounded-lg px-3 py-1.5 text-xs text-slate-200 placeholder-slate-500 focus:outline-none focus:border-violet-500 mb-2"
      />
      <div className="flex gap-2">
        <button
          onClick={async () => {
            setLoading(true)
            await onCommit(msg)
            setLoading(false)
          }}
          disabled={loading}
          className="flex-1 bg-violet-600 hover:bg-violet-500 disabled:opacity-50 text-white text-xs font-semibold py-1.5 rounded-lg transition-colors"
        >
          {loading ? 'Saving…' : '🧠 Save to Brain'}
        </button>
        <button
          onClick={onDiscard}
          className="px-3 bg-slate-700 hover:bg-slate-600 text-slate-300 text-xs font-medium py-1.5 rounded-lg transition-colors"
        >
          Discard
        </button>
      </div>
    </div>
  )
}

function MessageBubble({
  msg,
  onCommit,
  onDiscard,
}: {
  msg: Message
  onCommit: (msgId: string, commitMsg: string) => Promise<void>
  onDiscard: (msgId: string) => void
}) {
  const isUser = msg.role === 'user'

  return (
    <div className={`flex gap-3 ${isUser ? 'flex-row-reverse' : 'flex-row'}`}>
      <div className={`w-7 h-7 rounded-full flex items-center justify-center text-sm shrink-0 mt-0.5 ${
        isUser ? 'bg-blue-600' : 'bg-violet-700'
      }`}>
        {isUser ? '👤' : '🧠'}
      </div>
      <div className={`max-w-[80%] ${isUser ? 'items-end' : 'items-start'} flex flex-col`}>
        {msg.imagePreview && (
          <img src={msg.imagePreview} alt="uploaded" className="rounded-lg max-h-48 mb-2 border border-slate-700" />
        )}
        <div className={`rounded-2xl px-4 py-3 text-sm leading-relaxed whitespace-pre-wrap ${
          isUser
            ? 'bg-blue-600/20 border border-blue-500/30 text-blue-100'
            : 'bg-slate-800/80 border border-slate-700/50 text-slate-200'
        }`}>
          {msg.content}
        </div>

        {/* Staged files */}
        {msg.stagedFiles && msg.stagedFiles.length > 0 && (
          <div className="w-full mt-1">
            {msg.stagedFiles.filter(f => !f.path.startsWith('__delete__:')).map((f, i) => <FileCard key={i} file={f} />)}
            <CommitPanel
              files={msg.stagedFiles}
              committed={!!msg.committed}
              onCommit={(commitMsg) => onCommit(msg.id, commitMsg)}
              onDiscard={() => onDiscard(msg.id)}
            />
          </div>
        )}
      </div>
    </div>
  )
}

const WELCOME: Record<Mode, string> = {
  train: `👋 Welcome to **Train Mode**

Tell me anything you want to add to the brain — facts, promo notes, guru track records, competitor intel, images, relationships, or anything else.

I'll figure out where it belongs in the vault, show you exactly what I'm writing, and wait for your confirmation before saving.

What would you like to teach the brain?`,
  discover: `🔍 Welcome to **Discover Mode**

Ask me anything about the brain. I'll search the vault and synthesize what I find, citing sources so you can verify.

What do you want to know?`,
}

export default function BrainDump() {
  const [mode, setMode] = useState<Mode>('train')
  const [messages, setMessages] = useState<Message[]>([
    { id: 'welcome', role: 'assistant', content: WELCOME.train }
  ])
  const [input, setInput] = useState('')
  const [loading, setLoading] = useState(false)
  const [toolStatus, setToolStatus] = useState<string>('')
  const [pendingImage, setPendingImage] = useState<{ data: string; mediaType: string; preview: string } | null>(null)
  const [chats, setChats] = useState<ChatMeta[]>([])
  const [activeChatId, setActiveChatId] = useState(() => genId())
  const bottomRef = useRef<HTMLDivElement>(null)
  const fileRef = useRef<HTMLInputElement>(null)
  const textareaRef = useRef<HTMLTextAreaElement>(null)

  // Load chat list on mount
  useEffect(() => {
    fetch('/api/chats').then(r => r.json()).then(setChats).catch(() => {})
  }, [])

  // Auto-save conversation after each assistant reply
  const saveChat = useCallback(async (msgs: Message[], chatMode: Mode) => {
    const realMsgs = msgs.filter(m => !m.id.startsWith('welcome') && m.content)
    if (realMsgs.length === 0) return
    const userMsgs = realMsgs.filter(m => m.role === 'user')
    const title = userMsgs[0]?.content.slice(0, 55) + (userMsgs[0]?.content.length > 55 ? '…' : '') || 'New Chat'
    const payload = {
      id: activeChatId,
      title,
      mode: chatMode,
      messages: realMsgs.map(m => ({ role: m.role, content: m.content || '' })),
    }
    await fetch(`/api/chats/${activeChatId}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    })
    fetch('/api/chats').then(r => r.json()).then(setChats).catch(() => {})
  }, [activeChatId])

  const loadChat = useCallback(async (id: string) => {
    const res = await fetch(`/api/chats/${id}`)
    if (!res.ok) return
    const chat = await res.json()
    setActiveChatId(id)
    setMode(chat.mode || 'train')
    setMessages([
      { id: 'welcome-' + id, role: 'assistant', content: WELCOME[(chat.mode as Mode) || 'train'] },
      ...chat.messages.map((m: { role: 'user' | 'assistant'; content: string }, i: number) => ({
        id: `loaded-${i}`,
        role: m.role,
        content: m.content,
      }))
    ])
    setInput('')
  }, [])

  const newChat = useCallback(() => {
    setActiveChatId(genId())
    setMode('train')
    setMessages([{ id: 'welcome', role: 'assistant', content: WELCOME.train }])
    setInput('')
    setPendingImage(null)
  }, [])

  const deleteChat = useCallback(async (id: string) => {
    await fetch(`/api/chats/${id}`, { method: 'DELETE' })
    setChats(prev => prev.filter(c => c.id !== id))
    if (id === activeChatId) newChat()
  }, [activeChatId, newChat])

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [messages])

  const switchMode = (m: Mode) => {
    setMode(m)
    setMessages([{ id: 'welcome-' + m, role: 'assistant', content: WELCOME[m] }])
    setInput('')
    setPendingImage(null)
  }

  const handleImage = (file: File) => {
    const reader = new FileReader()
    reader.onload = e => {
      const result = e.target?.result as string
      const base64 = result.split(',')[1]
      const mediaType = file.type as 'image/jpeg' | 'image/png' | 'image/gif' | 'image/webp'
      setPendingImage({ data: base64, mediaType, preview: result })
    }
    reader.readAsDataURL(file)
  }

  const sendMessage = useCallback(async () => {
    const text = input.trim()
    if (!text && !pendingImage) return
    if (loading) return

    const userMsg: Message = {
      id: Date.now().toString(),
      role: 'user',
      content: text || '(image)',
      imagePreview: pendingImage?.preview,
    }

    const assistantId = (Date.now() + 1).toString()
    const assistantMsg: Message = { id: assistantId, role: 'assistant', content: '' }

    setMessages(prev => [...prev, userMsg, assistantMsg])
    setInput('')
    setPendingImage(null)
    setLoading(true)

    // Build history for API (exclude welcome message)
    const history = messages
      .filter(m => !m.id.startsWith('welcome'))
      .map(m => ({ role: m.role, content: m.content || '...' }))
    history.push({ role: 'user', content: text || '(image attached)' })

    try {
      const res = await fetch('/api/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          messages: history,
          mode,
          imageData: pendingImage ? { data: pendingImage.data, mediaType: pendingImage.mediaType } : null,
        }),
      })

      const reader = res.body!.getReader()
      const decoder = new TextDecoder()
      let buffer = ''

      while (true) {
        const { done, value } = await reader.read()
        if (done) break

        buffer += decoder.decode(value, { stream: true })
        const lines = buffer.split('\n')
        // Keep last (potentially incomplete) line in buffer
        buffer = lines.pop() ?? ''

        for (const line of lines) {
          if (!line.startsWith('data: ')) continue
          try {
            const data = JSON.parse(line.slice(6))

            if (data.type === 'text') {
              setMessages(prev => prev.map(m =>
                m.id === assistantId ? { ...m, content: m.content + data.content } : m
              ))
            } else if (data.type === 'tool_call') {
              const labels: Record<string, string> = {
                get_vault_structure: 'Reading vault structure',
                list_directory: 'Browsing vault',
                read_file: 'Reading file',
                search_vault: 'Searching vault',
                write_file: 'Staging file',
                scrape_webpage: 'Scraping webpage',
                move_file: 'Moving file',
              }
              setToolStatus(labels[data.name] || data.name)
            } else if (data.type === 'staged') {
              setMessages(prev => prev.map(m =>
                m.id === assistantId ? { ...m, stagedFiles: data.files } : m
              ))
            } else if (data.type === 'error') {
              setMessages(prev => prev.map(m =>
                m.id === assistantId ? { ...m, content: m.content + `\n\n❌ ${data.message}` } : m
              ))
            }
          } catch { /* skip malformed line */ }
        }
      }
    } catch (err) {
      setMessages(prev => prev.map(m =>
        m.id === assistantId ? { ...m, content: '❌ Error: ' + (err instanceof Error ? err.message : 'Unknown error') } : m
      ))
    }

    setLoading(false)
    setToolStatus('')
    // Save after response using latest messages state
    setMessages(prev => {
      saveChat(prev, mode)
      return prev
    })
  }, [input, pendingImage, loading, messages, mode, saveChat])

  const handleCommit = async (msgId: string, commitMsg: string) => {
    const msg = messages.find(m => m.id === msgId)
    if (!msg?.stagedFiles) return

    const res = await fetch('/api/commit', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ files: msg.stagedFiles, message: commitMsg }),
    })

    if (res.ok) {
      setMessages(prev => prev.map(m => m.id === msgId ? { ...m, committed: true } : m))
    }
  }

  const handleDiscard = (msgId: string) => {
    setMessages(prev => prev.map(m => m.id === msgId ? { ...m, stagedFiles: undefined } : m))
  }

  return (
    <div className="flex h-screen" style={{ paddingTop: 44 }}>
      <ChatSidebar
        chats={chats}
        activeChatId={activeChatId}
        onSelect={loadChat}
        onNew={newChat}
        onDelete={deleteChat}
      />
    <div className="flex flex-col flex-1 min-w-0">
      {/* Header */}
      <div className="flex items-center justify-between px-5 py-3 border-b border-slate-800 bg-slate-950/80 backdrop-blur">
        <div className="flex items-center gap-3">
          <span className="text-xl">🧠</span>
          <div>
            <div className="font-bold text-white text-sm">BrainDump</div>
            <div className="text-xs text-slate-500">Monument Traders Alliance Knowledge Base</div>
          </div>
        </div>
        <div className="flex gap-1 bg-slate-900 border border-slate-700 rounded-lg p-1">
          <button
            onClick={() => switchMode('train')}
            className={`px-4 py-1.5 rounded-md text-xs font-semibold transition-all ${
              mode === 'train'
                ? 'bg-violet-600 text-white shadow'
                : 'text-slate-400 hover:text-slate-200'
            }`}
          >
            🧠 Train
          </button>
          <button
            onClick={() => switchMode('discover')}
            className={`px-4 py-1.5 rounded-md text-xs font-semibold transition-all ${
              mode === 'discover'
                ? 'bg-emerald-600 text-white shadow'
                : 'text-slate-400 hover:text-slate-200'
            }`}
          >
            🔍 Discover
          </button>
        </div>
      </div>

      {/* Messages */}
      <div className="flex-1 overflow-y-auto px-4 py-5 space-y-5 scrollbar-thin">
        {messages.map(msg => (
          <MessageBubble
            key={msg.id}
            msg={msg}
            onCommit={handleCommit}
            onDiscard={handleDiscard}
          />
        ))}
        {loading && (
          <div className="flex gap-3 items-center">
            <div className="w-7 h-7 rounded-full bg-violet-700 flex items-center justify-center text-sm shrink-0">🧠</div>
            <div className="bg-slate-800/80 border border-slate-700/50 rounded-2xl px-4 py-3 flex items-center gap-3">
              <div className="flex gap-1">
                <span className="w-1.5 h-1.5 bg-slate-400 rounded-full animate-bounce" style={{ animationDelay: '0ms' }} />
                <span className="w-1.5 h-1.5 bg-slate-400 rounded-full animate-bounce" style={{ animationDelay: '150ms' }} />
                <span className="w-1.5 h-1.5 bg-slate-400 rounded-full animate-bounce" style={{ animationDelay: '300ms' }} />
              </div>
              {toolStatus && (
                <span className="text-xs text-slate-500 italic">{toolStatus}</span>
              )}
            </div>
          </div>
        )}
        <div ref={bottomRef} />
      </div>

      {/* Input */}
      <div className="border-t border-slate-800 bg-slate-950/80 px-4 py-3">
        {pendingImage && (
          <div className="flex items-center gap-2 mb-2 bg-slate-800/60 border border-slate-700 rounded-lg px-3 py-2">
            <img src={pendingImage.preview} alt="" className="w-10 h-10 object-cover rounded" />
            <span className="text-xs text-slate-400 flex-1">Image attached</span>
            <button onClick={() => setPendingImage(null)} className="text-slate-500 hover:text-slate-300 text-xs">✕</button>
          </div>
        )}
        <div className="flex gap-2 items-end">
          <button
            onClick={() => fileRef.current?.click()}
            className="w-9 h-9 flex items-center justify-center rounded-lg bg-slate-800 border border-slate-700 hover:bg-slate-700 text-slate-400 hover:text-slate-200 transition-colors shrink-0"
            title="Attach image"
          >
            📎
          </button>
          <input
            ref={fileRef}
            type="file"
            accept="image/*"
            className="hidden"
            onChange={e => { const f = e.target.files?.[0]; if (f) handleImage(f); e.target.value = '' }}
          />
          <textarea
            ref={textareaRef}
            value={input}
            onChange={e => setInput(e.target.value)}
            onKeyDown={e => {
              if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); sendMessage() }
            }}
            placeholder={mode === 'train'
              ? 'Teach the brain something... (Shift+Enter for new line)'
              : 'Ask the brain anything...'
            }
            rows={1}
            className="flex-1 bg-slate-800 border border-slate-700 focus:border-violet-500 rounded-xl px-4 py-2.5 text-sm text-slate-200 placeholder-slate-500 focus:outline-none resize-none transition-colors"
            style={{ minHeight: 40, maxHeight: 120 }}
          />
          <button
            onClick={sendMessage}
            disabled={loading || (!input.trim() && !pendingImage)}
            className={`w-9 h-9 flex items-center justify-center rounded-lg shrink-0 transition-all disabled:opacity-40 ${
              mode === 'train'
                ? 'bg-violet-600 hover:bg-violet-500 text-white'
                : 'bg-emerald-600 hover:bg-emerald-500 text-white'
            }`}
          >
            ➤
          </button>
        </div>
      </div>
    </div>
    </div>
  )
}
