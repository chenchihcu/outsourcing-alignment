import fs from 'node:fs';
import path from 'node:path';

const root = process.cwd();
let passed = 0;
let failed = 0;

function check(condition, message) {
  if (condition) {
    passed += 1;
    console.log(`  ✓ ${message}`);
  } else {
    failed += 1;
    console.error(`  ✗ ${message}`);
  }
}

function read(relativePath) {
  return fs.readFileSync(path.join(root, relativePath), 'utf8');
}

console.log('\n── Security contract tests ──');

const pkg = JSON.parse(read('package.json'));
const xlsxSource = pkg.dependencies?.xlsx || '';
check(
  xlsxSource === 'https://cdn.sheetjs.com/xlsx-0.20.3/xlsx-0.20.3.tgz',
  'SheetJS is pinned to the patched official 0.20.3 tarball',
);

const appSource = read('src/App.jsx');
check(
  appSource.includes('isSupabaseEnabled ? null : getJSON(\'current_user\', null)'),
  'cloud mode does not trust cached current_user during startup',
);
check(
  appSource.includes('if (!authReady)') && appSource.includes('正在驗證工作階段'),
  'cloud UI remains gated until session verification completes',
);

const authSource = read('src/data/auth.js');
check(!authSource.includes('auth.signUp('), 'client-side self sign-up path is not exposed');
check(
  authSource.includes("supabase.auth.signOut({ scope: 'local' })"),
  'logout has a local-session fallback',
);

const migrationSource = read('src/data/migrateLocal.js');
check(
  migrationSource.includes('migrateLocalProjects(workspace, localProjects, userId)')
    && migrationSource.includes('pushProject(workspace, p, userId)'),
  'first cloud migration records updated_by for scoped RLS writes',
);

const migration = read('supabase/migrations/0004_security_hardening.sql');
for (const [fragment, message] of [
  ['public.is_admin()', 'admin checks use the security-definer helper'],
  ['profiles_protect_privileged_fields', 'profile privilege fields are protected by a trigger'],
  ['auth.uid() = id or public.is_admin()', 'profile reads are limited to self or admin'],
  ["workspace = 'admin_test' and public.is_admin()", 'admin_test workspace is admin-only'],
  ['factories_insert_admin', 'factory inserts are admin-only'],
  ['factories_update_admin', 'factory updates are admin-only'],
  ['factories_delete_admin', 'factory deletes are admin-only'],
]) {
  check(migration.includes(fragment), message);
}

const inviteFunction = read('supabase/functions/invite-user/index.ts');
check(inviteFunction.includes('ALLOWED_ROLES'), 'invite-user validates an explicit role allowlist');
check(inviteFunction.includes('@supabase/supabase-js@2.108.0'), 'invite-user pins the Supabase SDK version');
check(
  inviteFunction.includes(".from('profiles')") && inviteFunction.includes('deleteUser(data.user.id)'),
  'invite-user writes a trusted profile and removes orphaned invites on failure',
);

const rollback = read('supabase/rollback/0004_security_hardening_rollback.sql');
check(
  rollback.includes('reopens the') && rollback.includes('projects_all'),
  'an explicit emergency rollback exists and warns that security is weakened',
);

const migration0005 = read('supabase/migrations/0005_signoff_guard.sql');
for (const [fragment, message] of [
  ['protect_project_signoff', '0005 migration includes sign-off protection trigger function'],
  ['protect_project_deletion', '0005 migration includes deletion protection trigger function'],
  ['increment_project_version', '0005 migration includes version increment trigger function'],
  ['projects_insert_scoped', '0005 migration restricts project insert to rd, eng, admin'],
  ['version bigint not null default 0', '0005 migration adds version column for optimistic locking'],
]) {
  check(migration0005.includes(fragment), message);
}

const rollback0005 = read('supabase/rollback/0005_signoff_guard_rollback.sql');
check(
  rollback0005.includes('trg_protect_project_signoff') && rollback0005.includes('trg_protect_project_deletion'),
  'an explicit rollback for 0005 migration exists',
);

const excelParserSource = read('src/utils/excelParser.js');
check(
  !excelParserSource.includes('rdSignature = ') && !excelParserSource.includes('qaSignature = ')
    && !excelParserSource.includes('signatures.rdSignature'),
  'excelParser clears/ignores signatures from imported files',
);

const loginSource = read('src/components/LoginModal.jsx');
check(
  loginSource.includes('verifyAccountPassword') && loginSource.includes('sanitizeUserForSession'),
  'LoginModal uses PBKDF2 hash verification and sanitizes user session',
);

function walkFiles(dir, extFilter) {
  let files = [];
  const absDir = path.join(root, dir);
  if (!fs.existsSync(absDir)) return files;
  for (const item of fs.readdirSync(absDir)) {
    const full = path.join(dir, item);
    const abs = path.join(root, full);
    if (fs.statSync(abs).isDirectory()) {
      files = files.concat(walkFiles(full, extFilter));
    } else if (!extFilter || extFilter.test(full)) {
      files.push(full);
    }
  }
  return files;
}

// F0-2: label-has-associated-control 註解歸零
const srcJsxFiles = walkFiles('src', /\.(jsx?)$/);
const labelDisables = srcJsxFiles.filter(f => read(f).includes('label-has-associated-control'));
check(labelDisables.length === 0, 'F0-2: label-has-associated-control eslint-disable comments count is 0');

// F0-5: 原生 alert/confirm/prompt 與彈窗遮罩 class 徹底歸零
const srcCodeFiles = walkFiles('src', /\.(jsx?|css)$/);
const dialogHits = [];
const modalClassHits = [];
for (const f of srcCodeFiles) {
  const c = read(f);
  for (const token of ['alert(', 'confirm(', 'prompt(']) {
    if (c.includes(token)) dialogHits.push(`${f}: ${token}`);
  }
  for (const token of ['modal-backdrop', 'success-overlay', 'login-overlay', 'shell-backdrop']) {
    if (c.includes(token)) modalClassHits.push(`${f}: ${token}`);
  }
}
check(dialogHits.length === 0, 'F0-5: native alert/confirm/prompt in src count is 0');
check(modalClassHits.length === 0, 'F0-5: deprecated modal overlay class names count is 0');

// F0-7: HEAD 中已徹底移除擬真簽名圖資產
check(!fs.existsSync(path.join(root, 'docs/簽名檔(擬真)')), 'F0-7: fake signature assets directory does not exist');

// F0-9: 安全標頭包含 CSP 與 HSTS 且無外部 Google Fonts 依賴
const headersContent = read('public/_headers');
check(
  headersContent.includes('Content-Security-Policy') && headersContent.includes('Strict-Transport-Security'),
  'F0-9: security headers contain CSP and HSTS',
);
const indexHtmlContent = read('index.html');
check(
  !indexHtmlContent.includes('fonts.googleapis.com') && !indexHtmlContent.includes('fonts.gstatic.com'),
  'F0-9: index.html has no external Google Fonts dependency',
);

// F0-17: 元件層無 getElementById
const compFiles = walkFiles('src/components', /\.(jsx?)$/);
const getElemHits = compFiles.filter(f => read(f).includes('getElementById('));
check(getElemHits.length === 0, 'F0-17: components layer has zero getElementById calls');

// AGENTS.md Terminology SSOT: 元件層無違規俗稱
const termHits = [];
for (const f of compFiles) {
  const c = read(f);
  for (const term of ['脆盤', '濕潤性', '後烘烤']) {
    if (c.includes(term)) termHits.push(`${f}: ${term}`);
  }
}
check(termHits.length === 0, 'Terminology SSOT: components layer has zero banned informal terms');

// AGENTS.md Typography SSOT: JSX 行內樣式無裸露 fontSize 數值
const fontSizeHits = [];
for (const f of srcJsxFiles) {
  const c = read(f);
  if (/fontSize:\s*['"][0-9]/.test(c)) fontSizeHits.push(f);
}
check(fontSizeHits.length === 0, 'Typography SSOT: JSX inline styles have zero hardcoded fontSize values');

console.log(`\nSecurity contract results: ${passed} passed, ${failed} failed`);
if (failed > 0) process.exitCode = 1;


