// Criptografia do Cofre de acessos — 100% no cliente (Web Crypto API, sem dependências).
// Fluxo: senha-mestra + salt -> PBKDF2-SHA256 -> CryptoKey AES-GCM 256 (não-extraível, só em memória).
// Campos sensíveis são cifrados por campo com IV aleatório de 12 bytes; persistidos como base64(iv||ct).
// A senha-mestra NUNCA é persistida; validação é feita por um "verifier" (canário cifrado).

export const PBKDF2_ITERATIONS = 310_000;
export const KDF_NAME = "PBKDF2-SHA256";
export const MIN_MASTER_STRENGTH = 3; // score mínimo (0..4) exigido na senha-mestra
const VERIFIER_CANARY = "vault-verifier-v1";

// ---------------------------------------------------------------------------
// Base64 <-> bytes
// ---------------------------------------------------------------------------
function bytesToB64(bytes: Uint8Array): string {
  let bin = "";
  for (let i = 0; i < bytes.length; i++) bin += String.fromCharCode(bytes[i]);
  return btoa(bin);
}
function b64ToBytes(b64: string): Uint8Array {
  const bin = atob(b64);
  const out = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) out[i] = bin.charCodeAt(i);
  return out;
}

// ---------------------------------------------------------------------------
// Derivação de chave e cifra
// ---------------------------------------------------------------------------
export function generateSalt(): string {
  return bytesToB64(crypto.getRandomValues(new Uint8Array(16)));
}

export async function deriveKey(
  masterPassword: string,
  saltB64: string,
  iterations: number = PBKDF2_ITERATIONS,
): Promise<CryptoKey> {
  const enc = new TextEncoder();
  const baseKey = await crypto.subtle.importKey(
    "raw",
    enc.encode(masterPassword),
    "PBKDF2",
    false,
    ["deriveKey"],
  );
  return crypto.subtle.deriveKey(
    { name: "PBKDF2", salt: b64ToBytes(saltB64) as BufferSource, iterations, hash: "SHA-256" },
    baseKey,
    { name: "AES-GCM", length: 256 },
    false, // não-extraível
    ["encrypt", "decrypt"],
  );
}

/** Cifra um texto puro -> base64(iv||ciphertext). Retorna "" para entrada vazia. */
export async function encryptField(key: CryptoKey, plaintext: string): Promise<string> {
  if (!plaintext) return "";
  const iv = crypto.getRandomValues(new Uint8Array(12));
  const ct = new Uint8Array(
    await crypto.subtle.encrypt(
      { name: "AES-GCM", iv },
      key,
      new TextEncoder().encode(plaintext),
    ),
  );
  const combined = new Uint8Array(iv.length + ct.length);
  combined.set(iv, 0);
  combined.set(ct, iv.length);
  return bytesToB64(combined);
}

/** Decifra base64(iv||ciphertext) -> texto puro. Lança se a chave/payload forem inválidos. */
export async function decryptField(key: CryptoKey, payloadB64: string): Promise<string> {
  if (!payloadB64) return "";
  const data = b64ToBytes(payloadB64);
  const iv = data.slice(0, 12);
  const ct = data.slice(12);
  const pt = await crypto.subtle.decrypt({ name: "AES-GCM", iv }, key, ct);
  return new TextDecoder().decode(pt);
}

// ---------------------------------------------------------------------------
// Verifier da senha-mestra (não guardamos hash da senha)
// ---------------------------------------------------------------------------
export function makeVerifier(key: CryptoKey): Promise<string> {
  return encryptField(key, VERIFIER_CANARY);
}

/** true se a chave decifra corretamente o verifier (senha-mestra correta). */
export async function verify(key: CryptoKey, verifierB64: string): Promise<boolean> {
  try {
    return (await decryptField(key, verifierB64)) === VERIFIER_CANARY;
  } catch {
    return false;
  }
}

// ---------------------------------------------------------------------------
// Medidor de força de senha
// ---------------------------------------------------------------------------
export interface Strength {
  score: 0 | 1 | 2 | 3 | 4;
  label: string;
  ok: boolean;
}
const STRENGTH_LABELS = ["Muito fraca", "Fraca", "Média", "Forte", "Muito forte"];

export function passwordStrength(pw: string): Strength {
  let s = 0;
  if (pw.length >= 8) s++;
  if (pw.length >= 12) s++;
  const classes =
    (/[a-z]/.test(pw) ? 1 : 0) +
    (/[A-Z]/.test(pw) ? 1 : 0) +
    (/[0-9]/.test(pw) ? 1 : 0) +
    (/[^A-Za-z0-9]/.test(pw) ? 1 : 0);
  if (classes >= 2) s++;
  if (classes >= 3) s++;
  if (pw.length >= 16 && classes >= 3) s++;
  if (pw.length < 6) s = 0;
  const score = Math.min(4, s) as Strength["score"];
  return { score, label: STRENGTH_LABELS[score], ok: score >= MIN_MASTER_STRENGTH };
}

// ---------------------------------------------------------------------------
// Gerador de senhas
// ---------------------------------------------------------------------------
export interface GenOptions {
  length: number;
  upper: boolean;
  lower: boolean;
  digits: boolean;
  symbols: boolean;
  avoidAmbiguous: boolean;
}
const AMBIGUOUS = new Set("Il1O0o5S2Z8B|`'\"{}[]()/\\".split(""));

/** Seleção aleatória uniforme (rejection sampling) usando crypto.getRandomValues. */
function pick<T>(arr: T[]): T {
  const max = Math.floor(256 / arr.length) * arr.length;
  const buf = new Uint8Array(1);
  let v: number;
  do {
    crypto.getRandomValues(buf);
    v = buf[0];
  } while (v >= max);
  return arr[v % arr.length];
}

export function generatePassword(opts: GenOptions): string {
  const sets: string[][] = [];
  if (opts.lower) sets.push("abcdefghijklmnopqrstuvwxyz".split(""));
  if (opts.upper) sets.push("ABCDEFGHIJKLMNOPQRSTUVWXYZ".split(""));
  if (opts.digits) sets.push("0123456789".split(""));
  if (opts.symbols) sets.push("!@#$%^&*-_=+?".split(""));
  let pools = sets.map((set) => (opts.avoidAmbiguous ? set.filter((c) => !AMBIGUOUS.has(c)) : set));
  pools = pools.filter((p) => p.length > 0);
  if (pools.length === 0) pools = ["abcdefghijkmnpqrstuvwxyz".split("")];

  const length = Math.max(4, Math.min(128, opts.length));
  const all = pools.flat();
  const chars: string[] = [];
  // Garante ao menos um de cada classe selecionada.
  for (const pool of pools) chars.push(pick(pool));
  while (chars.length < length) chars.push(pick(all));
  // Embaralha (Fisher–Yates com aleatoriedade forte).
  for (let i = chars.length - 1; i > 0; i--) {
    const j = pick(Array.from({ length: i + 1 }, (_, k) => k));
    [chars[i], chars[j]] = [chars[j], chars[i]];
  }
  return chars.join("");
}
