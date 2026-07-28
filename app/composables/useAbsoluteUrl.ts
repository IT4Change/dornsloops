/**
 * Turns a root-relative path into an absolute URL.
 *
 * Link previews (Discord, WhatsApp, Signal, …) only accept absolute URLs for
 * images and videos, so `siteUrl` has to be configured at build time. Without
 * it the path is returned unchanged — the page still works, only the preview
 * image stays blank.
 */
export function useAbsoluteUrl () {
  const base = useRuntimeConfig().public.siteUrl as string

  return (path: string): string => {
    if (!base) return path
    return `${base.replace(/\/+$/, '')}${path}`
  }
}
