import { useEffect, useRef } from 'react';
import PropTypes from 'prop-types';
import { uiIcons } from '../utils/svgIcons';
import './BottomSheet.css';

export default function BottomSheet({
  isOpen,
  onClose,
  title = '全部步驟',
  steps = [],
  activeTab,
  onSelectStep,
  alignmentRate = 0,
}) {
  const sheetRef = useRef(null);
  const previouslyFocusedElementRef = useRef(null);

  // Focus trap 與 ESC 鍵關閉
  useEffect(() => {
    if (!isOpen) return;
    previouslyFocusedElementRef.current = document.activeElement;

    const sheetNode = sheetRef.current;
    if (sheetNode) {
      const focusable = sheetNode.querySelectorAll(
        'button, [href], input, select, textarea, [tabindex]:not([tabindex="-1"])'
      );
      if (focusable.length > 0) {
        focusable[0].focus();
      }
    }

    const handleKeyDown = (e) => {
      if (e.key === 'Escape') {
        e.preventDefault();
        onClose();
        return;
      }
      if (e.key === 'Tab' && sheetNode) {
        const focusable = sheetNode.querySelectorAll(
          'button, [href], input, select, textarea, [tabindex]:not([tabindex="-1"])'
        );
        if (focusable.length === 0) return;
        const first = focusable[0];
        const last = focusable[focusable.length - 1];

        if (e.shiftKey) {
          if (document.activeElement === first) {
            e.preventDefault();
            last.focus();
          }
        } else {
          if (document.activeElement === last) {
            e.preventDefault();
            first.focus();
          }
        }
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => {
      window.removeEventListener('keydown', handleKeyDown);
      if (previouslyFocusedElementRef.current && previouslyFocusedElementRef.current.focus) {
        previouslyFocusedElementRef.current.focus();
      }
    };
  }, [isOpen, onClose]);

  if (!isOpen) return null;

  return (
    <div className="bottom-sheet-overlay" role="presentation">
      <button
        type="button"
        className="bottom-sheet-scrim"
        onClick={onClose}
        aria-label="關閉步驟清單"
      />
      <div
        className="bottom-sheet-panel animate-slide-up"
        ref={sheetRef}
        role="dialog"
        aria-modal="true"
        aria-label={title}
      >
        <div className="bottom-sheet-handle-bar">
          <div className="bottom-sheet-handle" aria-hidden="true" />
        </div>

        <div className="bottom-sheet-header">
          <div className="bottom-sheet-title">{title}</div>
          <button
            type="button"
            className="bottom-sheet-close-btn"
            onClick={onClose}
            aria-label="關閉步驟清單"
          >
            <uiIcons.close size={20} />
          </button>
        </div>

        <div className="bottom-sheet-body">
          {/* 儀表板選項 */}
          <button
            type="button"
            className={`bottom-sheet-row ${activeTab === 'dashboard' ? 'active' : ''}`}
            onClick={() => {
              onSelectStep('dashboard');
              onClose();
            }}
          >
            <span className="sheet-row-icon">
              <uiIcons.dashboard size={20} />
            </span>
            <span className="sheet-row-label">總覽儀表板</span>
            <span className={`sheet-row-badge ${alignmentRate === 100 ? 'ok' : ''}`}>
              {alignmentRate}%
            </span>
            <span className="sheet-row-chevron">
              <uiIcons.chevronRight size={18} />
            </span>
          </button>

          {/* 10 步驟選項 */}
          {steps.map((step, index) => {
            const isDone = step.state === 'done';
            const isNotApplicable = isDone && step.applicable === false;
            const stateLabel = isNotApplicable ? '不適用' : step.state === 'inProgress' ? '進行中' : isDone ? '完成' : '待確認';
            const isActive = activeTab === step.key;

            return (
              <button
                type="button"
                key={step.key}
                className={`bottom-sheet-row ${isActive ? 'active' : ''} ${step.state ? `status-${step.state}` : ''} ${isNotApplicable ? 'not-applicable' : ''}`}
                onClick={() => {
                  onSelectStep(step.key);
                  onClose();
                }}
              >
                <span className={`sheet-row-step-num ${isDone ? 'done' : ''} ${step.state === 'inProgress' ? 'in-progress' : ''} ${isNotApplicable ? 'not-applicable' : ''}`}>
                  {isNotApplicable ? '—' : isDone ? <uiIcons.check size={14} /> : index + 1}
                </span>
                <span className="sheet-row-label">
                  <span className="sheet-step-index">步驟 {index + 1} · </span>
                  {step.label}
                </span>
                <span className={`sheet-row-state ${step.state} ${isNotApplicable ? 'not-applicable' : ''}`}>
                  {stateLabel}
                </span>
                <span className="sheet-row-chevron">
                  <uiIcons.chevronRight size={18} />
                </span>
              </button>
            );
          })}
        </div>
      </div>
    </div>
  );
}

BottomSheet.propTypes = {
  isOpen: PropTypes.bool.isRequired,
  onClose: PropTypes.func.isRequired,
  title: PropTypes.string,
  steps: PropTypes.arrayOf(
    PropTypes.shape({
      key: PropTypes.string.isRequired,
      label: PropTypes.string.isRequired,
      state: PropTypes.string,
      applicable: PropTypes.bool,
    })
  ).isRequired,
  activeTab: PropTypes.string.isRequired,
  onSelectStep: PropTypes.func.isRequired,
  alignmentRate: PropTypes.number,
};
