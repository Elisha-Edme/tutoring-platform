// Google Drive "share" links (…/file/d/ID/view or …?id=ID) point at an HTML
// viewer page, not an image, so <img> can't render them. Drive's thumbnail
// endpoint returns an actual image for publicly-shared files, so we rewrite
// any Drive link into that form. Non-Drive URLs (e.g. gravatar) pass through.
export function toDisplayImageUrl(url: string): string {
  if (!url) return url
  if (url.includes('drive.google.com')) {
    const match = url.match(/(?:\/file\/d\/|[?&]id=)([a-zA-Z0-9_-]+)/)
    if (match) return `https://drive.google.com/thumbnail?id=${match[1]}&sz=w400`
  }
  return url
}
