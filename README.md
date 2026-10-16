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
| 樣式 | CSS（自訂變數 + 響應式） |
| 程式碼檢查 | ESLint 10 |
| CI/CD | GitHub Actions build check + Netlify Git 自動部署 |

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

# 執行生產建置與完整 QA gate
npm run qa:gate

# 檢查正式依賴的高風險公告
npm audit --omit=dev --audit-level=high

# 僅檢查安全設定與 migration 合約（不連線、不寫遠端資料）
npm run qa:security
```

`qa:gate` 是離線／瀏覽器日常 gate，不代表 Supabase RLS 已驗證。正式雲端權限測試必須先完成備份，再依 [正式安全發布手冊](docs/SECURITY_ROLLOUT.md) 執行 opt-in 的 `npm run qa:cloud-security`。

## 部署

本專案以 Netlify 作為正式前端站台，GitHub Actions 只做 build check：

1. 完成任務後先推送 feature branch，確認 `npm run build` 通過
2. 合併或推送至 `main` 後，由 Netlify Git integration 自動建置與發布 production
3. `.github/workflows/deploy.yml` 僅驗證 build，不再部署 GitHub Pages
4. 一般任務不要使用 `netlify deploy --prod`；手動 production deploy 僅保留作緊急備援
5. 儲存庫：<https://github.com/chenchihcu/Product-outsourcing-alignment-platform>

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
