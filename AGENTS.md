# AGENTS.md — 新機種委外加工對齊系統

本檔是本專案的 repo-local 規則,所有 AI 助手(Cursor / Claude Code / Codex / Antigravity)共用。
可加嚴全域 baseline,不可放寬。

## Knowledge Map

- 專案總覽:`README.md`
- 風險帳(Excel / localStorage / 欄位鎖定 / 雲端衝突):`docs/risk-ledger.md`
- QA 測試計畫:`docs/QA_TEST_PLAN.md`
- 安全 / Supabase rollout:`docs/SECURITY_ROLLOUT.md`、`docs/SUPABASE_SETUP.md`
- Cursor gateway:`.cursor/rules/agents_gateway.mdc`
- 通用 UI/UX 規則:`.cursor/rules/ui-ux-universal.mdc`(全域真本同步;本專案為純 Web,適用 §9 Web 段)
- 全域 Excel 規則:`~/.claude/skills/excel-workbook-toolkit/references/excel_master_spec.md`(Part A 共用紀律)

## Stack

React 19 + Vite + SheetJS(Excel 匯入/匯出)+ 選用 Supabase(雲端多人)。
指令:`npm run dev` / `build` / `lint`;驗收 `npm run qa:gate`(= build + qa:offline + qa:buttons),
雲端安全 `npm run qa:cloud-security`(需 `.env`)。

## Guardrails(取自風險帳)

- **Excel 解析 / 匯出**:遵循全域 Excel 真本 Part A #9–#10——解析用表頭關鍵詞動態定位、不寫死座標(A5/B2);
  匯出採「複製原 workbook、只改值」保留 `!merges` / 樣式;匯出後本機實開驗外觀,並跑往返測試確保 100% 還原。
- **狀態持久化**:`projects` 與**欄位擁有權鎖定 `_owners`** 都要寫入 `localStorage`(及 Supabase,若啟用)並於載入還原;
  重整 / 切機種後資料與鎖定狀態完整還原(對應通用真本 §9 Web)。
- **雲端協作(Supabase)**:RLS 為安全邊界,前端不重複硬寫角色判斷;動 RLS / schema / 正式資料前先備份,
  依 `docs/SECURITY_ROLLOUT.md` 走 go/no-go 與負面測試。
- **PDF 列印**:長備註 / 測溫點過長時用 `page-break-inside: avoid` 與必要強制分頁,確保 A4 不溢出。
- **React 表單狀態原子化更新**:
  在 JSX 交互中，若單一事件需要同時更新多個相關欄位狀態（例如 SMT 鋼板切換需要重設 `need`、`noNeed` 與其子欄位值），**嚴禁重複非同步呼叫 `onChange` 或狀態變更函數**。必須將所有變更欄位打包至單一物件中，以**單次 `onChange` 呼叫**完成原子化更新，防範 React 異步更新時資料被覆蓋。
- **欄位擁有權鎖定與共享機制**:
  為兼顧防呆與發包方協作：
  1. 委外加工廠選擇欄位 (`basicInfo.factory`) 為全域公共資料，全體角色皆可填寫，不應受 `_owners` 鎖定限制。
  2. 發包方內部（研發單位與工程單位）共享編輯基本資料與治工具項目，彼此之間不互相鎖定（當 `_owners` 為研發單位或工程單位時，雙方皆可繼續共編），僅鎖定非發包方的加工廠角色編輯。
- **Vite 專案多平台部署 base path**:
  為了同時相容 GitHub Pages (需要 '/Product-outsourcing-alignment-platform/' 子路徑) 與 Netlify / Cloudflare Pages (需要 '/' 根目錄) 部署，**嚴禁將 vite.config.js 的 base 參數寫死**。必須統一使用動態環境變數判定：`process.env.GITHUB_ACTIONS ? '/Product-outsourcing-alignment-platform/' : '/'`。
- **全雲端上線架構與手機跨網存取 (全域規則)**:
  網站託管於 Cloudflare Pages 全球邊緣網路，後端統一由 Supabase (PostgreSQL + Auth + Realtime) 承接，使用者可隨時隨地透過手機、平板或電腦跨網存取。**所有專案皆為純雲端上線模式，完全廢除本機離線模式與本機帳密**，登入與權限 100% 依賴 Supabase Auth 集中管理。
- **Cloudflare 邊緣靜態部署與安全標頭**:
  專案配置 `wrangler.jsonc` 託管 `./dist`，支援單頁應用 `single-page-application` 轉向；`public/_headers` 必須維護嚴格 CSP（僅允許 Supabase 與 Google Fonts）、`X-Frame-Options: DENY`、`X-Robots-Tag: noindex` 與 `/assets/*` 長期快取（`max-age=31536000, immutable`）。可透過 `npm run deploy:cf` 一鍵發布。
- **ESLint 跨平台 Node 全域環境相容性**:
  在 `vite.config.js` 等前端打包設定檔中存取 `process.env` 時，必須在頂部明確宣告 `import process from 'node:process'`，避免在嚴格瀏覽器/Flat Config 下觸發 `no-undef` 阻斷 CI 檢查。

## 驗收 gate

- 離線:`npm run qa:offline`(storage / concurrency / stress / workflow / security)。
- 動 Excel 格式:跑 Excel 往返測試確保解析與還原 100% 正確,不過不合併。
- 動雲端(RLS / 正式資料):先備份,再跑 `npm run qa:cloud-security`。

## Coexistence

- Trunk-based:直接上 `main`,不開 feature branch。
- Cursor 以 `.cursor/rules/agents_gateway.mdc` always-on 路由至本檔。
- 各 AI 工具視本檔為本專案權威規則;與全域 baseline 衝突時,以更嚴者為準。
