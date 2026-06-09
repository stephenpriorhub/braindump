export async function scrapeWebpage(url: string): Promise<string> {
  try {
    const res = await fetch(url, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 Chrome/120.0.0.0 Safari/537.36',
        'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
        'Accept-Language': 'en-US,en;q=0.5',
      },
      signal: AbortSignal.timeout(20000),
    })

    if (!res.ok) return `Failed to fetch ${url}: HTTP ${res.status}`

    const html = await res.text()

    // Extract title
    const titleMatch = html.match(/<title[^>]*>([^<]+)<\/title>/i)
    const title = titleMatch?.[1]?.trim().replace(/\s+/g, ' ') || 'Untitled'

    // Extract meta description
    const descMatch = html.match(/<meta[^>]+name=["']description["'][^>]+content=["']([^"']+)["']/i)
    const description = descMatch?.[1] || ''

    // Remove noise: scripts, styles, nav, footer, header, aside
    const cleaned = html
      .replace(/<script[\s\S]*?<\/script>/gi, '')
      .replace(/<style[\s\S]*?<\/style>/gi, '')
      .replace(/<nav[\s\S]*?<\/nav>/gi, '')
      .replace(/<footer[\s\S]*?<\/footer>/gi, '')
      .replace(/<header[\s\S]*?<\/header>/gi, '')
      .replace(/<aside[\s\S]*?<\/aside>/gi, '')
      .replace(/<noscript[\s\S]*?<\/noscript>/gi, '')
      .replace(/<!--[\s\S]*?-->/g, '')
      // Preserve line breaks around block elements
      .replace(/<\/?(p|div|section|article|h[1-6]|li|br|tr)[^>]*>/gi, '\n')
      .replace(/<[^>]+>/g, '')
      // Decode common HTML entities
      .replace(/&nbsp;/g, ' ')
      .replace(/&amp;/g, '&')
      .replace(/&lt;/g, '<')
      .replace(/&gt;/g, '>')
      .replace(/&quot;/g, '"')
      .replace(/&#39;/g, "'")
      // Collapse whitespace
      .replace(/\n{3,}/g, '\n\n')
      .replace(/[ \t]+/g, ' ')
      .trim()

    const header = `URL: ${url}\nTitle: ${title}${description ? `\nDescription: ${description}` : ''}\n\n---\n\n`
    return header + cleaned.slice(0, 15000) + (cleaned.length > 15000 ? '\n\n[Content truncated at 15,000 characters]' : '')
  } catch (e) {
    return `Could not scrape ${url}: ${e instanceof Error ? e.message : String(e)}`
  }
}
