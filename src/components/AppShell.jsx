import { useState, useEffect, useRef } from 'react';
import PropTypes from 'prop-types';
import { WORKFLOW_STEPS } from '../utils/workflow';
import { uiIcons } from '../utils/svgIcons';
import BottomSheet from './BottomSheet';
import './AppShell.css';

/* 側欄導覽項目(獨立元件,避免於 render 內建立元件) */
function NavItem({ tab, icon, label, badge, status, applicable, index, activeTab, collapsed, alignmentRate, onGo }) {
  const active = activeTab === tab;
  const isDone = status === 'done';
  const isNotApplicable = isDone && applicable === false;
  const stateLabel = isNotApplicable ? '不適用' : status === 'inProgress' ? '進行中' : isDone ? '完成' : '';
  return (
    <button
      type="button"
      className={`nav-item ${active ? 'active' : ''} ${status ? `status-${status}` : ''} ${isNotApplicable ? 'not-applicable' : ''}`}
      onClick={() => onGo(tab)}
      title={collapsed ? `${label}${stateLabel ? ` · ${stateLabel}` : ''}` : undefined}
    >
      <span className="nav-icon">
        {typeof index === 'number' ? (
          <span className={`nav-step-num ${isDone ? 'done' : ''} ${status === 'inProgress' ? 'in-progress' : ''} ${isNotApplicable ? 'not-applicable' : ''}`}>
            {isNotApplicable ? '—' : isDone ? <uiIcons.check size={14} /> : index}
          </span>
        ) : (
          icon
        )}
      </span>
      <span className="nav-label">{label}</span>
      {badge != null && (
        <span className={`nav-badge ${alignmentRate === 100 ? 'ok' : ''}`}>{badge}</span>
      )}
      {stateLabel && typeof index === 'number' && (
        <span className={`nav-state ${status} ${isNotApplicable ? 'not-applicable' : ''}`}>{stateLabel}</span>
      )}
      {status && typeof index !== 'number' && (
        <span className={`nav-dot ${status}`} aria-hidden="true" />
      )}
    </button>
  );
}

NavItem.propTypes = {
  tab: PropTypes.string.isRequired,
  icon: PropTypes.node,
  label: PropTypes.string.isRequired,
  badge: PropTypes.oneOfType([PropTypes.string, PropTypes.number]),
  status: PropTypes.string,
  applicable: PropTypes.bool,
  index: PropTypes.number,
  activeTab: PropTypes.string.isRequired,
  collapsed: PropTypes.bool.isRequired,
  alignmentRate: PropTypes.number,
  onGo: PropTypes.func.isRequired,
};

/**
 * 自適應導覽外殼。
 * - 桌機/筆電 (≥1024px):固定側欄,可收合成 icon rail。
 * - 平板 (768–1023px):側欄收為抽屜(漢堡開啟),並在頂部顯示橫向捲動步驟列。
 * - 手機 (≤767px):底部分頁列 (MobileTabBar) + 頂欄精簡 + BottomSheet 步驟抽屜。
 */
export default function AppShell({
  currentUser,
  onLogout,
  inProject,
  projectName,
  onBackToList,
  activeTab,
  onTabChange,
  sectionStatus = {},
  alignmentRate = 0,
  saveState = 'idle',
  savedAt = null,
  onlineCount = 0,
  children,
}) {
  const fmtTime = (ts) => {
    if (!ts) return '';
    const d = new Date(ts);
    return `${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`;
  };
  const saveTimeStr = fmtTime(savedAt);
  const saveLabel =
    saveState === 'saving' ? '儲存中…'
    : saveState === 'saved' ? (saveTimeStr ? `已儲存 ${saveTimeStr}` : '已儲存')
    : '自動儲存';

  const [collapsed, setCollapsed] = useState(false); // 桌機:側欄收合成 rail
  const [drawerOpen, setDrawerOpen] = useState(false); // 平板:抽屜開啟
  const [stepSheetOpen, setStepSheetOpen] = useState(false); // 手機:全部步驟 BottomSheet
  const [todoFocused, setTodoFocused] = useState(false); // 手機底欄:區分儀表板與待辦焦點
  const railRef = useRef(null);
  const activePillRef = useRef(null);

  // 切換分頁時把作用中的步驟 pill 捲到可視中央
  useEffect(() => {
    if (activePillRef.current) {
      activePillRef.current.scrollIntoView({ behavior: 'smooth', inline: 'center', block: 'nearest' });
    }
  }, [activeTab]);

  // ESC 鍵關閉抽屜
  useEffect(() => {
    if (!drawerOpen) return;
    const handleKeyDown = (e) => {
      if (e.key === 'Escape') setDrawerOpen(false);
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [drawerOpen]);

  const go = (tab, focusTodo = false) => {
    setTodoFocused(Boolean(focusTodo));
    onTabChange(tab);
    setDrawerOpen(false);
    setStepSheetOpen(false);
  };

  const completedSteps = WORKFLOW_STEPS.filter((step) => sectionStatus[step.key]?.state === 'done').length;
  const isStepTab = WORKFLOW_STEPS.some((step) => step.key === activeTab);
  const currentStepIndex = WORKFLOW_STEPS.findIndex((step) => step.key === activeTab);
  const currentStep = currentStepIndex >= 0 ? WORKFLOW_STEPS[currentStepIndex] : null;

  // 尋找最近一個未完成步驟供底欄快捷跳轉
  const firstIncompleteStep = WORKFLOW_STEPS.find((s) => sectionStatus[s.key]?.state !== 'done');
  const workflowTargetTab = currentStep ? currentStep.key : (firstIncompleteStep ? firstIncompleteStep.key : 'basicInfo');

  const navShared = { activeTab, collapsed, alignmentRate, onGo: go };

  const bottomSheetSteps = WORKFLOW_STEPS.map((step) => ({
    key: step.key,
    label: step.label,
    state: sectionStatus[step.key]?.state || 'pending',
    applicable: sectionStatus[step.key]?.applicable !== false,
  }));

  return (
    <div className="shell" data-collapsed={collapsed} data-drawer={drawerOpen}>
      {/* ===== 側欄 / 抽屜 (桌機固定, 平板抽屜) ===== */}
      <aside className="shell-sidebar">
        <div className="shell-brand">
          <span className="brand-mark" aria-hidden="true">M</span>
          <span className="brand-text">
            <span className="brand-title">產品委外加工系統</span>
            <span className="brand-sub">醫電鼎眾 Mitcorp</span>
          </span>
        </div>

        <nav className="shell-nav">
          {inProject ? (
            <>
              <div className="nav-group-label">總覽</div>
              <NavItem {...navShared} tab="dashboard" icon={<uiIcons.dashboard size={18} />} label="儀表板" badge={`${alignmentRate}%`} />

              <div className="nav-group-label">
                確認流程
                <span className="nav-group-count">{completedSteps}/{WORKFLOW_STEPS.length}</span>
              </div>
              {WORKFLOW_STEPS.map((step, index) => (
                <NavItem
                  {...navShared}
                  key={step.key}
                  tab={step.key}
                  label={step.label}
                  index={index + 1}
                  status={sectionStatus[step.key]?.state || 'pending'}
                  applicable={sectionStatus[step.key]?.applicable !== false}
                />
              ))}

              <div className="nav-group-label">個人與設定</div>
              <NavItem {...navShared} tab="account" icon={<uiIcons.account size={18} />} label="我的帳號" />
              {currentUser?.role === 'admin' && (
                <NavItem {...navShared} tab="settings" icon={<uiIcons.settings size={18} />} label="系統設定" />
              )}
            </>
          ) : (
            <>
              <div className="nav-group-label">工作區</div>
              <button type="button" className={`nav-item ${activeTab !== 'account' && activeTab !== 'settings' ? 'active' : ''}`} onClick={onBackToList}>
                <span className="nav-icon"><uiIcons.folder size={18} /></span>
                <span className="nav-label">機種管理中心</span>
              </button>
              <div className="nav-group-label">個人與設定</div>
              <NavItem {...navShared} tab="account" icon={<uiIcons.account size={18} />} label="我的帳號" />
              {currentUser?.role === 'admin' && (
                <NavItem {...navShared} tab="settings" icon={<uiIcons.settings size={18} />} label="系統設定" />
              )}
            </>
          )}
        </nav>

        <div className="shell-user">
          <span className="user-avatar" aria-hidden="true"><uiIcons.account size={22} /></span>
          <span className="user-meta">
            <span className="user-name">{currentUser?.username}</span>
            <span className="user-role">{currentUser?.unit} · {currentUser?.level}</span>
          </span>
          <button type="button" className="user-logout" onClick={onLogout} title="登出系統" aria-label="登出系統">
            <uiIcons.logout size={18} />
          </button>
        </div>

        <button
          type="button"
          className="rail-collapse"
          onClick={() => setCollapsed((c) => !c)}
          title={collapsed ? '展開側欄' : '收合側欄'}
          aria-label={collapsed ? '展開側欄' : '收合側欄'}
        >
          {collapsed ? '»' : '«'}
        </button>
      </aside>

      {/* ===== 主區 ===== */}
      <div className="shell-body">
        <header className="shell-topbar">
          {/* 平板漢堡選單 (手機端由 CSS 隱藏) */}
          <button
            type="button"
            className="topbar-burger"
            onClick={() => setDrawerOpen((o) => !o)}
            aria-label="開啟導覽選單"
          >
            ☰
          </button>

          {/* 手機專屬返回機種按鈕 (≤767px，進入機種時顯示) */}
          {inProject && (
            <button
              type="button"
              className="topbar-mobile-back"
              onClick={onBackToList}
              aria-label="返回機種列表"
            >
              <uiIcons.chevronLeft size={20} />
              <span className="mobile-back-text">機種</span>
            </button>
          )}

          <div className="topbar-title" title={inProject ? `${projectName} · ${currentStep?.label || (activeTab === 'dashboard' ? '儀表板' : activeTab)}` : '機種管理中心'}>
            {inProject ? (
              <div className="topbar-breadcrumbs">
                <button type="button" className="breadcrumb-link" onClick={onBackToList} title="回機種管理中心">
                  機種管理中心
                </button>
                <span className="breadcrumb-sep" aria-hidden="true">/</span>
                <span className="breadcrumb-proj" title={projectName}>{projectName}</span>
                <span className="breadcrumb-sep" aria-hidden="true">/</span>
                <span className="breadcrumb-current">
                  {currentStep ? currentStep.label : activeTab === 'dashboard' ? '儀表板' : activeTab === 'settings' ? '設定' : activeTab === 'account' ? '個人帳號' : '檢視'}
                </span>
              </div>
            ) : (
              '機種管理中心'
            )}
          </div>

          <div className="topbar-right">
            {inProject && onlineCount > 1 && (
              <span className="presence-pill" title={`${onlineCount} 人正在檢視此機種`}>
                <uiIcons.account size={14} /> {onlineCount}
              </span>
            )}

            {/* 存檔狀態提示 (手機精簡 icon + 無障礙宣告，桌機完整文字) */}
            {inProject && (
              <div
                className={`save-hint save-${saveState}`}
                role="status"
                aria-live="polite"
                aria-label={saveLabel}
                title="變更會自動儲存至本機"
              >
                {saveState === 'saving' ? (
                  <span className="save-icon save-spinning" aria-hidden="true">
                    <uiIcons.spinner size={16} />
                  </span>
                ) : saveState === 'saved' ? (
                  <span className="save-icon save-check" aria-hidden="true">
                    <uiIcons.check size={16} />
                  </span>
                ) : (
                  <span className="save-dot" aria-hidden="true" />
                )}
                <span className="save-text-desktop">{saveLabel}</span>
                <span className="save-text-mobile">{saveTimeStr ? `已存 ${saveTimeStr}` : '已存'}</span>
              </div>
            )}

            {inProject && (
              <button type="button" className="btn btn-secondary topbar-back" onClick={onBackToList}>
                <uiIcons.chevronLeft size={16} /> 回列表
              </button>
            )}
          </div>
        </header>

        {/* 手機精簡情境列 (≤767px，進入機種時顯示) */}
        {inProject && (
          <div className="shell-context-rail">
            <div className="context-rail-info">
              <span className="context-rail-title">
                {currentStep ? (
                  <>步驟 {currentStepIndex + 1} / 10 · {currentStep.label}</>
                ) : activeTab === 'dashboard' ? (
                  <>總覽 · 儀表板</>
                ) : activeTab === 'settings' ? (
                  <>系統設定</>
                ) : activeTab === 'account' ? (
                  <>個人帳號</>
                ) : (
                  <>{projectName || '機種需求'}</>
                )}
              </span>
              <div className="context-progress-bar-bg" aria-hidden="true">
                <div
                  className="context-progress-bar-fg"
                  style={{ width: `${alignmentRate}%` }}
                />
              </div>
            </div>
            <button
              type="button"
              className="context-rail-btn"
              onClick={() => setStepSheetOpen(true)}
              aria-label="查看全部步驟清單"
            >
              <span>全部步驟</span>
              <uiIcons.chevronDown size={14} />
            </button>
          </div>
        )}

        {/* 平板/桌機橫向步驟列 (≥768px 顯示) */}
        {inProject && (
          <div className="shell-steprail" ref={railRef}>
            <button
              type="button"
              ref={activeTab === 'dashboard' ? activePillRef : null}
              className={`step-pill ${activeTab === 'dashboard' ? 'active' : ''}`}
              onClick={() => go('dashboard')}
            >
              <span className="pill-icon"><uiIcons.dashboard size={16} /></span>
              儀表板
              <span className={`pill-badge ${alignmentRate === 100 ? 'ok' : ''}`}>{alignmentRate}%</span>
            </button>

            {WORKFLOW_STEPS.map((step, index) => {
              const stepStatus = sectionStatus[step.key] || { state: 'pending', applicable: true };
              const isDone = stepStatus.state === 'done';
              const isNotApplicable = isDone && stepStatus.applicable === false;
              return (
                <button
                  type="button"
                  key={step.key}
                  ref={activeTab === step.key ? activePillRef : null}
                  className={`step-pill ${activeTab === step.key ? 'active' : ''} status-${stepStatus.state} ${isNotApplicable ? 'not-applicable' : ''}`}
                  onClick={() => go(step.key)}
                >
                  <span className={`pill-num ${isDone ? 'done' : ''}`}>
                    {isNotApplicable ? '—' : isDone ? <uiIcons.check size={12} /> : index + 1}
                  </span>
                  {step.label}
                  {isNotApplicable && <span className="pill-state">不適用</span>}
                </button>
              );
            })}
            {currentUser?.role === 'admin' && (
              <button
                type="button"
                ref={activeTab === 'settings' ? activePillRef : null}
                className={`step-pill ${activeTab === 'settings' ? 'active' : ''}`}
                onClick={() => go('settings')}
              >
                <span className="pill-icon"><uiIcons.settings size={16} /></span>
                設定
              </button>
            )}
          </div>
        )}

        <main className={`shell-content ${isStepTab ? 'with-action-bar' : ''}`}>
          {children}
        </main>

        {/* 手機底部分頁列 (≤767px 全域常駐，表單步驟頁與 StepActionBar 上下疊構不重疊) */}
        <nav className="mobile-tab-bar" role="navigation" aria-label="底部分頁導覽列">
          {inProject ? (
            <>
              <button
                type="button"
                className="mobile-tab-item"
                onClick={onBackToList}
                aria-label="回機種列表"
              >
                <uiIcons.folder size={24} />
                <span className="mobile-tab-label">機種</span>
              </button>
              <button
                type="button"
                className={`mobile-tab-item ${activeTab === 'dashboard' && !todoFocused ? 'active' : ''}`}
                onClick={() => {
                  go('dashboard', false);
                  window.scrollTo({ top: 0, behavior: 'smooth' });
                }}
                aria-current={activeTab === 'dashboard' && !todoFocused ? 'page' : undefined}
              >
                <uiIcons.dashboard size={24} />
                <span className="mobile-tab-label">儀表板</span>
              </button>
              <button
                type="button"
                className={`mobile-tab-item ${isStepTab ? 'active' : ''}`}
                onClick={() => {
                  if (isStepTab) {
                    setStepSheetOpen((prev) => !prev);
                  } else {
                    go(workflowTargetTab, false);
                  }
                }}
                aria-label="進行中流程步驟"
                aria-current={isStepTab ? 'page' : undefined}
              >
                <uiIcons.workflow size={24} />
                <span className="mobile-tab-label">流程</span>
              </button>
              <button
                type="button"
                className={`mobile-tab-item ${activeTab === 'dashboard' && todoFocused ? 'active' : ''}`}
                onClick={() => {
                  go('dashboard', true);
                  setTimeout(() => {
                    const todoElem = document.querySelector('.dashboard-pending-card, .dashboard-todos, .dashboard-summary-grid');
                    if (todoElem) todoElem.scrollIntoView({ behavior: 'smooth', block: 'start' });
                  }, 100);
                }}
                aria-label="待辦事項"
                aria-current={activeTab === 'dashboard' && todoFocused ? 'page' : undefined}
              >
                <uiIcons.todo size={24} />
                <span className="mobile-tab-label">待辦</span>
              </button>
              <button
                type="button"
                className={`mobile-tab-item ${activeTab === 'account' ? 'active' : ''}`}
                onClick={() => go('account', false)}
                aria-current={activeTab === 'account' ? 'page' : undefined}
              >
                <uiIcons.account size={24} />
                <span className="mobile-tab-label">帳號</span>
              </button>
            </>
          ) : (
            <>
              <button
                type="button"
                className={`mobile-tab-item ${activeTab !== 'account' && activeTab !== 'settings' ? 'active' : ''}`}
                onClick={onBackToList}
                aria-current={activeTab !== 'account' && activeTab !== 'settings' ? 'page' : undefined}
              >
                <uiIcons.folder size={24} />
                <span className="mobile-tab-label">機種</span>
              </button>
              <button
                type="button"
                className={`mobile-tab-item ${activeTab === 'account' ? 'active' : ''}`}
                onClick={() => go('account', false)}
                aria-current={activeTab === 'account' ? 'page' : undefined}
              >
                <uiIcons.account size={24} />
                <span className="mobile-tab-label">帳號</span>
              </button>
              {currentUser?.role === 'admin' && (
                <button
                  type="button"
                  className={`mobile-tab-item ${activeTab === 'settings' ? 'active' : ''}`}
                  onClick={() => go('settings', false)}
                  aria-current={activeTab === 'settings' ? 'page' : undefined}
                >
                  <uiIcons.settings size={24} />
                  <span className="mobile-tab-label">設定</span>
                </button>
              )}
            </>
          )}
        </nav>
      </div>

      {/* 手機端全部步驟 BottomSheet */}
      <BottomSheet
        isOpen={stepSheetOpen}
        onClose={() => setStepSheetOpen(false)}
        title="全部步驟"
        steps={bottomSheetSteps}
        activeTab={activeTab}
        onSelectStep={go}
        alignmentRate={alignmentRate}
      />

      {/* 平板抽屜遮罩 */}
      <button
        type="button"
        className="drawer-scrim"
        aria-label="關閉選單"
        onClick={() => setDrawerOpen(false)}
      />
    </div>
  );
}

AppShell.propTypes = {
  currentUser: PropTypes.shape({
    username: PropTypes.string,
    unit: PropTypes.string,
    level: PropTypes.string,
    role: PropTypes.string,
  }),
  onLogout: PropTypes.func.isRequired,
  inProject: PropTypes.bool.isRequired,
  projectName: PropTypes.string,
  onBackToList: PropTypes.func.isRequired,
  activeTab: PropTypes.string.isRequired,
  onTabChange: PropTypes.func.isRequired,
  sectionStatus: PropTypes.object,
  alignmentRate: PropTypes.number,
  saveState: PropTypes.string,
  savedAt: PropTypes.number,
  onlineCount: PropTypes.number,
  children: PropTypes.node,
};
