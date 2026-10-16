# Supabase 與 Cloudflare Workers 正式安全發布手冊

本手冊適用於 RLS、角色、Supabase Edge Function、資料庫 migration 或高風險 runtime dependency 變更。一般 UI 修改不需要執行 production database 步驟。

## 1. Go / No-Go

只有全部條件成立才可繼續：

- 修正位於隔離分支並已通過 `npm run lint`、`npm run qa:gate`、`npm audit --omit=dev --audit-level=high`。
- Supabase CLI 已登入且 link 的 project ref 與正式 `.env` URL 一致。
- `supabase migration list --linked` 顯示遠端 0001–0003 與本地一致；不一致時停止，不得使用 `--include-all` 猜測補套。
- 已取得資料庫密碼、GitHub PR 權限及 RD／ENG／QA／Admin 四個 production 專用測試帳號。
- 備份目錄位於 repo 外，schema 與 data dump 皆成功且檔案非空。

任一條件不成立：`BLOCKER + required input`，正式環境保持不動。

## 2. CLI 連結與備份

以下 PowerShell 變數只設在目前 terminal，不可寫入 tracked 檔案：

```powershell
$env:SUPABASE_ACCESS_TOKEN='<access-token>'
$env:SUPABASE_DB_PASSWORD='<database-password>'
$env:SUPABASE_PROJECT_REF='<project-ref>'

supabase login --token $env:SUPABASE_ACCESS_TOKEN
supabase link --project-ref $env:SUPABASE_PROJECT_REF --password $env:SUPABASE_DB_PASSWORD
supabase migration list --linked

$stamp = Get-Date -Format 'yyyyMMdd-HHmmss'
$backup = Join-Path $env:TEMP "alignment-supabase-$stamp"
New-Item -ItemType Directory -Path $backup | Out-Null
supabase db dump --linked --schema public --file (Join-Path $backup 'public-schema.sql')
supabase db dump --linked --schema public --data-only --use-copy --file (Join-Path $backup 'public-data.sql')
Get-ChildItem $backup | Select-Object FullName,Length
```

兩個 dump 任一失敗或為空即停止。備份路徑與檔案大小要記入發布證據，但不要提交 dump。

## 3. 套用順序

`invite-user` 更新對舊資料庫向後相容，先部署函式再套 migration：

```powershell
supabase functions deploy invite-user --project-ref $env:SUPABASE_PROJECT_REF
supabase migration up --linked
supabase migration list --linked
```

確認 `0004_security_hardening.sql` 已套用後，設定 `.env` 中四角色專用帳號與確認旗標：

```powershell
$env:ALLOW_PRODUCTION_SECURITY_AUDIT='QA_TEST_ONLY_WITH_BACKUP'
npm run qa:cloud-security
```

通過標準：角色不能自行升權、非 Admin 看不到 `admin_test`、非 Admin 不能維護加工廠、正常 `default` 協作與本人簽章可用、Admin 可管理測試 profile，最後表筆數回到執行前基線。

## 4. PR、Preview 與 production

1. 推送隔離分支並建立 PR。
2. 在 Cloudflare Workers 預覽環境或本機 wrangler dev 以無 session、過期 `ag_current_user`、四角色登入及桌面／窄版流程驗證。
3. 合併 `main` 後，由管理員於終端機執行 `npx wrangler deploy` 發布至正式站台。
4. 比對正式站台 `/assets/*.js` hash 與本地 `dist/index.html`，再做登入、機種讀寫、Excel、簽核與列印 smoke test。

## 5. Rollback

- 前端問題：先在 Cloudflare Dashboard 回復（Rollback）至上一個成功版本，或 revert merge commit 後重新建置並部署。0004 migration 與舊前端相容，資料庫安全強化保留。
- RLS 阻斷：執行 `supabase/rollback/0004_security_hardening_rollback.sql`，立即重跑四角色 smoke test。此 rollback 會重新開放原本的升權與資料隔離風險，只能作短期緊急措施。
- 資料異常：停止寫入，使用本次 repo 外的 `public-schema.sql`／`public-data.sql` 復原；完成表筆數與抽樣資料核對前不可重新開放。
- SheetJS 回歸：revert package 與 lockfile，停止接受未受信任 Excel；不得發布已知有漏洞的 0.18.5。
