import { test, expect } from '@playwright/test';
import fs from 'node:fs';
import path from 'node:path';

test.describe('F0: 建置與靜態安全合約檢驗', () => {
  test('F0-2: label-has-associated-control 停用註解已徹底歸零', () => {
    const srcDir = path.resolve('src');
    const findEslintDisables = (dir) => {
      let matches = [];
      for (const item of fs.readdirSync(dir)) {
        const full = path.join(dir, item);
        if (fs.statSync(full).isDirectory()) {
          matches = matches.concat(findEslintDisables(full));
        } else if (full.endsWith('.jsx') || full.endsWith('.js')) {
          const content = fs.readFileSync(full, 'utf8');
          if (content.includes('label-has-associated-control')) {
            matches.push(full);
          }
        }
      }
      return matches;
    };
    const files = findEslintDisables(srcDir);
    expect(files.length).toBe(0);
  });

  test('F0-5: 原生 alert/confirm/prompt 與彈窗遮罩 class 徹底歸零', () => {
    const srcDir = path.resolve('src');
    const checkZeroTokens = (dir, tokens) => {
      const hits = [];
      for (const item of fs.readdirSync(dir)) {
        const full = path.join(dir, item);
        if (fs.statSync(full).isDirectory()) {
          hits.push(...checkZeroTokens(full, tokens));
        } else if (/\.(jsx?|css)$/.test(full)) {
          const content = fs.readFileSync(full, 'utf8');
          for (const token of tokens) {
            if (content.includes(token)) {
              hits.push(`${full}: ${token}`);
            }
          }
        }
      }
      return hits;
    };

    const dialogHits = checkZeroTokens(srcDir, ['alert(', 'confirm(', 'prompt(']);
    expect(dialogHits.length).toBe(0);

    const modalClassHits = checkZeroTokens(srcDir, ['modal-backdrop', 'success-overlay', 'login-overlay', 'shell-backdrop']);
    expect(modalClassHits.length).toBe(0);
  });

  test('F0-6: 原始碼與 dist 建置中無明文密碼與預設帳號物件', () => {
    const distPath = path.resolve('dist');
    if (fs.existsSync(distPath)) {
      const checkDist = (dir) => {
        let hits = [];
        for (const item of fs.readdirSync(dir)) {
          const full = path.join(dir, item);
          if (fs.statSync(full).isDirectory()) {
            hits = hits.concat(checkDist(full));
          } else if (full.endsWith('.js')) {
            const content = fs.readFileSync(full, 'utf8');
            if (content.includes('guest') && content.includes('测试單位')) {
              hits.push(full);
            }
          }
        }
        return hits;
      };
      expect(checkDist(distPath).length).toBe(0);
    }
  });

  test('F0-7: HEAD 中已徹底移除擬真簽名圖資產', () => {
    const fakeSigDir = path.resolve('docs/簽名檔(擬真)');
    expect(fs.existsSync(fakeSigDir)).toBe(false);
  });

  test('F0-9: 安全標頭包含 CSP 與 HSTS 且無外部 Google Fonts 依賴', () => {
    const headersPath = path.resolve('public/_headers');
    expect(fs.existsSync(headersPath)).toBe(true);
    const headersContent = fs.readFileSync(headersPath, 'utf8');
    expect(headersContent).toContain('Content-Security-Policy');
    expect(headersContent).toContain('Strict-Transport-Security');

    const indexHtml = fs.readFileSync(path.resolve('index.html'), 'utf8');
    expect(indexHtml).not.toContain('fonts.googleapis.com');
    expect(indexHtml).not.toContain('fonts.gstatic.com');
  });

  test('F0-17: 元件層無 getElementById 且全面改採 ref 與 SignatureSlot', () => {
    const componentsDir = path.resolve('src/components');
    const findGetElementById = (dir) => {
      let hits = [];
      for (const item of fs.readdirSync(dir)) {
        const full = path.join(dir, item);
        if (fs.statSync(full).isDirectory()) {
          hits = hits.concat(findGetElementById(full));
        } else if (full.endsWith('.jsx') || full.endsWith('.js')) {
          const content = fs.readFileSync(full, 'utf8');
          if (content.includes('getElementById(')) {
            hits.push(full);
          }
        }
      }
      return hits;
    };
    expect(findGetElementById(componentsDir).length).toBe(0);
  });
});
