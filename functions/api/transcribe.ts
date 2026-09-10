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

/**
 * `language` only picks the decoder's first token — it does not hold the
 * decoder there. On Tamil this model drifts mid-verse and emits Latin-script
 * English ("remembrance", "provision") between correct Tamil words, because
 * turbo is the distilled decoder and its low-resource languages suffer for it.
 * A few words of Tamil script as `initial_prompt` give it something to stay
 * consistent with.
 *
 * Deliberately NOT the verse being recited, even though the page knows it:
 * priming Whisper with the expected text makes a shaky recitation transcribe
 * as the correct verse, inflating the accuracy this app exists to measure.
 * This is generic prose in the same register, sharing no phrase with the
 * dataset.
 */
const TAMIL_PRIMER =
  'இந்த வேத வசனம் தமிழ் மொழியில் ஒப்புவிக்கப்படுகிறது. ' +
  'மனப்பாடம் செய்த வசனத்தைக் கவனமாகக் கேட்டு எழுதவும்.';

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

/**
 * The Android app is served from the WebView's own origin, so its recitation
 * POST is cross-origin to Pages — and `audio/webm` is not a CORS-safelisted
 * content type, so the browser preflights it. Without an OPTIONS handler Pages
 * answers that preflight with 405 and the recording is never sent.
 *
 * An allowlist rather than `*`, because every request this accepts spends
 * Workers AI neurons from the project's own allocation. The web build is
 * same-origin and needs none of this.
 */
const ALLOWED_ORIGINS = new Set([
  // Capacitor serves the Android WebView from https://localhost, and the iOS
  // one from the capacitor:// scheme.
  'https://localhost',
  'capacitor://localhost',
]);

function cors(request: Request): Record<string, string> {
  const origin = request.headers.get('Origin');
  return origin && ALLOWED_ORIGINS.has(origin)
    ? { 'Access-Control-Allow-Origin': origin, Vary: 'Origin' }
    : {};
}

function json(
  body: Record<string, unknown>,
  status = 200,
  headers: Record<string, string> = {},
): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'Content-Type': 'application/json', ...headers },
  });
}

export function onRequestOptions(context: { request: Request }): Response {
  const headers = cors(context.request);
  // An unknown origin gets no preflight approval, so its POST never happens.
  if (!headers['Access-Control-Allow-Origin']) return new Response(null, { status: 403 });

  return new Response(null, {
    status: 204,
    headers: {
      ...headers,
      'Access-Control-Allow-Methods': 'POST, OPTIONS',
      'Access-Control-Allow-Headers': 'Content-Type',
      'Access-Control-Max-Age': '86400',
    },
  });
}

export async function onRequestPost(context: {
  request: Request;
  env: Env;
}): Promise<Response> {
  const { request, env } = context;
  const headers = cors(request);

  if (!env.AI) {
    // The binding is missing — most often `wrangler pages dev` without `--ai`.
    return json({ error: 'no-binding' }, 500, headers);
  }

  const language = new URL(request.url).searchParams.get('lang') === 'ta' ? 'ta' : 'en';
  const audio = await request.arrayBuffer();

  if (audio.byteLength === 0) return json({ error: 'empty' }, 400, headers);
  if (audio.byteLength > MAX_BYTES) return json({ error: 'too-large' }, 413, headers);

  try {
    const result = await env.AI.run(MODEL, {
      audio: toBase64(audio),
      task: 'transcribe',
      language,
      // Recitations start and end with the user reaching for the button, and
      // Whisper reliably invents words to fill that silence. Dropping the
      // non-speech up front removes what it would otherwise hallucinate from.
      vad_filter: true,
      // English needs no help holding its own script.
      ...(language === 'ta' ? { initial_prompt: TAMIL_PRIMER } : {}),
    });
    return json({ text: (result.text ?? '').trim() }, 200, headers);
  } catch (cause) {
    return json({ error: 'inference-failed', detail: String(cause) }, 502, headers);
  }
}
