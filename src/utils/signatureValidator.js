/**
 * 簽章圖片安全與合法性驗證工具 (D-06, D-133, T-12)
 * 嚴格檢查 Magic Bytes 與 MIME 類型，防範非圖檔文字偽裝成簽章
 */

const PNG_MAGIC = [0x89, 0x50, 0x4E, 0x47, 0x0D, 0x0A, 0x1A, 0x0A];
const JPEG_MAGIC = [0xFF, 0xD8, 0xFF];

/**
 * 將 Base64 字串解碼為 Uint8Array
 * @param {string} base64Str 
 * @returns {Uint8Array}
 */
export function base64ToBytes(base64Str) {
  if (typeof atob === 'function') {
    const binary = atob(base64Str);
    const bytes = new Uint8Array(binary.length);
    for (let i = 0; i < binary.length; i++) {
      bytes[i] = binary.charCodeAt(i);
    }
    return bytes;
  }
  // Node.js 環境支援
  if (typeof globalThis !== 'undefined' && typeof globalThis.Buffer !== 'undefined') {
    return new Uint8Array(globalThis.Buffer.from(base64Str, 'base64'));
  }
  throw new Error('No base64 decoder available');
}

/**
 * 驗證簽章資料字串是否為合法的 PNG 或 JPEG 圖片
 * @param {string} dataUrl 
 * @returns {{ valid: boolean, error?: string, format?: 'png' | 'jpeg', byteLength?: number }}
 */
export function validateSignatureDataUrl(dataUrl) {
  if (!dataUrl || typeof dataUrl !== 'string') {
    return { valid: false, error: '簽章資料為空或格式不符' };
  }

  const trimmed = dataUrl.trim();
  const match = trimmed.match(/^data:image\/(png|jpeg|jpg);base64,(.+)$/i);
  if (!match) {
    return { valid: false, error: '檔案格式錯誤，請上傳 PNG 或 JPG 格式之簽章圖檔' };
  }

  const mimeSubtype = match[1].toLowerCase();
  const base64Data = match[2];

  let bytes;
  try {
    bytes = base64ToBytes(base64Data);
  } catch {
    return { valid: false, error: '簽章圖片 Base64 編碼損毀' };
  }

  if (bytes.length < 8) {
    return { valid: false, error: '簽章圖片檔案過小或損毀' };
  }

  // Magic bytes 檢查
  const isPng = PNG_MAGIC.every((byte, idx) => bytes[idx] === byte);
  const isJpeg = JPEG_MAGIC.every((byte, idx) => bytes[idx] === byte);

  if (mimeSubtype === 'png' && !isPng) {
    return { valid: false, error: '檔案檔頭不符，並非有效的 PNG 圖片' };
  }
  if ((mimeSubtype === 'jpeg' || mimeSubtype === 'jpg') && !isJpeg) {
    return { valid: false, error: '檔案檔頭不符，並非有效的 JPG 圖片' };
  }
  if (!isPng && !isJpeg) {
    return { valid: false, error: '僅支援 PNG 與 JPG 圖片格式' };
  }

  return {
    valid: true,
    format: isPng ? 'png' : 'jpeg',
    byteLength: bytes.length
  };
}
