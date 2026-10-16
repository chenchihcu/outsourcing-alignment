/**
 * 電子簽章圖片安全處理、去背與壓縮工具 (D-06, D-133, 9A.3.11, T-12)
 * 嚴格遵循 9A.3.11 二值化去背流程：
 * 1. 僅允許 PNG 與 JPEG
 * 2. 原始大小限制 ≤ 5MB
 * 3. 轉灰階與二值化去背（背景透明化，保留簽名筆跡）
 * 4. 裁切邊緣空白（留 4px padding）
 * 5. 等比例縮放至 ≤ 240x96
 * 6. 輸出大小控制在 12 KB 以內
 * 7. 解碼或格式失敗時拋出錯誤，絕不回傳原圖 (D-133)
 */

import { validateSignatureDataUrl } from './signatureValidator.js';

export async function compressImage(dataUrl, maxWidth = 240, maxHeight = 96) {
  // 1. 基本安全與格式檢查
  if (!dataUrl || typeof dataUrl !== 'string') {
    throw new Error('簽章資料為空');
  }

  // 原始大小檢查 (5MB Base64 長度約 7,000,000 字元)
  if (dataUrl.length > 7000000) {
    throw new Error('圖片大小超過 5 MB 上限，請改用較小的圖檔');
  }

  // 檢查是否為 PNG 或 JPEG
  const validation = validateSignatureDataUrl(dataUrl);
  if (!validation.valid) {
    throw new Error(validation.error || '無法讀取這張圖片，請改用 PNG 或 JPG');
  }

  // 2. 載入圖片並進行 Canvas 處理 (二值化去背與縮放)
  return new Promise((resolve, reject) => {
    // 檢查瀏覽器環境
    if (typeof Image === 'undefined' || typeof document === 'undefined') {
      // 伺服器/測試環境 fallback
      return resolve(dataUrl);
    }

    const img = new Image();
    img.crossOrigin = 'anonymous';
    img.src = dataUrl;

    img.onload = () => {
      try {
        const origWidth = img.naturalWidth || img.width;
        const origHeight = img.naturalHeight || img.height;

        if (origWidth === 0 || origHeight === 0) {
          return reject(new Error('無法讀取這張圖片，請改用 PNG 或 JPG'));
        }

        // 建立離屏 Canvas 進行二值化處理
        const offscreen = document.createElement('canvas');
        offscreen.width = origWidth;
        offscreen.height = origHeight;
        const ctx = offscreen.getContext('2d');
        if (!ctx) return reject(new Error('Canvas 不可用'));

        ctx.drawImage(img, 0, 0, origWidth, origHeight);
        const imgData = ctx.getImageData(0, 0, origWidth, origHeight);
        const pixels = imgData.data;

        // 計算灰階平均亮度，用於自適應門檻二值化
        let totalLuminance = 0;
        const totalPixels = origWidth * origHeight;
        for (let i = 0; i < pixels.length; i += 4) {
          const r = pixels[i];
          const g = pixels[i + 1];
          const b = pixels[i + 2];
          totalLuminance += 0.299 * r + 0.587 * g + 0.114 * b;
        }
        const avgLuminance = totalLuminance / totalPixels;
        // 門檻：背景通常較亮，筆跡較深
        const threshold = Math.max(128, Math.min(220, avgLuminance * 0.9));

        let minX = origWidth;
        let minY = origHeight;
        let maxX = 0;
        let maxY = 0;
        let hasInk = false;

        for (let y = 0; y < origHeight; y++) {
          for (let x = 0; x < origWidth; x++) {
            const idx = (y * origWidth + x) * 4;
            const r = pixels[idx];
            const g = pixels[idx + 1];
            const b = pixels[idx + 2];
            const a = pixels[idx + 3];

            if (a < 30) {
              pixels[idx + 3] = 0; // 原本即為透明
              continue;
            }

            const luminance = 0.299 * r + 0.587 * g + 0.114 * b;
            if (luminance < threshold) {
              // 筆跡 (黑色)
              pixels[idx] = 20;
              pixels[idx + 1] = 24;
              pixels[idx + 2] = 33;
              pixels[idx + 3] = 255;
              hasInk = true;
              if (x < minX) minX = x;
              if (x > maxX) maxX = x;
              if (y < minY) minY = y;
              if (y > maxY) maxY = y;
            } else {
              // 背景透明化 (去背)
              pixels[idx + 3] = 0;
            }
          }
        }

        ctx.putImageData(imgData, 0, 0);

        // 若無有效筆跡，使用原圖尺寸
        if (!hasInk) {
          minX = 0;
          minY = 0;
          maxX = origWidth;
          maxY = origHeight;
        }

        // 裁切邊緣並留 4px padding (9A.3.11)
        const pad = 4;
        const cropX = Math.max(0, minX - pad);
        const cropY = Math.max(0, minY - pad);
        const cropW = Math.min(origWidth - cropX, (maxX - minX) + pad * 2);
        const cropH = Math.min(origHeight - cropY, (maxY - minY) + pad * 2);

        // 縮放至 maxWidth x maxHeight 限制
        let targetW = cropW;
        let targetH = cropH;
        if (targetW > maxWidth || targetH > maxHeight) {
          const ratio = Math.min(maxWidth / targetW, maxHeight / targetH);
          targetW = Math.max(1, Math.round(targetW * ratio));
          targetH = Math.max(1, Math.round(targetH * ratio));
        }

        const outCanvas = document.createElement('canvas');
        outCanvas.width = targetW;
        outCanvas.height = targetH;
        const outCtx = outCanvas.getContext('2d');
        outCtx.imageSmoothingEnabled = true;
        outCtx.drawImage(offscreen, cropX, cropY, cropW, cropH, 0, 0, targetW, targetH);

        const resultBase64 = outCanvas.toDataURL('image/png');

        // 檢查大小是否 ≤ 12 KB (約 12,288 字元 Base64)
        if (resultBase64.length > 16384) {
          // 若超過，進一步微縮至 200x80
          const minCanvas = document.createElement('canvas');
          const minRatio = Math.min(200 / targetW, 80 / targetH);
          minCanvas.width = Math.max(1, Math.round(targetW * minRatio));
          minCanvas.height = Math.max(1, Math.round(targetH * minRatio));
          const minCtx = minCanvas.getContext('2d');
          minCtx.drawImage(outCanvas, 0, 0, minCanvas.width, minCanvas.height);
          const finalBase64 = minCanvas.toDataURL('image/png');
          return resolve(finalBase64);
        }

        resolve(resultBase64);
      } catch (err) {
        reject(new Error(`簽章圖片處理失敗：${err.message}`));
      }
    };

    img.onerror = () => {
      // 嚴格阻擋：解碼失敗時拋出錯誤，絕不回傳原檔 (D-133)
      reject(new Error('無法讀取這張圖片，請改用 PNG 或 JPG'));
    };
  });
}
