/**
 * Transcribes a recited verse with Whisper on Workers AI.
 *
 * This is a Cloudflare Pages Function, not a Next.js route: Pages deploys the
 * `functions/` directory alongside the static export, so the app keeps
 * `output: 'export'` and still gets one server endpoint.
 *
 * The browser posts the recording as a raw body; the model wants base64, and
 * the language is passed explicitly rather than letting Whisper guess, which
 * matters most for Tamil.
 */

interface WhisperResult {
  text?: string;
}

interface Env {
  AI: {
    run(model: string, input: Record<string, unknown>): Promise<WhisperResult>;
  };
}

const MODEL = '@cf/openai/whisper-large-v3-turbo';

/** Roughly ten minutes of Opus — far beyond a single verse, but not unbounded. */
const MAX_BYTES = 8 * 1024 * 1024;

/** `btoa` needs a binary string, and spreading the whole array blows the stack. */
function toBase64(buffer: ArrayBuffer): string {
  const bytes = new Uint8Array(buffer);
  const CHUNK = 0x8000;
  let binary = '';
  for (let i = 0; i < bytes.length; i += CHUNK) {
    binary += String.fromCharCode(...bytes.subarray(i, i + CHUNK));
  }
  return btoa(binary);
}

function json(body: Record<string, unknown>, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'Content-Type': 'application/json' },
  });
}

export async function onRequestPost(context: {
  request: Request;
  env: Env;
}): Promise<Response> {
  const { request, env } = context;

  if (!env.AI) {
    // The binding is missing — most often `wrangler pages dev` without `--ai`.
    return json({ error: 'no-binding' }, 500);
  }

  const language = new URL(request.url).searchParams.get('lang') === 'ta' ? 'ta' : 'en';
  const audio = await request.arrayBuffer();

  if (audio.byteLength === 0) return json({ error: 'empty' }, 400);
  if (audio.byteLength > MAX_BYTES) return json({ error: 'too-large' }, 413);

  try {
    const result = await env.AI.run(MODEL, {
      audio: toBase64(audio),
      task: 'transcribe',
      language,
    });
    return json({ text: (result.text ?? '').trim() });
  } catch (cause) {
    return json({ error: 'inference-failed', detail: String(cause) }, 502);
  }
}
