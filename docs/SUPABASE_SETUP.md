# Supabase 雲端同步啟用指南 (P2 / P3)

本系統採「**離線優先 + 雲端同步**」架構:

- **未設定 Supabase** → 以純 `localStorage` 離線運作,行為與導入前完全一致(預設)。
- **設定 Supabase** → 啟用真帳號登入、跨裝置雲端同步(P2)與即時協作(P3)。

## 啟用步驟

### 1. 建立 Supabase 專案
1. 前往 <https://supabase.com> 建立帳號與新專案。
2. 進入 **Project Settings → API**,取得:
   - `Project URL`
   - `anon` `public` API key

### 2. 設定環境變數
在專案根目錄建立 `.env`(可複製 `.env.example`):

```bash
VITE_SUPABASE_URL=https://xxxx.supabase.co
VITE_SUPABASE_ANON_KEY=eyJhbGci...
```

> `.env` 已列入 `.gitignore`,不會被提交。

### 3. 建立資料表與安全規則
於 Supabase Dashboard → **SQL Editor**,依序貼上並執行：

```
supabase/migrations/0001_init.sql
supabase/migrations/0002_admin_rls.sql
supabase/migrations/0003_factories.sql
supabase/migrations/0004_security_hardening.sql
supabase/migrations/0005_signoff_guard.sql
```

這會建立 `profiles`、`projects`、`factories` 資料表、Row-Level Security 嚴格隔離規則、三方簽章授權驗證、刪除防護、版本號自動遞增、自動建立 profile 的 trigger,並把需即時同步的資料表加入 Realtime publication。

### 4. 嚴格帳號安全設定 (必做)
前往 Supabase Dashboard → **Authentication**：
1. **關閉公開註冊 (Allow new users to sign up = off)**：禁止外部任意人自行註冊帳號，所有帳號必須由管理員透過系統邀請建立。
2. **保留 Email 驗證 (Confirm email = on)**：確保所有邀請與帳號信箱皆為真實可接收通知之信箱。

### 5. 重新啟動開發伺服器
```bash
npm run dev
```
登入畫面會顯示「☁ 雲端帳號」,即表示已啟用。

---

## 部署上線:Cloudflare Pages / Netlify (前端) + Supabase (後端)

> **兩者角色不同、同時使用**:Cloudflare Pages 或 Netlify 託管「前端網頁」,Supabase 提供「資料庫 / 帳號 / 即時同步」。前端透過環境變數連到 Supabase。`vite.config.js` 的動態 `base` 已適配根路徑,無需額外修改。

### A. Cloudflare Pages 部署 (推薦:全球邊緣託管)
1. **設定設定檔**:專案根目錄備有 `wrangler.jsonc`,靜態目錄指向 `./dist`,啟用 `single-page-application` 404 回退機制。
2. **安全標頭**:由 `public/_headers` 自動隨建置產出帶入 CSP、X-Frame-Options、noindex 及 `/assets/*` 長期快取。
3. **注入環境變數建置**:
   - 建置時需提供 `VITE_SUPABASE_URL` 與 `VITE_SUPABASE_ANON_KEY`(於本機 `.env` 或 Cloudflare 儀表板/CI 設定)。
   - 執行建置並同步發布:`npm run build; npm run deploy:cf`。
4. **Supabase 放行網域**:將 Cloudflare Pages 網址(如 `https://outsourcing-alignment.pages.dev`)加入 Supabase **Authentication → URL Configuration** 的 **Site URL** 與 **Redirect URLs**。

### B. Netlify 部署 (Git 自動整合)
1. Netlify → **Add new site → Import an existing project**,連結 GitHub 儲存庫。
2. Build 設定:
   - **Build command**:`npm run build`
   - **Publish directory**:`dist`
   - **Node version**:20
3. 設定環境變數:`VITE_SUPABASE_URL` 與 `VITE_SUPABASE_ANON_KEY`。
4. 根目錄 `netlify.toml` 已配置單頁應用 200 回退與安全標頭。

### 角色對照(一眼看懂)

| | Cloudflare Pages / Netlify | Supabase |
|---|---|---|
| 負責 | 前端網站託管、CDN、邊緣路由 | 資料庫、帳號驗證、即時同步、檔案儲存 |
| 你的專案 | 跑「畫面」(列表/表單/儀表板) | 存「資料」+ 跨裝置同步 |
| 是否有資料庫 | ❌ | ✅ Postgres |
| 關係 | 互補,**同時使用、缺一不可** | |

| 關係 | 互補,**同時使用、缺一不可** | |

---

## 行為說明

| 動作 | 未啟用(本機) | 啟用(雲端) |
|---|---|---|
| 登入 | 本機測試帳號 | 真帳號(email/密碼),session 跨裝置還原 |
| 機種資料 | localStorage | Supabase `projects`(JSONB),localStorage 為離線快取 |
| 新增/編輯/刪除 | 寫入本機 | 同步 upsert / delete 至雲端 |
| 首次啟用 | — | 自動把本機既有機種遷移上雲 |
| 多裝置同編 | 不同步 | 即時同步(P3) |
| 離線 | 一直可用 | 仍可編輯,連線後同步 |

## 資料模型
- `profiles`：對應 `auth.users`,存角色(rd/eng/qa/admin)、單位、電子簽章。
- `projects`：機種對齊資料。`data` 為整包 JSONB(對應 `parseRequirementExcel` 結果),`original_wb` 保留原始 Excel base64 以維持匯出格式。`workspace` 區隔正式庫與 admin 測試庫。
- `factories`：全系統共用的委外加工廠主檔。所有雲端登入者讀寫同一份清單,避免不同帳號重新登入後看到舊本機快取。

## 安全
- 啟用 RLS:僅登入者可存取共享工作區的機種與共用加工廠主檔(雙向對齊本質為協作)。
- 如需依組織/廠別細分權限,可在 `projects` 加入成員表並調整 policy。
