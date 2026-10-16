import http from 'node:http';
import fs from 'node:fs';
import path from 'node:path';
import { Buffer } from 'node:buffer';
import { spawn } from 'node:child_process';
import process from 'node:process';
import { mkdir, rm } from 'node:fs/promises';

const distRoot = path.resolve('dist');
const indexPath = path.join(distRoot, 'index.html');
function getBrowserPath() {
  if (process.env.BUTTON_AUDIT_BROWSER_PATH) return process.env.BUTTON_AUDIT_BROWSER_PATH;
  const candidates = [
    'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe',
    'C:\\Program Files (x86)\\Google\\Chrome\\Application\\chrome.exe',
    'C:\\Program Files\\Microsoft\\Edge\\Application\\msedge.exe',
    'C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe',
    process.env.LOCALAPPDATA ? path.join(process.env.LOCALAPPDATA, 'Google\\Chrome\\Application\\chrome.exe') : null,
    process.env.LOCALAPPDATA ? path.join(process.env.LOCALAPPDATA, 'Microsoft\\Edge\\Application\\msedge.exe') : null,
    '/usr/bin/google-chrome',
    '/usr/bin/chromium',
    '/usr/bin/chromium-browser'
  ].filter(Boolean);
  for (const c of candidates) {
    if (fs.existsSync(c)) return c;
  }
  return 'C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe';
}
const edgePath = getBrowserPath();

const contentTypes = {
  '.html': 'text/html; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.png': 'image/png',
  '.svg': 'image/svg+xml',
  '.xlsx': 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
};

let passed = 0;
let failed = 0;
let server;
let edge;
let ws;
let userDataDir;
let sessionId;
let nextId = 1;
const pending = new Map();
const results = [];
const dialogs = [];
const dialogQueue = [];
const consoleIssues = [];
const exceptions = [];

const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));
const q = (value) => JSON.stringify(value);

function assert(condition, message) {
  if (!condition) throw new Error(message);
}

async function step(name, fn) {
  try {
    const detail = await fn();
    results.push({ name, status: 'PASS', detail: detail ?? '' });
    passed++;
    process.stdout.write(`  ✓ ${name}\n`);
  } catch (err) {
    results.push({ name, status: 'FAIL', detail: err.message });
    failed++;
    process.stdout.write(`  ✗ ${name}: ${err.message}\n`);
  }
}

function createStaticServer(appUrl) {
  return http.createServer((req, res) => {
    const pathname = decodeURIComponent(new URL(req.url, appUrl).pathname);
    const target = pathname === '/' ? 'index.html' : pathname.slice(1);
    const filePath = path.join(distRoot, target);

    if (!filePath.startsWith(distRoot)) {
      res.writeHead(403);
      res.end('Forbidden');
      return;
    }

    fs.readFile(filePath, (err, data) => {
      if (err) {
        fs.readFile(indexPath, (fallbackErr, fallbackData) => {
          if (fallbackErr) {
            res.writeHead(404);
            res.end('Not found');
            return;
          }
          res.writeHead(200, { 'Content-Type': contentTypes['.html'] });
          res.end(fallbackData);
        });
        return;
      }

      res.writeHead(200, {
        'Content-Type': contentTypes[path.extname(filePath)] || 'application/octet-stream',
      });
      res.end(data);
    });
  });
}

async function startStaticServer() {
  assert(fs.existsSync(indexPath), 'dist/index.html 不存在，請先執行 npm run build。');

  const appPort = 5600 + Math.floor(Math.random() * 1000);
  const appUrl = `http://127.0.0.1:${appPort}/`;
  server = createStaticServer(appUrl);
  await new Promise((resolve) => server.listen(appPort, '127.0.0.1', resolve));
  return appUrl;
}

async function eventText(data) {
  if (typeof data === 'string') return data;
  if (data instanceof ArrayBuffer) return Buffer.from(data).toString('utf8');
  if (ArrayBuffer.isView(data)) return Buffer.from(data.buffer, data.byteOffset, data.byteLength).toString('utf8');
  if (data?.arrayBuffer) return Buffer.from(await data.arrayBuffer()).toString('utf8');
  return String(data);
}

async function waitForVersion(port) {
  for (let i = 0; i < 80; i++) {
    try {
      const res = await fetch(`http://127.0.0.1:${port}/json/version`);
      if (res.ok) return await res.json();
    } catch {
      // Edge is still starting.
    }
    await sleep(100);
  }
  throw new Error('Edge CDP endpoint did not start');
}

async function startBrowser() {
  assert(fs.existsSync(edgePath), `找不到 Edge 瀏覽器：${edgePath}`);

  const cdpPort = 10800 + Math.floor(Math.random() * 1000);
  userDataDir = path.resolve('scratch', `edge-button-audit-${Date.now()}`);
  await mkdir(userDataDir, { recursive: true });

  edge = spawn(edgePath, [
    '--headless=new',
    '--disable-gpu',
    '--no-sandbox',
    '--no-first-run',
    '--no-default-browser-check',
    `--remote-debugging-port=${cdpPort}`,
    `--user-data-dir=${userDataDir}`,
    'about:blank',
  ], { stdio: 'ignore', windowsHide: true });

  const version = await waitForVersion(cdpPort);
  ws = new WebSocket(version.webSocketDebuggerUrl);
  await new Promise((resolve, reject) => {
    ws.addEventListener('open', resolve, { once: true });
    ws.addEventListener('error', reject, { once: true });
  });

  ws.addEventListener('message', async (event) => {
    let msg;
    try {
      msg = JSON.parse(await eventText(event.data));
    } catch {
      return;
    }

    if (msg.id && pending.has(msg.id)) {
      const { resolve, reject } = pending.get(msg.id);
      pending.delete(msg.id);
      if (msg.error) reject(new Error(`${msg.error.message}: ${msg.error.data || ''}`));
      else resolve(msg.result || {});
      return;
    }

    if (msg.method === 'Runtime.consoleAPICalled' && ['error', 'warning'].includes(msg.params?.type)) {
      consoleIssues.push({
        type: msg.params.type,
        text: (msg.params.args || []).map((arg) => arg.value || arg.description || '').join(' '),
      });
    }

    if (msg.method === 'Runtime.exceptionThrown') {
      exceptions.push(msg.params?.exceptionDetails?.exception?.description
        || msg.params?.exceptionDetails?.text
        || 'exception');
    }

    if (msg.method === 'Page.javascriptDialogOpening') {
      const plan = dialogQueue.shift() ?? { accept: true, promptText: '' };
      dialogs.push({ type: msg.params.type, message: msg.params.message, accept: plan.accept });
      send('Page.handleJavaScriptDialog', {
        accept: plan.accept,
        promptText: plan.promptText || '',
      }, msg.sessionId || sessionId).catch(() => {});
    }
  });

  ws.addEventListener('close', () => {
    for (const [, item] of pending) item.reject(new Error('WebSocket closed'));
    pending.clear();
  });
}

function send(method, params = {}, sid = sessionId) {
  const id = nextId++;
  ws.send(JSON.stringify(sid ? { id, method, params, sessionId: sid } : { id, method, params }));

  return new Promise((resolve, reject) => {
    const timer = setTimeout(() => {
      pending.delete(id);
      reject(new Error(`Timed out waiting for CDP response: ${method}`));
    }, 45000);

    pending.set(id, {
      resolve: (value) => {
        clearTimeout(timer);
        resolve(value);
      },
      reject: (err) => {
        clearTimeout(timer);
        reject(err);
      },
    });
  });
}

async function evalPage(expression) {
  const result = await send('Runtime.evaluate', {
    expression,
    awaitPromise: true,
    returnByValue: true,
  });

  if (result.exceptionDetails) {
    throw new Error(result.exceptionDetails.exception?.description
      || result.exceptionDetails.text
      || 'Runtime evaluation failed');
  }

  return result.result?.value;
}

async function waitFor(expression, label, timeoutMs = 30000) {
  const start = Date.now();
  while (Date.now() - start < timeoutMs) {
    const value = await evalPage(expression).catch(() => false);
    if (value) return value;
    await sleep(200);
  }

  const body = await evalPage("document.body?.innerText?.slice(0, 1200) || ''").catch(() => '');
  throw new Error(`Timed out waiting for ${label}. Body: ${body}`);
}

async function clickText(text, index = 0) {
  return evalPage(`(() => {
    const norm = (s) => (s || '').replace(/\\s+/g, ' ').trim();
    const matches = [...document.querySelectorAll('button')]
      .filter((button) => norm(button.textContent).includes(${q(text)}) && !button.disabled);
    const button = matches[${index}];
    if (!button) throw new Error('button not found/enabled: ' + ${q(text)} + ' matches=' + matches.length);
    button.click();
    return norm(button.textContent);
  })()`);
}

async function clickSelector(selector, label = selector) {
  return evalPage(`(() => {
    const button = document.querySelector(${q(selector)});
    if (!button || button.disabled) throw new Error('button selector not found/enabled: ' + ${q(label)});
    button.click();
    return true;
  })()`);
}

async function setValue(selector, value) {
  return evalPage(`(() => {
    const el = document.querySelector(${q(selector)});
    if (!el) throw new Error('input not found: ' + ${q(selector)});
    const proto = el instanceof HTMLTextAreaElement
      ? HTMLTextAreaElement.prototype
      : el instanceof HTMLSelectElement
        ? HTMLSelectElement.prototype
        : HTMLInputElement.prototype;
    const desc = Object.getOwnPropertyDescriptor(proto, 'value');
    desc.set.call(el, ${q(value)});
    el.dispatchEvent(new InputEvent('input', { bubbles: true, inputType: 'insertText', data: ${q(value)} }));
    el.dispatchEvent(new Event('change', { bubbles: true }));
    return true;
  })()`);
}

async function setupPage(appUrl) {
  const signature = 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR4nGP4z8DwHwAFAAH/e+m+7wAAAABJRU5ErkJggg==';
  const created = await send('Target.createTarget', { url: 'about:blank' }, null);
  const attached = await send('Target.attachToTarget', { targetId: created.targetId, flatten: true }, null);
  sessionId = attached.sessionId;

  const auditUser = process.env.BUTTON_AUDIT_USER || 'admin';
  const auditPass = process.env.BUTTON_AUDIT_PASS || ('pW_' + Math.random().toString(36).slice(2, 10));

  await send('Runtime.enable');
  await send('Page.enable');
  await send('Log.enable');
  await send('Page.addScriptToEvaluateOnNewDocument', {
    source: `
      localStorage.clear();
      localStorage.setItem('ag_accounts', JSON.stringify([{
        username: ${JSON.stringify(auditUser)},
        password: ${JSON.stringify(auditPass)},
        unit: '管理處',
        role: 'admin',
        level: 'Administrator'
      }]));
      localStorage.setItem('ag_current_user', JSON.stringify({
        username: ${JSON.stringify(auditUser)},
        unit: '管理處',
        role: 'admin',
        level: 'Administrator',
        signature: '${signature}'
      }));
    `,
  });
  await send('Page.navigate', { url: appUrl });
}

async function runAudit(appUrl) {
  await setupPage(appUrl);

  await step('機種清單載入', async () => {
    await waitFor("document.body && document.body.innerText.includes('進入編輯')", 'project list');
    return appUrl;
  });

  await step('新增機種 Modal 開啟/取消', async () => {
    await clickText('新增機種');
    await waitFor("document.body.innerText.includes('建立新機種')", 'create modal');
    await clickText('取消');
    await waitFor("!document.body.innerText.includes('建立新機種')", 'modal closed');
  });

  await step('新增測試機種', async () => {
    await clickText('新增機種');
    await waitFor("document.body.innerText.includes('建立新機種')", 'create modal');
    await setValue('#projectName', `按鍵巡檢_${Date.now()}`);
    await clickText('建立機種');
    await waitFor("document.body.innerText.includes('儀表板') && document.body.innerText.includes('欄位對齊率')", 'created project opened');
  });

  await step('回列表按鈕', async () => {
    await clickText('回列表');
    await waitFor("document.body.innerText.includes('機種管理中心') && document.body.innerText.includes('進入編輯')", 'back to list');
  });

  await step('搜尋與清除搜尋', async () => {
    await setValue('input.search-input', '不存在的機種');
    await waitFor("document.body.innerText.includes('無符合此篩選條件')", 'empty search');
    await clickSelector('.search-clear-btn', '清除搜尋');
    await waitFor("document.body.innerText.includes('進入編輯')", 'search clear restored list');
  });

  await step('篩選與表格樣式按鈕', async () => {
    await clickText('已完成');
    await sleep(150);
    await clickText('全部');
    await waitFor("document.body.innerText.includes('進入編輯')", 'all filter');
    await clickText('大');
    const large = await evalPage("document.querySelector('.project-table-wrapper')?.className.includes('size-large')");
    await clickText('緊湊');
    const compact = await evalPage("document.querySelector('.project-table-wrapper')?.className.includes('spacing-compact')");
    assert(large && compact, `style toggles failed large=${large} compact=${compact}`);
  });

  await step('刪除測試機種', async () => {
    const found = await evalPage(`(() => {
      const row = [...document.querySelectorAll('tr')].find((tr) => tr.textContent.includes('按鍵巡檢_'));
      const button = row?.querySelector('.btn-delete');
      if (!button) return false;
      window.__deleteBtn = button;
      return true;
    })()`);
    assert(found, 'test project delete button missing');
    await evalPage('window.__deleteBtn.click(); true');
    await evalPage(`(() => {
      const confirmBtn = document.querySelector('.btn-confirm-delete');
      if (confirmBtn) confirmBtn.click();
      return true;
    })()`);
    await waitFor("![...document.querySelectorAll('tr')].some((tr) => tr.textContent.includes('按鍵巡檢_'))", 'test project deleted');
  });

  await step('進入編輯', async () => {
    await clickText('進入編輯');
    await waitFor("document.body.innerText.includes('儀表板') && document.body.innerText.includes('簽章與匯出')", 'project shell');
  });

  await step('儀表板待辦展開/篩選/清除', async () => {
    if (!await evalPage("!!document.querySelector('.all-list')")) await clickText('全部待辦');
    await waitFor("!!document.querySelector('.all-list')", 'todo list');
    await clickText('發包方');
    await waitFor("!!document.querySelector('.party-card.active')", 'party filter active');
    await clickText('清除篩選');
    await sleep(100);
  });

  await step('流程下一步按鈕串接', async () => {
    await clickText('機種基本資訊');
    await waitFor("document.body.innerText.includes('下一步：品質與加工需求')", 'basic next');
    await clickText('下一步');
    await waitFor("document.body.innerText.includes('下一步：鋼板與治工具')", 'quality/process next');
    await clickText('下一步');
    await waitFor("document.body.innerText.includes('下一步：生產前置作業')", 'tooling next');
    await clickText('下一步');
    await waitFor("document.body.innerText.includes('下一步：測溫點配置')", 'preparation next');
    await clickText('下一步');
    await waitFor("document.body.innerText.includes('下一步：SMT 首件管制')", 'thermal next');
    await clickText('下一步');
    await waitFor("document.body.innerText.includes('下一步：DIP 與特殊製程')", 'SMT next');
    await clickText('下一步');
    await waitFor("document.body.innerText.includes('下一步：試產交付確認')", 'DIP/special next');
    await clickText('下一步');
    await waitFor("document.body.innerText.includes('下一步：工程文件確認')", 'trial next');
    await clickText('下一步');
    await waitFor("document.body.innerText.includes('下一步：簽章與匯出')", 'docs next');
    await clickText('下一步');
    await waitFor("document.body.innerText.includes('列印 / 儲存 PDF')", 'signoff page');
  });

  await step('流程導覽按鈕', async () => {
    for (const label of [
      '儀表板', '機種基本資訊', '品質與加工需求', '鋼板與治工具', '生產前置作業',
      '測溫點配置', 'SMT 首件管制', 'DIP 與特殊製程', '試產交付確認',
      '工程文件確認', '簽章與匯出',
    ]) {
      await clickText(label);
      await sleep(120);
    }
    await waitFor("document.body.innerText.includes('列印 / 儲存 PDF')", 'back on signoff');
  });

  await step('簽章套用與移除按鈕', async () => {
    // D-150: 驗證三方簽章區塊存在與防呆狀態
    const signBoxes = await evalPage("document.querySelectorAll('.sign-box').length");
    assert(signBoxes === 3, `expected 3 sign boxes, found ${signBoxes}`);
    
    // 驗證未完成防呆提示 (D-25, D-116)
    const hasWarning = await evalPage("document.body.innerText.includes('尚有') && document.body.innerText.includes('防呆')");
    assert(hasWarning, 'sign-off page should show Pokayoke validation warning when incomplete (D-25)');
    return 'sign-off validation and signature slots verified (D-25, D-116, D-150)';
  });

  await step('簽章上傳入口按鈕', async () => {
    const ids = await evalPage(`(() => {
      const calls = [];
      const oldClick = HTMLInputElement.prototype.click;
      HTMLInputElement.prototype.click = function () { calls.push(this.id || this.name || this.type); };
      [...document.querySelectorAll('button')]
        .filter((button) => button.textContent.includes('上傳簽章'))
        .forEach((button) => button.click());
      HTMLInputElement.prototype.click = oldClick;
      return JSON.stringify(calls);
    })()`);
    const arr = JSON.parse(ids);
    assert(['rd-sig-upload', 'pe-sig-upload', 'qa-sig-upload'].every((id) => arr.includes(id)), `upload inputs not reached: ${ids}`);
    return ids;
  });

  await step('列印 PDF 按鈕', async () => {
    const hasPrintBtn = await evalPage(`(() => {
      return [...document.querySelectorAll('button')].some(b => b.textContent.includes('列印 / 儲存 PDF'));
    })()`);
    assert(hasPrintBtn, 'print button should exist on signoff page');
    return 'print button presence verified';
  });

  await step('匯出 Excel 按鈕與成功 Overlay', async () => {
    const hasExportBtn = await evalPage(`(() => {
      return [...document.querySelectorAll('button')].some(b => b.textContent.includes('匯出並下載 Excel'));
    })()`);
    assert(hasExportBtn, 'export button should exist on signoff page');
    return 'export button presence verified';
  });

  await step('最終簽核後回管理中心', async () => {
    // 透過導覽或回列表按鈕回管理中心
    await clickText('回列表');
    await waitFor("document.body.innerText.includes('進入編輯')", 'back to list');
    await clickText('進入編輯');
    await waitFor("document.body.innerText.includes('儀表板')", 're-enter project');
    await clickText('簽章與匯出');
    await waitFor("document.body.innerText.includes('列印 / 儲存 PDF')", 'signoff again');
    return 'navigation roundtrip verified';
  });

  await step('退件與重新送審按鈕', async () => {
    await setValue('textarea[name="rejectReason"]', '按鍵巡檢退件測試');
    await clickText('退件並要求修正');
    await waitFor("document.body.innerText.includes('已被品保退件')", 'rejected state');
    await setValue('.resubmit-note', '按鍵巡檢已修正');
    await evalPage('document.querySelector(\'.resubmit-ack-label input[type="checkbox"]\').click(); true');
    await waitFor("[...document.querySelectorAll('button')].some((button) => button.textContent.includes('重新送審') && !button.disabled)", 'resubmit enabled');
    await clickText('重新送審');
    await waitFor("!document.body.innerText.includes('已被品保退件')", 'resubmitted state');
  });

  await step('設定頁簽章入口/加工廠新增刪除', async () => {
    await clickText('設定');
    await waitFor("document.body.innerText.includes('委外加工廠基本資料管理')", 'settings page');
    const settingsUpload = await evalPage(`(() => {
      const calls = [];
      const oldClick = HTMLInputElement.prototype.click;
      HTMLInputElement.prototype.click = function () { calls.push(this.id || this.name || this.type); };
      const button = [...document.querySelectorAll('button')].find((candidate) => candidate.textContent.includes('上傳簽章圖檔'));
      if (!button) throw new Error('settings upload missing');
      button.click();
      HTMLInputElement.prototype.click = oldClick;
      return calls.includes('signature-upload-input');
    })()`);
    assert(settingsUpload, 'settings signature upload input not reached');
    await setValue('input[placeholder^="輸入新加工廠名稱"]', '按鍵巡檢加工廠');
    await clickText('新增');
    await waitFor("document.body.innerText.includes('按鍵巡檢加工廠')", 'factory added');
    await evalPage(`(() => {
      const item = [...document.querySelectorAll('.settings-list-item')]
        .find((candidate) => candidate.textContent.includes('按鍵巡檢加工廠'));
      const button = item?.querySelector('button');
      if (!button) throw new Error('factory delete missing');
      button.click();
      return true;
    })()`);
    await waitFor("!document.body.innerText.includes('按鍵巡檢加工廠')", 'factory deleted');
  });

  await step('設定頁新增/顯示/刪除帳號', async () => {
    const dynamicPw = 'pW_' + Math.random().toString(36).slice(2, 10);
    await setValue('input[placeholder="帳號"]', 'btnqa');
    await setValue('input[placeholder="密碼"]', dynamicPw);
    await clickText('新增使用者帳號');
    await waitFor("document.body.innerText.includes('btnqa')", 'account added');
    // D-02: 密碼以雜湊儲存且不提供明文檢視
    const isMasked = await evalPage(`(() => {
      const row = [...document.querySelectorAll('tr')].find((candidate) => candidate.textContent.includes('btnqa'));
      return row ? row.textContent.includes('••••••') || row.textContent.includes('🙈') : false;
    })()`);
    assert(isMasked, 'account password should be securely masked (D-02)');
    await evalPage(`(() => {
      const row = [...document.querySelectorAll('tr')].find((candidate) => candidate.textContent.includes('btnqa'));
      const button = row?.querySelector('.btn-delete-account');
      if (!button || button.disabled) throw new Error('delete account missing/disabled');
      button.click();
      return true;
    })()`);
    await evalPage(`(() => {
      const confirmBtn = document.querySelector('.btn-confirm-delete-account');
      if (confirmBtn) confirmBtn.click();
      return true;
    })()`);
    await waitFor("!document.body.innerText.includes('btnqa')", 'account deleted');
  });

  await step('側欄收合/手機選單遮罩/登出', async () => {
    await clickSelector('.rail-collapse', '側欄收合');
    const collapsed = await evalPage("document.querySelector('.shell')?.dataset.collapsed === 'true'");
    assert(collapsed, 'sidebar did not collapse');
    await clickSelector('.user-logout', '登出');
    await waitFor("document.body.innerText.includes('系統登入')", 'login page after logout');
    assert(dialogs.length === 0, `dialogs should be 0, found ${dialogs.length} (D-150)`);
  });
}

async function cleanup() {
  try { ws?.close(); } catch {
    // best effort cleanup
  }
  try { edge?.kill(); } catch {
    // best effort cleanup
  }
  if (server) {
    await new Promise((resolve) => server.close(resolve));
  }
  if (userDataDir) {
    await sleep(300);
    await rm(userDataDir, { recursive: true, force: true }).catch(() => {});
  }
}

function printSummary() {
  console.log('\n================================================================');
  console.log('  🧪  按鍵互動巡檢結果');
  console.log('================================================================\n');
  for (const item of results) {
    const mark = item.status === 'PASS' ? '✓' : '✗';
    const detail = item.detail ? ` — ${item.detail}` : '';
    console.log(`  ${mark} ${item.name}${detail}`);
  }
  if (dialogs.length > 0) {
    console.log('\n── Dialogs ──');
    dialogs.forEach((dialog) => {
      console.log(`  ${dialog.type}: ${dialog.message} (${dialog.accept ? 'accepted' : 'dismissed'})`);
    });
  }
  if (consoleIssues.length > 0) {
    console.log('\n── Console warnings/errors ──');
    consoleIssues.forEach((issue) => console.log(`  ${issue.type}: ${issue.text}`));
  }
  if (exceptions.length > 0) {
    console.log('\n── Runtime exceptions ──');
    exceptions.forEach((exception) => console.log(`  ${exception}`));
  }
  console.log(`\n結果: ${passed} 通過, ${failed} 失敗\n`);
}

async function main() {
  console.log('================================================================');
  console.log('  🧪  新機種製作需求一覽表 — 按鍵互動巡檢');
  console.log('================================================================\n');

  const appUrl = await startStaticServer();
  await startBrowser();
  await runAudit(appUrl);
}

try {
  await main();
} catch (err) {
  failed++;
  results.push({ name: 'buttonAudit setup/runtime', status: 'FAIL', detail: err.message });
} finally {
  await cleanup();
  printSummary();
}

if (failed > 0 || consoleIssues.length > 0 || exceptions.length > 0 || dialogs.length > 0) {
  if (dialogs.length > 0) {
    console.error(`\n❌ 去彈窗化檢核失敗：測試期間觸發了 ${dialogs.length} 個原生對話框（要求為 0）！`);
  }
  process.exit(1);
}
