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
```

這會建立 `profiles`、`projects`、`factories` 資料表、Row-Level Security 規則、自動建立 profile 的 trigger,並把需即時同步的資料表加入 Realtime publication。

### 4.(開發便利)關閉 Email 驗證
Authentication → Providers → Email → 視需要關閉「Confirm email」,
讓註冊後可直接登入(正式環境建議保留驗證)。

### 5. 重新啟動開發伺服器
```bash
npm run dev
```
登入畫面會顯示「☁ 雲端帳號」,即表示已啟用。

---

## 部署上線:Netlify(前端)+ Supabase(後端)

> **兩者角色不同、同時使用**:Netlify 託管「前端網頁」,Supabase 提供「資料庫 / 帳號 / 即時同步」。前端透過下面兩個環境變數連到 Supabase。`vite.config.js` 的 `base: '/'` 已適配 Netlify 根路徑,無需修改。

### A. 連結儲存庫並設定 build
1. Netlify → **Add new site → Import an existing project**,連結你的 GitHub 儲存庫。
2. Build 設定(Vite 預設即可):
   - **Build command**:`npm run build`
   - **Publish directory**:`dist`
   - **Node version**:18 以上(可用環境變數 `NODE_VERSION=20` 指定)
3. Production branch 使用 `main`。完成任務後推送 feature branch,合併到 `main` 後由 Netlify Git integration 自動部署正式站。

> 一般實作完成後不要執行 `netlify deploy --prod`;該命令是手動 production upload,會需要額外確認。正常流程以 GitHub → Netlify 自動同步為準。

### B. 設定環境變數(關鍵步驟)
Site → **Site configuration → Environment variables → Add a variable**,新增與本機 `.env` **相同**的兩個變數:

| Key | Value |
|---|---|
| `VITE_SUPABASE_URL` | `https://xxxx.supabase.co` |
| `VITE_SUPABASE_ANON_KEY` | `eyJhbGci...` |

> ⚠️ **環境變數只在「新的 build」生效**。設定後要到 **Deploys → Trigger deploy → Deploy site** 重新部署一次,雲端模式才會套用。
>
> 🔐 `anon` key 本就設計成可公開於前端(資料安全由 Supabase 的 **RLS 規則**把關),放 Netlify 環境變數沒問題;但 **`service_role` key 絕對不要**放前端或環境變數。

### C. netlify.toml(已附於專案根目錄)
鎖定 build 設定與單頁應用的路由 fallback,避免重新整理時 404:

```toml
[build]
  command = "npm run build"
  publish = "dist"

[build.environment]
  NODE_VERSION = "20"

# 單頁應用:所有路徑回退到 index.html
[[redirects]]
  from = "/*"
  to = "/index.html"
  status = 200
```

### D. Supabase 端放行 Netlify 網域
Supabase → **Authentication → URL Configuration**,把 Netlify 網址(如 `https://your-site.netlify.app`)加入 **Site URL** 與 **Redirect URLs**,登入流程才不會被擋。

### 角色對照(一眼看懂)

| | Netlify | Supabase |
|---|---|---|
| 負責 | 前端網站託管、CDN、自動部署 | 資料庫、帳號驗證、即時同步、檔案儲存 |
| 你的專案 | 跑「畫面」(列表/表單/儀表板) | 存「資料」+ 跨裝置同步 |
| 是否有資料庫 | ❌ | ✅ Postgres |
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
