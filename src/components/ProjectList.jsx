import { useState, useEffect } from 'react';
import PropTypes from 'prop-types';
import { getJSON, setJSON } from '../utils/storage';
import { isSignOffComplete } from '../utils/signOffStatus';
import { validateAlignment } from '../utils/validator';
import { navigateTo } from '../utils/hashRouter.js';
import { uiIcons } from '../utils/svgIcons';
import './ProjectList.css';

export default function ProjectList({ projects, onSelectProject, onCreateProject, onDeleteProject, currentUser }) {
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [newProjectName, setNewProjectName] = useState('');
  const [isCreating, setIsCreating] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');

  // 一覽表排版偏好（桌機於工具列切換；手機版於 AccountSettings 顯示設定區管理，共用同一 localStorage key）
  const savedPrefs = getJSON('projectListPrefs', {});
  const [filterMode, setFilterMode] = useState('in-progress');
  const [fontSize, setFontSize] = useState(savedPrefs.fontSize || 'medium');
  const [rowSpacing, setRowSpacing] = useState(savedPrefs.rowSpacing || 'normal');

  useEffect(() => {
    setJSON('projectListPrefs', { fontSize, rowSpacing });
  }, [fontSize, rowSpacing]);
  const [currentPage, setCurrentPage] = useState(1);

  // 手機版新增選單與卡片操作選單狀態
  const [showMobileAddMenu, setShowMobileAddMenu] = useState(false);
  const [activeActionMenuId, setActiveActionMenuId] = useState(null);

  // ESC 鍵關閉 Modal 與選單
  useEffect(() => {
    const onKeyDown = (e) => {
      if (e.key === 'Escape') {
        setShowCreateModal(false);
        setShowMobileAddMenu(false);
        setActiveActionMenuId(null);
      }
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, []);

  // 全域快捷鍵：按 / 鍵聚焦搜尋框 (自動避開正在輸入其他輸入框的情境)
  useEffect(() => {
    const onGlobalKeyDown = (e) => {
      if (e.isComposing) return;
      const target = e.target;
      if (target && (target.tagName === 'INPUT' || target.tagName === 'TEXTAREA' || target.isContentEditable)) return;
      if (e.key === '/') {
        e.preventDefault();
        const searchInput = document.querySelector('input.search-input');
        searchInput?.focus();
      }
    };
    window.addEventListener('keydown', onGlobalKeyDown);
    return () => window.removeEventListener('keydown', onGlobalKeyDown);
  }, []);

  // 點擊空白處關閉選單
  useEffect(() => {
    if (!showMobileAddMenu && !activeActionMenuId) return;
    const onClickOutside = () => {
      setShowMobileAddMenu(false);
      setActiveActionMenuId(null);
    };
    window.addEventListener('click', onClickOutside);
    return () => window.removeEventListener('click', onClickOutside);
  }, [showMobileAddMenu, activeActionMenuId]);

  // Modal 開啟時鎖定背景捲動
  useEffect(() => {
    if (!showCreateModal) return;
    const prevOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => { document.body.style.overflow = prevOverflow; };
  }, [showCreateModal]);

  const handleSubmitCreate = async (e) => {
    e.preventDefault();
    if (isCreating) return; // 防止連點/連按 Enter 重複建立
    if (!newProjectName.trim()) return;
    setIsCreating(true);
    try {
      const ok = await onCreateProject(newProjectName.trim());
      if (ok !== false) {
        setNewProjectName('');
        setShowCreateModal(false);
      }
    } finally {
      setIsCreating(false);
    }
  };

  const [confirmDeleteProjectId, setConfirmDeleteProjectId] = useState(null);

  // 1. 根據關鍵字搜尋
  const searchedProjects = projects.filter(proj => 
    proj.name.toLowerCase().includes(searchTerm.toLowerCase())
  );

  // 2. 根據簽核狀態機與退件狀態判定狀態 (D-21, D-147, D-148, 9A.6.2)
  const getProjectStatus = (p) => {
    if (isSignOffComplete(p.data)) {
      return { key: 'approved', label: '已核准 ✓', className: 'aligned' };
    }
    if (p.data?.basicInfo?.signOff?.rejection) {
      return { key: 'rejected', label: '⛔ 已退件 待修正', className: 'rejected' };
    }
    const sign = p.data?.basicInfo?.signOff || {};
    const signedCount = (sign.rdSignature ? 1 : 0) + (sign.engineeringReviewSignature ? 1 : 0) + (sign.qaSignature ? 1 : 0);
    if (signedCount > 0) {
      return { key: 'signing', label: `簽核中 (${signedCount}/3) ⏳`, className: 'in-progress' };
    }
    const rate = p.data ? validateAlignment(p.data).alignmentRate : (p.alignmentRate || 0);
    if (rate === 0) {
      return { key: 'draft', label: '草稿', className: 'pending' };
    }
    return { key: 'in-progress', label: '填寫中 ⏳', className: 'in-progress' };
  };

  const isProjectRejected = (p) => getProjectStatus(p).key === 'rejected';
  const isProjectCompleted = (p) => getProjectStatus(p).key === 'approved';

  const countInProgress = searchedProjects.filter(p => !isProjectRejected(p) && !isProjectCompleted(p)).length;
  const countCompleted = searchedProjects.filter(isProjectCompleted).length;
  const countRejected = searchedProjects.filter(isProjectRejected).length;
  const countAll = searchedProjects.length;

  const formatUpdatedAt = (updatedAt) => {
    if (!updatedAt) return '尚未儲存';
    const d = new Date(updatedAt);
    if (isNaN(d.getTime())) return '尚未儲存';
    return d.toLocaleString('zh-TW', {
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
      hour: '2-digit',
      minute: '2-digit'
    });
  };

  const filteredProjects = searchedProjects.filter(proj => {
    const status = getProjectStatus(proj);
    if (filterMode === 'in-progress') {
      return status.key !== 'approved' && status.key !== 'rejected';
    }
    if (filterMode === 'rejected') {
      return status.key === 'rejected';
    }
    if (filterMode === 'completed') {
      return status.key === 'approved';
    }
    return true; // 'all'
  }).sort((a, b) => {
    // D-148: 預設依 updatedAt 降冪排序，最新更新在最前
    const tA = a.updatedAt ? new Date(a.updatedAt).getTime() : 0;
    const tB = b.updatedAt ? new Date(b.updatedAt).getTime() : 0;
    return tB - tA;
  });

  // 3. 分頁計算 (預設每頁 10 筆)
  const itemsPerPage = 10;
  const totalPages = Math.ceil(filteredProjects.length / itemsPerPage) || 1;
  const validCurrentPage = Math.min(currentPage, totalPages);
  const paginatedProjects = filteredProjects.slice(
    (validCurrentPage - 1) * itemsPerPage,
    validCurrentPage * itemsPerPage
  );

  return (
    <div className="project-list-container animate-fade-in">
      {/* 桌機版 Header (SQE DailyWork 工業級工作台風格) */}
      <div className="project-list-header glass-card hide-on-mobile">
        <div className="header-info">
          <h2>機種管理中心</h2>
          <p className="header-desc">新機種委外加工需求對齊、製程管制與三方簽核作業工作台</p>
        </div>
        {currentUser?.role !== 'qa' && (
          <div className="header-actions">
            <button type="button" className="btn btn-primary" onClick={() => navigateTo('/projects/new?mode=template')}>
              ➕ 新增機種
            </button>
            <button type="button" 
              className="btn btn-secondary" 
              onClick={() => navigateTo('/projects/new?mode=import')}
            >
              📥 匯入 Excel 機種
            </button>
          </div>
        )}
      </div>

      {/* 手機版大標「機種」＋右上「+」按鈕與選單 */}
      <div className="mobile-project-header show-on-mobile">
        <h1 className="mobile-page-title">機種</h1>
        {currentUser?.role !== 'qa' && (
          <div className="mobile-header-menu-anchor">
            <button
              type="button"
              className="mobile-header-add-btn"
              onClick={(e) => {
                e.stopPropagation();
                setShowMobileAddMenu(v => !v);
              }}
              aria-label="新增機種"
              aria-expanded={showMobileAddMenu}
            >
              <uiIcons.plus size={22} />
              <span style={{ position: 'absolute', width: 1, height: 1, padding: 0, margin: -1, overflow: 'hidden', clip: 'rect(0, 0, 0, 0)', border: 0 }}>新增機種</span>
            </button>
            {showMobileAddMenu && (
              <div className="mobile-header-dropdown glass-card">
                <button
                  type="button"
                  className="mobile-dropdown-item"
                  onClick={() => { setShowMobileAddMenu(false); navigateTo('/projects/new?mode=template'); }}
                >
                  <uiIcons.plus size={18} />
                  <span>新增機種</span>
                </button>
                <button
                  type="button"
                  className="mobile-dropdown-item"
                  onClick={() => { setShowMobileAddMenu(false); navigateTo('/projects/new?mode=import'); }}
                >
                  <uiIcons.importExcel size={18} />
                  <span>匯入 Excel 機種</span>
                </button>
              </div>
            )}
          </div>
        )}
      </div>

      {/* 4 欄式互動 KPI 統計卡 (對齊 SQE DailyWork 首頁 4-Column Metric Cards) */}
      <div className="project-kpi-grid">
        <div
          onClick={() => { setFilterMode('in-progress'); setCurrentPage(1); }}
          className={`kpi-card ${filterMode === 'in-progress' ? 'active' : ''}`}
          role="button"
          tabIndex={0}
          onKeyDown={(e) => { if (e.key === 'Enter') { setFilterMode('in-progress'); setCurrentPage(1); } }}
          title="點擊篩選進行中機種"
        >
          <div className="kpi-header">
            <span className="kpi-title">進行中機種</span>
            <span className="kpi-icon kpi-icon-amber" aria-hidden="true">⏳</span>
          </div>
          <div className="kpi-value font-mono">{countInProgress}</div>
          <p className="kpi-hint">點擊篩選進行中案件</p>
        </div>

        <div
          onClick={() => { setFilterMode('completed'); setCurrentPage(1); }}
          className={`kpi-card ${filterMode === 'completed' ? 'active' : ''}`}
          role="button"
          tabIndex={0}
          onKeyDown={(e) => { if (e.key === 'Enter') { setFilterMode('completed'); setCurrentPage(1); } }}
          title="點擊篩選已完成簽核機種"
        >
          <div className="kpi-header">
            <span className="kpi-title">已完成簽核</span>
            <span className="kpi-icon kpi-icon-emerald" aria-hidden="true">✅</span>
          </div>
          <div className="kpi-value font-mono kpi-value-emerald">{countCompleted}</div>
          <p className="kpi-hint">三方簽章已完成核准</p>
        </div>

        <div
          onClick={() => { setFilterMode('rejected'); setCurrentPage(1); }}
          className={`kpi-card ${filterMode === 'rejected' ? 'active' : ''}`}
          role="button"
          tabIndex={0}
          onKeyDown={(e) => { if (e.key === 'Enter') { setFilterMode('rejected'); setCurrentPage(1); } }}
          title="點擊篩選品保退件案件"
        >
          <div className="kpi-header">
            <span className="kpi-title">已退件待修正</span>
            <span className="kpi-icon kpi-icon-red" aria-hidden="true">⛔</span>
          </div>
          <div className="kpi-value font-mono kpi-value-red">{countRejected}</div>
          <p className="kpi-hint">需工程或研發重審</p>
        </div>

        <div
          onClick={() => { setFilterMode('all'); setCurrentPage(1); }}
          className={`kpi-card ${filterMode === 'all' ? 'active' : ''}`}
          role="button"
          tabIndex={0}
          onKeyDown={(e) => { if (e.key === 'Enter') { setFilterMode('all'); setCurrentPage(1); } }}
          title="點擊檢視全部機種"
        >
          <div className="kpi-header">
            <span className="kpi-title">全部機種清冊</span>
            <span className="kpi-icon kpi-icon-blue" aria-hidden="true">📁</span>
          </div>
          <div className="kpi-value font-mono">{countAll}</div>
          <p className="kpi-hint">全量機種總數</p>
        </div>
      </div>

      {/* 整合式工作台卡片：搜尋、篩選膠囊與字級排版控制 */}
      <div className="project-workbench-card glass-card">
        <div className="workbench-top-row">
          {/* 搜尋列 */}
          <div className="project-search-container">
            <span className="search-icon"><uiIcons.search size={18} /></span>
            <input 
              type="text" 
              className="search-input" 
              placeholder="搜尋機種名稱... (按 / 鍵聚焦)" 
              name="search" 
              value={searchTerm} 
              onChange={(e) => { setSearchTerm(e.target.value); setCurrentPage(1); }} 
              title="按 / 鍵可快速搜尋"
            />
            {searchTerm && (
              <button type="button" 
                className="search-clear-btn" 
                onClick={() => { setSearchTerm(''); setCurrentPage(1); }} 
                title="清除搜尋內容"
                aria-label="清除搜尋內容"
              >
                <uiIcons.close size={14} />
              </button>
            )}
          </div>

          {/* 桌機版工具列篩選與顯示選項 */}
          <div className="project-list-toolbar hide-on-mobile">
            <div className="toolbar-tabs">
              <button type="button" 
                className={`tab-filter-btn ${filterMode === 'in-progress' ? 'active' : ''}`}
                onClick={() => { setFilterMode('in-progress'); setCurrentPage(1); }}
              >
                ⏳ 進行中 ({countInProgress})
              </button>
              <button type="button" 
                className={`tab-filter-btn ${filterMode === 'completed' ? 'active' : ''}`}
                onClick={() => { setFilterMode('completed'); setCurrentPage(1); }}
              >
                ✅ 已完成 ({countCompleted})
              </button>
              <button type="button" 
                className={`tab-filter-btn ${filterMode === 'rejected' ? 'active' : ''}`}
                onClick={() => { setFilterMode('rejected'); setCurrentPage(1); }}
                style={{ color: filterMode === 'rejected' ? '#e11d48' : undefined }}
              >
                ⛔ 已退件 ({countRejected})
              </button>
              <button type="button" 
                className={`tab-filter-btn ${filterMode === 'all' ? 'active' : ''}`}
                onClick={() => { setFilterMode('all'); setCurrentPage(1); }}
              >
                📁 全部 ({countAll})
              </button>
            </div>

            <div className="toolbar-settings">
              <div className="control-group">
                <span className="control-label">字體大小:</span>
                <div className="btn-toggle-group">
                  <button type="button" className={`toggle-btn ${fontSize === 'small' ? 'active' : ''}`} onClick={() => setFontSize('small')} title="12px">小</button>
                  <button type="button" className={`toggle-btn ${fontSize === 'medium' ? 'active' : ''}`} onClick={() => setFontSize('medium')} title="14px">中</button>
                  <button type="button" className={`toggle-btn ${fontSize === 'large' ? 'active' : ''}`} onClick={() => setFontSize('large')} title="16px">大</button>
                </div>
              </div>
              <div className="control-group">
                <span className="control-label">表格間距:</span>
                <div className="btn-toggle-group">
                  <button type="button" className={`toggle-btn ${rowSpacing === 'compact' ? 'active' : ''}`} onClick={() => setRowSpacing('compact')} title="緊湊間距">緊湊</button>
                  <button type="button" className={`toggle-btn ${rowSpacing === 'normal' ? 'active' : ''}`} onClick={() => setRowSpacing('normal')} title="標準間距">標準</button>
                  <button type="button" className={`toggle-btn ${rowSpacing === 'relaxed' ? 'active' : ''}`} onClick={() => setRowSpacing('relaxed')} title="寬鬆間距">寬鬆</button>
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* 手機版單列 Segmented Control（進行中／已完成／退件／全部，每段 ≥44 高） */}
        <div className="mobile-segmented-control show-on-mobile" role="tablist">
          <button
            type="button"
            role="tab"
            aria-selected={filterMode === 'in-progress'}
            className={`mobile-segment-btn ${filterMode === 'in-progress' ? 'active' : ''}`}
            onClick={() => { setFilterMode('in-progress'); setCurrentPage(1); }}
          >
            進行中 ({countInProgress})
          </button>
          <button
            type="button"
            role="tab"
            aria-selected={filterMode === 'completed'}
            className={`mobile-segment-btn ${filterMode === 'completed' ? 'active' : ''}`}
            onClick={() => { setFilterMode('completed'); setCurrentPage(1); }}
          >
            已完成 ({countCompleted})
          </button>
          <button
            type="button"
            role="tab"
            aria-selected={filterMode === 'rejected'}
            className={`mobile-segment-btn ${filterMode === 'rejected' ? 'active' : ''}`}
            onClick={() => { setFilterMode('rejected'); setCurrentPage(1); }}
          >
            退件 ({countRejected})
          </button>
          <button
            type="button"
            role="tab"
            aria-selected={filterMode === 'all'}
            className={`mobile-segment-btn ${filterMode === 'all' ? 'active' : ''}`}
            onClick={() => { setFilterMode('all'); setCurrentPage(1); }}
          >
            全部 ({countAll})
          </button>
        </div>

        {/* 工具列底部分隔線後的統計列 (對齊 SQE DailyWork) */}
        <div className="workbench-meta-bar">
          <span className="meta-item">共 <strong className="font-mono text-slate-800">{filteredProjects.length}</strong> 筆機種單據</span>
          <span className="meta-item">第 <strong className="font-mono text-slate-800">{validCurrentPage}</strong> / <strong className="font-mono text-slate-800">{totalPages}</strong> 頁</span>
        </div>
      </div>

      {/* 機種一覽表 (表格視圖) */}
      <div className={`project-table-wrapper glass-card size-${fontSize} spacing-${rowSpacing}`}>
        <table className="project-table">
          <thead>
            <tr>
              <th>📁 機種與一覽表名稱</th>
              <th>📊 完成率</th>
              <th className="hide-on-mobile">🏷️ 狀態</th>
              <th className="hide-on-mobile">🕒 更新時間</th>
              <th className="text-center hide-on-mobile">⚙️ 動作</th>
            </tr>
          </thead>
          <tbody>
            {filteredProjects.length === 0 ? (
              <tr>
                <td colSpan={5} className="table-empty-state">
                  <span className="empty-icon">📂</span>
                  <h4>無符合此篩選條件的機種</h4>
                </td>
              </tr>
            ) : (
              paginatedProjects.map((proj) => {
                const dateDisplay = formatUpdatedAt(proj.updatedAt);
                const projRate = proj.data ? validateAlignment(proj.data).alignmentRate : (proj.alignmentRate || 0);
                const projStatus = getProjectStatus(proj);

                return (
                  <tr 
                    key={proj.id} 
                    className="project-row-item"
                    onClick={() => onSelectProject(proj.id)}
                  >
                    <td className="proj-name-cell">
                      <div className="proj-name-header">
                        <span className="proj-folder-icon"><uiIcons.folder size={18} /></span>
                        <span className="proj-name-text" title={proj.name}>{proj.name}</span>
                      </div>
                      {/* 手機端專屬更多選項按鈕與選單 */}
                      <div className="mobile-row-more-anchor show-on-mobile">
                        <button
                          type="button"
                          className="mobile-more-btn"
                          onClick={(e) => {
                            e.stopPropagation();
                            setActiveActionMenuId(activeActionMenuId === proj.id ? null : proj.id);
                          }}
                          aria-label="更多選項"
                          aria-expanded={activeActionMenuId === proj.id}
                        >
                          <uiIcons.dots size={20} />
                        </button>
                        {activeActionMenuId === proj.id && (
                          <div className="mobile-row-popover glass-card">
                            {confirmDeleteProjectId === proj.id ? (
                              <div className="mobile-delete-confirm-box">
                                <span style={{ fontSize: 'var(--fs-footnote)', color: 'var(--c-error)', fontWeight: 600 }}>確定刪除此機種？</span>
                                <div style={{ display: 'flex', gap: '8px', marginTop: '6px' }}>
                                  <button
                                    type="button"
                                    className="btn btn-danger compact-btn"
                                    onClick={(e) => {
                                      e.stopPropagation();
                                      setConfirmDeleteProjectId(null);
                                      setActiveActionMenuId(null);
                                      onDeleteProject(proj.id);
                                    }}
                                  >
                                    確定刪除
                                  </button>
                                  <button
                                    type="button"
                                    className="btn btn-secondary compact-btn"
                                    onClick={(e) => {
                                      e.stopPropagation();
                                      setConfirmDeleteProjectId(null);
                                      setActiveActionMenuId(null);
                                    }}
                                  >
                                    取消
                                  </button>
                                </div>
                              </div>
                            ) : (
                              <button
                                type="button"
                                className="mobile-popover-item text-danger"
                                onClick={(e) => {
                                  e.stopPropagation();
                                  setConfirmDeleteProjectId(proj.id);
                                }}
                              >
                                <uiIcons.trash size={16} />
                                <span>刪除機種</span>
                              </button>
                            )}
                          </div>
                        )}
                      </div>
                    </td>
                    <td>
                      <div className="table-progress-wrapper">
                        <div className="table-progress-bar-bg">
                          <div 
                            className={`table-progress-bar-fg ${projRate === 100 ? 'completed' : ''}`}
                            style={{ width: `${projRate}%` }}
                          ></div>
                        </div>
                        <span className={`table-progress-rate font-mono ${projRate === 100 ? 'aligned' : ''}`}>
                          {projRate}%
                        </span>
                      </div>
                    </td>
                    <td className="status-cell">
                      <span className={`status-badge ${projStatus.className}`} style={projStatus.key === 'rejected' ? { background: '#ffe4e6', color: '#e11d48', border: '1px solid #fecdd3' } : undefined}>
                        {projStatus.label}
                      </span>
                    </td>
                    <td className="table-date-cell font-mono">
                      <span className="mobile-date-label show-on-mobile">🕒 更新時間：</span>
                      {dateDisplay}
                    </td>
                    <td className="hide-on-mobile" onClick={(e) => e.stopPropagation()}>
                      <div className="table-actions-cell">
                        <button type="button" 
                          className="btn btn-primary compact-btn table-action-btn btn-edit"
                          onClick={() => onSelectProject(proj.id)}
                        >
                          進入編輯
                        </button>
                        {confirmDeleteProjectId === proj.id ? (
                          <span style={{ display: 'inline-flex', gap: '4px', alignItems: 'center' }}>
                            <button
                              type="button"
                              className="btn btn-danger compact-btn table-action-btn btn-confirm-delete"
                              onClick={() => {
                                setConfirmDeleteProjectId(null);
                                onDeleteProject(proj.id);
                              }}
                            >
                              確定刪除
                            </button>
                            <button
                              type="button"
                              className="btn btn-secondary compact-btn table-action-btn"
                              onClick={() => setConfirmDeleteProjectId(null)}
                            >
                              取消
                            </button>
                          </span>
                        ) : (
                          <button type="button"
                            className="btn btn-danger compact-btn table-action-btn btn-delete"
                            onClick={() => setConfirmDeleteProjectId(proj.id)}
                          >
                            <uiIcons.trash size={14} />
                            <span>刪除</span>
                          </button>
                        )}
                      </div>
                    </td>
                  </tr>
                );
              })
            )}
          </tbody>
        </table>
      </div>

      {/* 分頁控制元件 */}
      {filteredProjects.length > itemsPerPage && (
        <div className="table-pagination glass-card">
          <button type="button" 
            className="pagination-btn"
            disabled={validCurrentPage === 1}
            onClick={() => setCurrentPage(Math.max(validCurrentPage - 1, 1))}
            title="上一頁" aria-label="上一頁"
          >
            ◀
          </button>
          
          <div className="pagination-numbers">
            {Array.from({ length: totalPages }, (_, i) => i + 1).map((page) => (
              <button type="button"
                key={page}
                className={`pagination-number-btn ${validCurrentPage === page ? 'active' : ''}`}
                onClick={() => setCurrentPage(page)}
              >
                {page}
              </button>
            ))}
          </div>

          <button type="button" 
            className="pagination-btn"
            disabled={validCurrentPage === totalPages}
            onClick={() => setCurrentPage(Math.min(validCurrentPage + 1, totalPages))}
            title="下一頁" aria-label="下一頁"
          >
            ▶
          </button>
        </div>
      )}

      {showCreateModal && (
        <div className="new-project-card glass-card animate-fade-in" style={{ marginTop: '20px', padding: '24px', border: '1px solid var(--c-border, #e2e8f0)', borderRadius: '12px' }}>
          <div className="modal-header" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px' }}>
            <h3 style={{ margin: 0 }}>建立新機種</h3>
            <button type="button" className="close-btn" onClick={() => setShowCreateModal(false)} aria-label="取消">×</button>
          </div>
          <form onSubmit={handleSubmitCreate}>
            <div className="modal-body">
              <div className="form-group">
                <label htmlFor="projectName" className="form-label">機種與一覽表名稱</label>
                <input 
                  type="text" 
                  id="projectName" 
                  className="form-input edit-active"
                  placeholder="例如：新機種製作需求一覽表2026_機種A" 
                  name="projectName" 
                  value={newProjectName}
                  onChange={(e) => setNewProjectName(e.target.value)}
                  required
                />
              </div>
            </div>
            <div className="modal-footer" style={{ display: 'flex', gap: '10px', marginTop: '16px' }}>
              <button type="submit" className="btn btn-primary" disabled={isCreating}>
                {isCreating ? '建立中…' : '建立機種'}
              </button>
              <button type="button" className="btn btn-secondary" onClick={() => setShowCreateModal(false)}>
                取消
              </button>
            </div>
          </form>
        </div>
      )}
    </div>
  );
}

ProjectList.propTypes = {
  projects: PropTypes.arrayOf(
    PropTypes.shape({
      id: PropTypes.string.isRequired,
      name: PropTypes.string.isRequired,
      alignmentRate: PropTypes.number,
      updatedAt: PropTypes.string,
    })
  ).isRequired,
  onSelectProject: PropTypes.func.isRequired,
  onCreateProject: PropTypes.func.isRequired,
  onDeleteProject: PropTypes.func.isRequired,
  currentUser: PropTypes.shape({
    role: PropTypes.string,
  }),
};




