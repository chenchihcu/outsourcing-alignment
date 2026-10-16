/**
 * 本機離線帳號密碼安全雜湊與驗證工具 (D-02, D-139)
 * 使用 Web Crypto API PBKDF2 (SHA-256, 100,000 次迭代, 16 bytes 隨機鹽值)
 * 絕不以明文儲存密碼，且存入 current_user 快照時自動剔除密碼欄位。
 */

const ITERATIONS = 100000;
const HASH_ALG = 'SHA-256';

/**
 * 將 Uint8Array 轉為 Hex 字串
 * @param {Uint8Array} bytes 
 * @returns {string}
 */
function bytesToHex(bytes) {
  return Array.from(bytes)
    .map((b) => b.toString(16).padStart(2, '0'))
    .join('');
}

/**
 * 將 Hex 字串轉為 Uint8Array
 * @param {string} hex 
 * @returns {Uint8Array}
 */
function hexToBytes(hex) {
  const bytes = new Uint8Array(hex.length / 2);
  for (let i = 0; i < hex.length; i += 2) {
    bytes[i / 2] = parseInt(hex.substring(i, i + 2), 16);
  }
  return bytes;
}

/**
 * 取得隨機鹽值
 * @param {number} length 
 * @returns {string} Hex 格式鹽值
 */
export function generateSalt(length = 16) {
  const bytes = new Uint8Array(length);
  const webCrypto = typeof globalThis !== 'undefined' && globalThis.crypto ? globalThis.crypto : null;
  if (webCrypto?.getRandomValues) {
    webCrypto.getRandomValues(bytes);
  } else {
    for (let i = 0; i < length; i++) {
      bytes[i] = Math.floor(Math.random() * 256);
    }
  }
  return bytesToHex(bytes);
}

/**
 * 計算密碼 PBKDF2 雜湊
 * @param {string} password 
 * @param {string} saltHex 
 * @returns {Promise<string>} Hex 格式雜湊值
 */
export async function hashPassword(password, saltHex) {
  if (!password) throw new Error('密碼不可為空');
  const saltBytes = hexToBytes(saltHex);
  const enc = new TextEncoder();
  const passwordBytes = enc.encode(password);

  const webCrypto = typeof globalThis !== 'undefined' && globalThis.crypto ? globalThis.crypto : null;
  if (!webCrypto || !webCrypto.subtle) {
    throw new Error('Web Crypto API 不可用');
  }

  const key = await webCrypto.subtle.importKey(
    'raw',
    passwordBytes,
    { name: 'PBKDF2' },
    false,
    ['deriveBits']
  );

  const derivedBits = await webCrypto.subtle.deriveBits(
    {
      name: 'PBKDF2',
      salt: saltBytes,
      iterations: ITERATIONS,
      hash: HASH_ALG,
    },
    key,
    256 // 32 bytes
  );

  return bytesToHex(new Uint8Array(derivedBits));
}

/**
 * 驗證使用者輸入密碼是否與帳號儲存之雜湊或舊明文吻合 (D-02, D-135)
 * @param {string} inputPassword 
 * @param {Object} account 
 * @returns {Promise<boolean>}
 */
export async function verifyAccountPassword(inputPassword, account) {
  if (!account || !inputPassword) return false;

  // 1. 若帳號已升級為 PBKDF2 雜湊儲存
  if (account.passwordHash && account.passwordSalt) {
    const computedHash = await hashPassword(inputPassword, account.passwordSalt);
    return computedHash === account.passwordHash;
  }

  // 2. 若為尚未遷移的舊明文密碼 (向後相容一次性驗證)
  if (typeof account.password === 'string') {
    return inputPassword === account.password;
  }

  return false;
}

/**
 * 將帳號物件安全清洗為目前使用者快照，剔除密碼、雜湊與鹽值 (D-139)
 * @param {Object} account 
 * @returns {Object}
 */
export function sanitizeUserForSession(account) {
  if (!account) return null;
  const clone = { ...account };
  delete clone.password;
  delete clone.passwordHash;
  delete clone.passwordSalt;
  return clone;
}

/**
 * 檢查並將帳號清單中的舊明文密碼遷移為 PBKDF2 雜湊 (D-02)
 * @param {Array} accounts 
 * @returns {Promise<Array>}
 */
export async function migrateAccountsToHashed(accounts) {
  if (!Array.isArray(accounts)) return [];
  let modified = false;

  const migrated = await Promise.all(
    accounts.map(async (acc) => {
      // 若已是雜湊且無明文，保留
      if (acc.passwordHash && acc.passwordSalt && !acc.password) {
        return acc;
      }

      modified = true;
      const plainPassword = acc.password || 'password123';
      const salt = acc.passwordSalt || generateSalt();
      const hash = await hashPassword(plainPassword, salt);

      const updated = {
        ...acc,
        passwordHash: hash,
        passwordSalt: salt,
      };
      delete updated.password; // 徹底刪除明文
      return updated;
    })
  );

  return { migrated, modified };
}
