/**
 * Only allow redirects to paths inside this app. Blocks open-redirect tricks such as
 * "//evil.com", "/\evil.com", "https://evil.com" or "javascript:alert(1)".
 */
export function safeNextPath(input: string | null | undefined, fallback = "/"): string {
  if (!input) return fallback;
  if (!input.startsWith("/")) return fallback;
  if (input.startsWith("//") || input.startsWith("/\\")) return fallback;
  // control characters or backslashes can be interpreted as path separators by some browsers
  if (/[\u0000-\u001f\\]/.test(input)) return fallback;
  return input;
}
