import { createHmac, timingSafeEqual } from "node:crypto";

const b64url = (buf: Buffer) => buf.toString("base64url");

export function signToken(payload: object, secret: string): string {
  const body = b64url(Buffer.from(JSON.stringify(payload)));
  const mac = b64url(createHmac("sha256", secret).update(body).digest());
  return `${body}.${mac}`;
}

export function verifyToken<T>(token: string, secret: string): T | null {
  const [body, mac] = token.split(".");
  if (!body || !mac) return null;
  const expected = createHmac("sha256", secret).update(body).digest();
  let given: Buffer;
  try {
    given = Buffer.from(mac, "base64url");
  } catch {
    return null;
  }
  if (given.length !== expected.length || !timingSafeEqual(given, expected)) {
    return null;
  }
  try {
    return JSON.parse(Buffer.from(body, "base64url").toString()) as T;
  } catch {
    return null;
  }
}
