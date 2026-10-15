# 新機種委外加工對齊系統

雙向資訊同步與製程防呆管制平台

## 專案簡介

本系統用於管理新機種（新產品）委外加工製造需求一覽表，提供雙向資訊同步與製程防呆管制功能。支援多角色權限管理、Excel 匯入/匯出（保留原始格式）、簽署流程、無伺服器瀏覽器端儲存，以及跨裝置響應式排版。

## 核心功能

- **多角色驗證系統**：支援 RD（研發）、ENG（工程）、QA（品保）、Admin（系統管理員）四種角色，各自擁有不同的編輯權限與簽署責任
- **Excel 匯入/匯出**：基於 SheetJS 函式庫，完整保留原始 Excel 格式（合併儲存格、樣式、背景色等）
- **簽署流程**：RD → PE → QA 三階簽核，支援圖片簽章上傳與嵌入式簽名欄位
- **離線／雲端雙模式**：未設定 Supabase 時使用 localStorage；正式環境可啟用登入、RLS、即時同步與跨裝置協作
- **製程防呆管制**：欄位編輯鎖定（`_owners` 機制），防止不同角色互相覆蓋
- **製程項目管理**：SMT 鋼板/載具/治具、DIP、試產報告、6 點測溫記錄、PCBA/FPCA 包材管理
- **十步驟確認流程**：將機種、品質、治工具、前置、測溫、SMT、DIP、試產、文件與簽章分開確認，並顯示待處理、進行中、完成或不適用狀態
- **列印報表**：支援 A4 格式 PDF 列印，含分頁控制
- **跨裝置響應式**：支援桌上型電腦與行動裝置

## 技術棧

| 類別 | 技術 |
|:---|:---|
| 前端框架 | React 19 |
| 建置工具 | Vite 8 |
| Excel 處理 | SheetJS (xlsx) |
| 程式語言 | JavaScript (JSX) |
| 樣式 | CSS（自訂變數 + 響應式 + Apple HIG 適配） |
| 程式碼檢查 | ESLint 10 |
| CI/CD & 託管 | GitHub Actions (CI) + Cloudflare Pages (Wrangler) / Netlify Git 自動部署 |

## 目錄結構

```
├── public/                 靜態資源（Excel 範本、favicon）
├── src/
│   ├── assets/             靜態資產
│   ├── components/         React 元件
│   │   ├── BasicInfoSection.jsx 機種基本資訊
│   │   ├── FormSections.jsx     十步驟表單路由
│   │   ├── *Section.jsx         品質、治工具、製程與交付步驟
│   │   ├── LoginModal.jsx       登入視窗
│   │   ├── PrintReport.jsx      列印報表
│   │   ├── Settings.jsx         設定頁面
│   │   ├── SignOff.jsx          簽核區塊
│   │   ├── Uploader.jsx         Excel 上傳
│   │   ├── ProjectList.jsx      專案清單
│   │   └── ...                  對應 CSS 樣式表
│   ├── utils/
│   │   ├── excelParser.js       Excel 解析
│   │   └── excelExporter.js     Excel 匯出
│   ├── App.jsx                  主應用元件
│   ├── main.jsx                 進入點
│   └── index.css                全域樣式
├── docs/                    風險記錄與參考檔案
├── scripts/                 測試腳本
├── .github/workflows/       CI/CD 設定
├── index.html
├── package.json
└── vite.config.js
```

## 快速開始

```bash
# 安裝依賴
npm install

# 啟動開發伺服器
npm run dev

# 建置生產版本
npm run build

# 預覽建置結果
npm run preview

# 執行程式碼檢查
npm run lint

# 執行生產建置與完整 QA gate (含離線合約與 Chrome 按鍵巡檢)
npm run qa:gate

# 檢查正式依賴的高風險公告
npm audit --omit=dev --audit-level=high

# 僅檢查安全設定與 migration 合約（不連線、不寫遠端資料）
npm run qa:security

# 同步部署至 Cloudflare Pages / Workers 邊緣靜態站台
npm run deploy:cf
```

`qa:gate` 是包含生產建置、五大離線合約（storage / concurrency / stress / workflow / security）與 Headless Chrome 按鍵互動巡檢（`qa:buttons`）之日常驗收標準，不代表 Supabase RLS 已驗證。正式雲端權限測試必須先完成備份，再依 [正式安全發布手冊](docs/SECURITY_ROLLOUT.md) 執行 opt-in 的 `npm run qa:cloud-security`。

## 部署

本專案支援多平台前端邊緣託管架構，GitHub Actions 負責 PR/CI 檢驗，線上環境支援 Cloudflare 與 Netlify：

1. **Cloudflare Pages / Workers Static Assets（推薦全球邊緣託管）**：
   - 專案根目錄備有 `wrangler.jsonc`，靜態產物目錄指向 `./dist`，設定單頁應用 (`single-page-application`) 404 回退。
   - `public/_headers` 預設注入嚴格安全性標頭（CSP、X-Frame-Options、strict-origin、noindex 與靜態快取 `Cache-Control: public, max-age=31536000, immutable`）。
   - 執行 `npm run deploy:cf` 即可直接同步發布至 Cloudflare 全球邊緣網路。

2. **Netlify 站台（Git 自動部署）**：
   - 合併或推送至 `main` 後，由 Netlify Git integration 自動建置發布。
   - 根目錄 `netlify.toml` 提供單頁路由重定向與安全標頭。

3. **CI 與儲存庫**：
   - `.github/workflows/deploy.yml` 專注於 PR 與 main 推送之 build check 及安全稽核。
   - 儲存庫：<https://github.com/chenchihcu/outsourcing-alignment>

涉及 Supabase migration、RLS、角色或 production 資料的修改必須走隔離分支與 PR，並遵守 [正式安全發布手冊](docs/SECURITY_ROLLOUT.md) 的備份、go/no-go、負向權限測試與回滾步驟。

## 角色權限說明

| 角色 | 帳號 | 單位 | 權限說明 |
|:---|:---|:---|:---|
| RD | rd | 研發單位 | 表單填寫與編輯 |
| ENG | eng | 工程單位 | 表單編輯與簽核 |
| QA | qa | 審核單位（品保處） | 最終審核與簽核 |
| Admin | admin | 管理處 | 系統設定與帳號管理 |

雲端權限邊界：RD／ENG／QA 可共同讀寫 `default` 機種；只有 Admin 可存取 `admin_test`；加工廠主檔全員可讀、僅 Admin 可維護；一般使用者只能讀取自己的 profile 並更新自己的簽章，不能讀取他人 profile 或修改角色、單位、職級。

## 授權

本專案為私有專案，僅供授權人員使用。
