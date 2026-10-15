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
check(
  migration0005.includes('guard_project_mutations') && migration0005.includes('version bigint'),
  '0005 enforces sign-off mutations guard and optimistic locking version column',
);
check(
  migration0005.includes('guard_project_deletion') && migration0005.includes('default-template'),
  '0005 enforces server-side deletion protection and default-template guard',
);

const rollback0005 = read('supabase/rollback/0005_signoff_guard_rollback.sql');
check(
  rollback0005.includes('project_guard_mutations_trigger') && rollback0005.includes('project_guard_deletion_trigger'),
  '0005 rollback cleanly removes guard triggers and functions',
);

const headers = read('public/_headers');
check(
  headers.includes('Content-Security-Policy') && headers.includes('Strict-Transport-Security'),
  'public/_headers defines CSP and HSTS security headers',
);

console.log(`\nSecurity contract results: ${passed} passed, ${failed} failed`);
if (failed > 0) process.exitCode = 1;
