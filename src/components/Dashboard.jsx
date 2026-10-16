import { useMemo, useState } from 'react';
import PropTypes from 'prop-types';
import { validateAlignment } from '../utils/validator';
import { WORKFLOW_STEP_KEYS } from '../utils/workflow';
import './Dashboard.css';

/* 責任歸屬:本需求一覽表由「發包方(研發/工程)」填寫全部項目;
   供應商(委外加工廠)不負責填寫任何一項。電子簽章為獨立的簽核階段。 */
const partyOf = (msg) => (msg.includes('電子簽章') ? 'sign' : 'oem');

const PARTY_META = {
  oem: { label: '發包方（研發 / 工程）', icon: '🧪', desc: '需由發包方填寫' },
  sign: { label: '簽章', icon: '✍️', desc: '待上傳電子簽章' },
};

export default function Dashboard({ data, onGoToSection, sectionStatus = {}, currentUser }) {
  const report = useMemo(() => validateAlignment(data), [data]);
  const { warnings, alignmentRate } = report;

  const errors = useMemo(() => warnings.filter((w) => w.type === 'error'), [warnings]);
  const warns = useMemo(() => warnings.filter((w) => w.type === 'warning'), [warnings]);
  // D-134: 待辦清單同時包含 error 與 warning
  const todos = useMemo(() => [...errors, ...warns], [errors, warns]);
  const doneSteps = WORKFLOW_STEP_KEYS.filter((key) => sectionStatus[key]?.state === 'done').length;

  const byParty = useMemo(() => {
    const g = { oem: [], sign: [] };
    todos.forEach((w) => { g[partyOf(w.message)].push(w); });
    return g;
  }, [todos]);

  // U5 — 「下一步」只顯示目前角色能處理的項目
  // QA 與 Admin 只負責審核，不需被提示填寫欄位；簽章項目對所有角色均可見
  const isQaOrAdmin = currentUser?.role === 'qa' || currentUser?.role === 'admin';
  const actionableWarnings = useMemo(() => {
    if (!isQaOrAdmin) return todos;
    return todos.filter((w) => partyOf(w.message) === 'sign');
  }, [todos, isQaOrAdmin]);
  // D-134: 下一步優先取 error，若無 error 則取第一個 warning
  const nextItem = actionableWarnings.find(w => w.type === 'error')
    || actionableWarnings.find(w => w.type === 'warning')
    || null;

  const [showAll, setShowAll] = useState(false);
  const [filterParty, setFilterParty] = useState(null);

  const handleWarningClick = (warning) => {
    onGoToSection(warning.stepKey || 'basicInfo', warning.fieldKey || warning.message);
  };

  const visibleTodos = filterParty
    ? todos.filter((w) => partyOf(w.message) === filterParty)
    : todos;

  return (
    <div className="dashboard-v2">
      {/* ===== 進度 Hero ===== */}
      <div className="dash-hero glass-card">
        <div className="hero-rate" data-ok={alignmentRate === 100}>
          <span className="rate-num">{alignmentRate}<small>%</small></span>
          <span className="rate-label">欄位對齊率</span>
        </div>
        <div className="hero-main">
          <div className="hero-bar">
            <div className="hero-bar-fill" data-ok={alignmentRate === 100} style={{ width: `${alignmentRate}%` }} />
          </div>
          <div className="hero-stats">
            <span className="stat"><b>{doneSteps}</b>/{WORKFLOW_STEP_KEYS.length} 流程完成</span>
            {errors.length > 0 && <span className="stat stat-error">● {errors.length} 異常</span>}
            {warns.length > 0 && <span className="stat stat-warn">● {warns.length} 警告</span>}
            {warnings.length === 0 && <span className="stat stat-ok">✓ 已完成</span>}
          </div>
        </div>
      </div>

      {warnings.length === 0 ? (
        <div className="dash-clear glass-card">
          <svg className="clear-icon" fill="none" viewBox="0 0 24 24" stroke="currentColor" aria-hidden="true">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
          </svg>
          <div>
            <p className="clear-title">確認項目已完成</p>
          </div>
        </div>
      ) : (
        <>
          {/* ===== 下一步:最優先一件事 ===== */}
          {nextItem && (
            <button type="button" className="dash-next glass-card" onClick={() => handleWarningClick(nextItem)}>
              <span className="next-left">
                <span className="next-kicker">
                  <span className={`next-dot ${nextItem.type}`} />下一步 · 最優先
                </span>
                <span className="next-msg">{nextItem.message}</span>
              </span>
              <span className="next-cta">前往填寫 →</span>
            </button>
          )}

          {/* ===== 輪到誰:依責任方分組 ===== */}
          <div className="dash-parties">
            {['oem', 'sign'].map((p) => byParty[p].length > 0 && (
              <button type="button"
                key={p}
                className={`party-card ${filterParty === p ? 'active' : ''}`}
                onClick={() => { setFilterParty(filterParty === p ? null : p); setShowAll(true); }}
                title={`點擊篩選 ${PARTY_META[p].label} 的待辦`}
              >
                <span className="party-icon">{PARTY_META[p].icon}</span>
                <span className="party-text">
                  <span className="party-label">{PARTY_META[p].label}</span>
                  <span className="party-desc">{PARTY_META[p].desc}</span>
                </span>
                <span className="party-count">{byParty[p].length}</span>
              </button>
            ))}
          </div>

          {/* ===== 全部待辦(可收合) ===== */}
          <div className="dash-all glass-card">
            <button type="button" className="all-toggle" onClick={() => setShowAll((s) => !s)}>
              <span>
                全部待辦（{todos.length}）
                {filterParty && <span className="all-filter">· 篩選：{PARTY_META[filterParty].label}</span>}
              </span>
              <span className="all-chevron">{showAll ? '收合 ▲' : '展開 ▼'}</span>
            </button>
            {filterParty && (
              <button type="button" className="all-clear-filter" onClick={() => setFilterParty(null)}>清除篩選</button>
            )}
            {showAll && (
              <div className="all-list">
                {visibleTodos.map((w, i) => (
                  <div
                    key={`${w.type}-${i}`}
                    className={`todo-row ${w.type}`}
                    onClick={() => handleWarningClick(w)}
                    role="button"
                    tabIndex={0}
                    onKeyDown={(e) => { if (e.key === 'Enter') { handleWarningClick(w); } }}
                    title="點擊前往該填寫區塊"
                  >
                    <span className={`todo-tag ${w.type}`}>{w.type === 'error' ? '異常' : '警告'}</span>
                    <span className="todo-msg">{w.message}</span>
                    <span className="todo-arrow">→</span>
                  </div>
                ))}
              </div>
            )}
          </div>
        </>
      )}
    </div>
  );
}

Dashboard.propTypes = {
  data: PropTypes.object.isRequired,
  onGoToSection: PropTypes.func.isRequired,
  sectionStatus: PropTypes.object,
  currentUser: PropTypes.shape({
    role: PropTypes.string,
  }),
};



