import { useState, useRef } from 'react';
import PropTypes from 'prop-types';
import { parseRequirementExcel } from '../utils/excelParser';
import * as XLSX from 'xlsx';
import './Uploader.css';

export default function Uploader({ onDataLoaded }) {
  const [dragActive, setDragActive] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const fileInputRef = useRef(null);

  const handleDrag = (e) => {
    e.preventDefault();
    e.stopPropagation();
    if (e.type === "dragenter" || e.type === "dragover") {
      setDragActive(true);
    } else if (e.type === "dragleave") {
      setDragActive(false);
    }
  };

  const MAX_FILE_SIZE = 10 * 1024 * 1024; // 10 MB

  const processFile = async (file) => {
    if (!file) return;
    if (!file.name.toLowerCase().endsWith('.xlsx')) {
      setError('請上傳 .xlsx 格式的 Excel 檔案！');
      return;
    }
    // D3 — 檔案大小限制
    if (file.size > MAX_FILE_SIZE) {
      setError(`檔案過大（${(file.size / 1024 / 1024).toFixed(1)} MB），上限為 10 MB。`);
      return;
    }

    setLoading(true);
    setError(null);

    try {
      const reader = new FileReader();
      reader.onload = (e) => {
        try {
          const ab = e.target.result;
          // D3 — 驗證 XLSX 魔術字節 (PK 0x50 0x4B)
          const header = new Uint8Array(ab).slice(0, 4);
          if (header[0] !== 0x50 || header[1] !== 0x4B) {
            setError('檔案格式無效，請確認上傳的是真正的 .xlsx 格式 Excel 檔案。');
            setLoading(false);
            return;
          }
          // 解析出 JSON 資料
          const parsedData = parseRequirementExcel(ab);
          // 保留原始的 workbook 物件，以利後續修改與匯出
          const originalWb = XLSX.read(ab, { type: 'array' });
          onDataLoaded(parsedData, originalWb, file.name);
        } catch (err) {
          if (import.meta.env.DEV) console.error(err);
          setError(`解析 Excel 失敗：${err?.message || '請確認檔案符合「新機種製作需求一覽表2026 v2」格式。'}`);
        } finally {
          setLoading(false);
        }
      };
      // D3 — FileReader 錯誤處理
      reader.onerror = () => {
        setError('讀取檔案失敗，請重試。');
        setLoading(false);
      };
      reader.readAsArrayBuffer(file);
    } catch {
      setError('讀取檔案出錯，請重試。');
      setLoading(false);
    }
  };

  const handleDrop = (e) => {
    e.preventDefault();
    e.stopPropagation();
    setDragActive(false);
    if (e.dataTransfer.files && e.dataTransfer.files[0]) {
      processFile(e.dataTransfer.files[0]);
    }
  };

  const handleChange = (e) => {
    e.preventDefault();
    if (e.target.files && e.target.files[0]) {
      processFile(e.target.files[0]);
    }
  };

  return (
    <div className="uploader-container glass-card">
      <div 
        className={`drop-zone ${dragActive ? 'active' : ''} ${loading ? 'loading' : ''}`}
        onDragEnter={handleDrag}
        onDragOver={handleDrag}
        onDragLeave={handleDrag}
        onDrop={handleDrop}
        onClick={() => fileInputRef.current.click()}
        role="button"
        tabIndex={0}
        onKeyDown={(e) => {
          if (e.key === 'Enter' || e.key === ' ' || e.key === 'Spacebar') {
            e.preventDefault();
            fileInputRef.current.click();
          }
        }}
      >
        <input 
          ref={fileInputRef}
          type="file" 
          className="file-input" 
          accept=".xlsx" 
          onChange={handleChange}
          disabled={loading}
        />
        
        {loading ? (
          <div className="loader-wrapper">
            <div className="pulse-loader"></div>
            <p className="upload-title">正在解析 Excel 資料表...</p>
            <p className="upload-subtitle">正在載入表單結構與檢查規則</p>
          </div>
        ) : (
          <div className="upload-prompt">
            <div className="upload-icon-wrapper">
              <svg className="upload-icon" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M7 16a4 4 0 01-.88-7.903A5 5 0 1115.9 6L16 6a5 5 0 011 9.9M15 13l-3-3m0 0l-3 3m3-3v12" />
              </svg>
            </div>
            <p className="upload-title">點擊或拖放 Excel 確認表至此</p>
            <p className="upload-subtitle">支援：新機種製作需求一覽表2026 v2.xlsx</p>
          </div>
        )}
      </div>

      {error && (
        <div className="error-alert">
          <svg className="error-icon" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
          </svg>
          <span>{error}</span>
          <button type="button" className="error-close" onClick={() => setError(null)} aria-label="關閉錯誤訊息">✕</button>
        </div>
      )}

      <div className="uploader-footer">
        <div className="footer-item">
          <span className="dot success"></span>
          <span>防呆與比對</span>
        </div>
        <div className="footer-item">
          <span className="dot info"></span>
          <span>資料完整性檢核</span>
        </div>
        <div className="footer-item">
          <span className="dot warning"></span>
          <span>線上確認流程</span>
        </div>
      </div>
    </div>
  );
}

Uploader.propTypes = {
  onDataLoaded: PropTypes.func.isRequired,
};



