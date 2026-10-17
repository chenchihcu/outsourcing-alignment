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
指令:`npm run dev` / `build` / `lint` / `deploy`;驗收 `npm run qa:gate`(= build + qa:offline + qa:buttons),
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
- **Vite 根目錄部署 SSOT 與測試伺服器路徑韌性**:
  專案全面託管於 Cloudflare Pages / Workers，統一以根目錄（`base: '/'`）為單一事實來源（SSOT），不使用動態子路徑；內建之自動化巡檢靜態伺服器（如 `scripts/buttonAudit.mjs`）必須具備子路徑前綴剝除容錯能力，防範資產路徑前綴導致 404 與 MIME 類型錯誤。
- **雲端連線憑證解耦與離線測試防死鎖**:
  前端客戶端（`src/data/supabaseClient.js`）嚴禁硬編碼預設連線金鑰，必須完全由環境變數（`VITE_SUPABASE_URL` / `VITE_SUPABASE_ANON_KEY`）動態決定 `isSupabaseEnabled`。未提供環境變數時一律退回純離線優先模式，避免無頭自動化測試遭遇遠端網路限流或連線超時死鎖。
- **iOS 行動端人因工程與 HIG 規範守衛**:
  行動端互動元件（按鈕、選單、標籤切換）點擊熱區最小必須為 `≥44×44 pt`（主要送出動作 `≥48~50 pt`）；表單輸入元件（`input`/`select`/`textarea`）在行動視口強制設定 `font-size: 16px` 以防範 iOS Safari 聚焦時觸發自動縮放；主題變數採 `@media (prefers-color-scheme: dark)` 與 `[data-theme="dark"]` 雙軌適配，直橫向視口皆須動態注入 `env(safe-area-inset-*)` 避讓靈動島與圓角裁切。
- **端對端測試建置時效與雲端會話 Mock 守衛**:
  Playwright 仰賴 `vite preview` 靜態伺服器，執行測試前若有修改原始碼，必須先執行 `npm run build` 更新 `dist/`，防範測試執行於舊版快取；且在啟用 Supabase 連線時，端對端測試須於 `beforeEach` 中 Mock 驗證 API（`**/auth/v1/user`、`**/rest/v1/profiles*`）並注入相容之 `ag_sb_auth` Token，避免受保護頁面被安全守衛踢回登入頁。
- **全站字體族群與字級階層治理 (Typography & Font Consistency Guardrail)**:
  規則：全站介面字型與字級必須統一以 `src/styles/tokens.css` 的 `--font-sans`、`--font-display`、`--font-mono` 與 `--fs-*`（`--fs-caption` 至 `--fs-large-title`）為唯一事實來源（SSOT），嚴禁散落硬編碼未載入的 Webfont（如 `'Outfit'`、`'Inter'`）或隨機 px/rem（如 `0.88rem`, `0.95rem`, `1.05rem`, `13px`, `14px` 等）：
  1. 治理範圍嚴格涵蓋全站 `.css` 檔案以及所有 JSX 元件內的行內樣式（`style={{ fontSize: ... }}`）。嚴禁於 JSX 行內直接書寫裸露數值，必須引用 `var(--fs-...)` 或改以 CSS class 控管。
  2. 繁體中文系統字體堆疊必須兼顧 macOS/iOS (`PingFang TC`)、Windows (`Segoe UI` + `微軟正黑體`) 與 Linux (`Noto Sans TC`)，確保在廠區離線無外網環境下不依賴外部 Webfont CDN 亦具備清晰排版。
  3. 全域維持 `button, input, select, textarea { font-family: inherit; }` 防範原生表單控制項字型脫鉤；動態數值、百分比與 KPI 必須宣告 `font-variant-numeric: tabular-nums` 防止數值跳動導致排版抖動。
  4. 字級上限天花板與微階層：全站文字大小上限嚴格受限於 14px (`0.875rem`)，由 `src/styles/tokens.css` 統一管理（大標題與主視覺 14px、次標題 13.5px、正文與按鈕 13px、註腳 12px、標籤/徽章 11px）。元件 CSS 與 JSX 行內樣式嚴禁寫死任何 >14px 之字級或 fallback；僅行動視口下針對表單輸入框依 iOS HIG 保留 16px 聚焦防縮放防護，以及實體紙本列印（`PrintReport.css` 採 `pt` 印刷點數）。
  檢查：執行 `npm run qa:offline` 全數通過，且全局搜尋 `fontSize:\s*['"][0-9]` 0 命中，全站無非列印/非防縮放之 >14px 硬編碼。
  出處：typography_audit 2026-10-17、tokens.css 2026-10-17；重複：1 專案（架構紅線）。
- **React 元件檔案導出與 Fast Refresh 紀律 (React Component Export Guardrail)**:
  規則：`.jsx` 元件檔案嚴禁同時 export 非元件常數或輔助工具函數（例如格式化轉換函數），避免破壞 Vite HMR Fast Refresh 並引發 `react-refresh/only-export-components` 造成 CI `npm run lint` 阻斷。純計算或文字格式化邏輯應獨立抽取至 `src/utils/`，或在必要共用時顯式標註 `// eslint-disable-next-line react-refresh/only-export-components`。
  檢查：執行 `npm run lint` 必須 0 errors, 0 warnings。
  出處：TrialReportSection.jsx 2026-10-17；重複：1 專案。
- **SMT/PCBA 電子製造語意與專業名詞標準 (Terminology & Domain Semantics SSOT)**:
  規則：全站介面、驗證提示與報表文案必須嚴格對照 IPC-A-610、IPC J-STD-001、IPC-7525、IPC-7530、IPC-1601 與業界 EMS 規範，嚴禁倒退回口語俗稱或歧義詞彙：
  1. 焊點冶金：一律使用「潤濕性 / 沾錫性 (Solder Wetting)」，嚴禁使用「濕潤性」。
  2. 膠材物化：Underfill 點膠後條件為「熱固化 (Thermal Curing)」，嚴禁稱為「後烘烤 (Baking)」。
  3. 出貨包材：一律使用「抗靜電托盤 (ESD Tray)」，嚴禁使用塑膠加工行話「脆盤」；保護物料一律使用「感測器/鏡頭保護膜 (Protective Film)」，避免消費端用語「保護貼」。
  4. 烘烤除濕：打件前對象為裸板，正名為「PCB / FPC 裸板預烘烤去濕 (Pre-Baking)」，區隔組裝後的 FPCA。
  5. 鋼網與製程：一律使用「鋼網 (Stencil)」與「鋼網開孔縮放比例 (Aperture-to-Pad Ratio)」；載具正名為「SMT 印刷 / 回焊載具 (Printing/Reflow Carrier)」。
  6. 樣品確認：正名為「試錫空板 (Dummy Board)」、「測溫板 (Profile Board)」、「黃金樣板 (Golden Sample)」。
  7. 資料結構解耦：為確保 Excel 往返（`qa:roundtrip`）100% 保真，底層歷史 JSON key 維持穩定，名詞正名由 UI 呈現層與驗證規則層統一映射。
  檢查：執行 `npm run qa:offline` 全數通過，且全局搜尋無「脆盤」、「濕潤性」、「後烘烤」等違規俗稱。
  出處：terminology_audit_report 2026-10-17、IPC 國際標準；重複：1 專案（架構紅線）。
- **製程表單微圖示人因工程守衛 (Domain Micro-Icon Ergonomics Guardrail)**:
  規則：表單區塊與選項之輔助微圖示一律由 `src/utils/svgIcons.jsx` 集中提供原生向量 SVG，嚴禁外掛重量級圖示庫或載入外部網路圖片資產。圖示必須包裹於 `.card-icon-circle`（卡片標題）或 `.item-micro-icon`（選項項目）中，尺寸嚴格限制為 14~20px，並自適應暗色與亮色主題變數，防範視覺雜訊並確保無網路環境下 100% 離線可用。
  檢查：執行 `npm run build` 封裝無外部資產請求，且在高對比暗色模式下圖示輪廓清晰可辨。
  出處：FormSections.css 2026-10-17；重複：1 專案。

## 驗收 gate

- 離線:`npm run qa:offline`(storage / concurrency / stress / workflow / security)。
- 動 Excel 格式:跑 Excel 往返測試確保解析與還原 100% 正確,不過不合併。
- 動雲端(RLS / 正式資料):先備份,再跑 `npm run qa:cloud-security`。

## Coexistence

- Trunk-based:直接上 `main`,不開 feature branch。
- 自動同步（雲端系統）：任務所有驗收 gate 全數通過後，自動執行 commit 與 push 同步至 `main` 分支，並因本專案屬於雲端系統（配置 `wrangler.jsonc`），必須一併自動執行 `npm run deploy`（`npm run build && npx wrangler deploy`）將最新版本同步部署至 Cloudflare 線上環境（`https://outsourcing-alignment.chihfu-chen-tw.workers.dev`），並回報線上網址與 Version ID。
- Cursor 以 `.cursor/rules/agents_gateway.mdc` always-on 路由至本檔。
- 各 AI 工具視本檔為本專案權威規則;與全域 baseline 衝突時,以更嚴者為準。
