export type ShareTool = 'plot' | 'structures';

export interface ShareEnvelope<T> {
  v: 1;
  tool: ShareTool;
  data: T;
}

function toBase64Url(text: string): string {
  const bytes = new TextEncoder().encode(text);
  let binary = '';
  for (const byte of bytes) {
    binary += String.fromCharCode(byte);
  }
  return btoa(binary).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}

function fromBase64Url(token: string): string {
  const normalized = token.replace(/-/g, '+').replace(/_/g, '/');
  const padded = normalized + '='.repeat((4 - (normalized.length % 4)) % 4);
  const binary = atob(padded);
  const bytes = Uint8Array.from(binary, (char) => char.charCodeAt(0));
  return new TextDecoder().decode(bytes);
}

export function encodeShare<T>(tool: ShareTool, data: T): string {
  return toBase64Url(JSON.stringify({ v: 1, tool, data } satisfies ShareEnvelope<T>));
}

const MAX_TOKEN_LENGTH = 64_000;

export function decodeShare<T>(hash: string): ShareEnvelope<T> | null {
  const raw = hash.startsWith('#') ? hash.slice(1) : hash;
  const token = raw.startsWith('share=') ? raw.slice('share='.length) : raw;
  if (!token || token.length > MAX_TOKEN_LENGTH) {
    return null;
  }

  try {
    const parsed = JSON.parse(fromBase64Url(token)) as Partial<ShareEnvelope<T>>;
    if (parsed.v !== 1 || (parsed.tool !== 'plot' && parsed.tool !== 'structures')) {
      return null;
    }
    return parsed as ShareEnvelope<T>;
  } catch {
    return null;
  }
}

export function buildShareUrl<T>(tool: ShareTool, data: T): string {
  if (typeof window === 'undefined') {
    return '';
  }
  const url = new URL(window.location.href);
  url.hash = `share=${encodeShare(tool, data)}`;
  return url.toString();
}

export async function copyShareUrl(url: string): Promise<boolean> {
  if (typeof navigator !== 'undefined' && navigator.clipboard?.writeText) {
    try {
      await navigator.clipboard.writeText(url);
      return true;
    } catch {
      // Fallback para navegadores sin permiso de portapapeles.
    }
  }

  if (typeof document === 'undefined') {
    return false;
  }

  try {
    const textarea = document.createElement('textarea');
    textarea.value = url;
    textarea.setAttribute('readonly', '');
    textarea.style.position = 'fixed';
    textarea.style.opacity = '0';
    document.body.appendChild(textarea);
    textarea.select();
    const copied = document.execCommand('copy');
    textarea.remove();
    return copied;
  } catch {
    return false;
  }
}
