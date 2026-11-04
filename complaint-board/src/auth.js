import crypto from "node:crypto";

const SECRET_KEY = process.env.SESSION_SECRET || "complaint-board-super-secure-hmac-secret-key-2026";

/**
 * 비밀번호 scrypt 기반 안전한 해시 생성 (salt:hash)
 */
export function hashPassword(password) {
  const salt = crypto.randomBytes(16).toString("hex");
  const derivedKey = crypto.scryptSync(password, salt, 64);
  return `${salt}:${derivedKey.toString("hex")}`;
}

/**
 * 비밀번호 검증 (timingSafeEqual 적용)
 */
export function verifyPassword(password, storedHash) {
  try {
    const [salt, key] = storedHash.split(":");
    if (!salt || !key) return false;
    const derivedKey = crypto.scryptSync(password, salt, 64);
    const keyBuffer = Buffer.from(key, "hex");
    return crypto.timingSafeEqual(derivedKey, keyBuffer);
  } catch {
    return false;
  }
}

/**
 * 관리자 세션 토큰 서명 발급
 */
export function createSessionToken(payload, expiresInMs = 24 * 60 * 60 * 1000) {
  const data = JSON.stringify({
    ...payload,
    exp: Date.now() + expiresInMs,
  });
  const dataB64 = Buffer.from(data).toString("base64url");
  const signature = crypto
    .createHmac("sha256", SECRET_KEY)
    .update(dataB64)
    .digest("base64url");
  return `${dataB64}.${signature}`;
}

/**
 * 관리자 세션 토큰 검증
 */
export function verifySessionToken(token) {
  if (!token || typeof token !== "string") return null;
  const parts = token.split(".");
  if (parts.length !== 2) return null;

  const [dataB64, signature] = parts;
  const expectedSignature = crypto
    .createHmac("sha256", SECRET_KEY)
    .update(dataB64)
    .digest("base64url");

  if (signature !== expectedSignature) return null;

  try {
    const payload = JSON.parse(Buffer.from(dataB64, "base64url").toString("utf8"));
    if (payload.exp && Date.now() > payload.exp) {
      return null; // 만료됨
    }
    return payload;
  } catch {
    return null;
  }
}

/**
 * HTTP Cookie 파싱 헬퍼
 */
export function parseCookies(cookieHeader) {
  const list = {};
  if (!cookieHeader) return list;

  cookieHeader.split(";").forEach((cookie) => {
    let [name, ...rest] = cookie.split("=");
    name = name?.trim();
    if (!name) return;
    const value = rest.join("=").trim();
    list[name] = decodeURIComponent(value);
  });

  return list;
}

