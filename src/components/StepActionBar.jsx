import { useState, useEffect } from 'react';
import PropTypes from 'prop-types';
import './StepActionBar.css';

export default function StepActionBar({
  onPrev,
  onNext,
  prevLabel = '上一步',
  nextLabel = '下一步',
  nextDisabled = false,
  extraActions = null,
  className = '',
}) {
  const [isKeyboardOpen, setIsKeyboardOpen] = useState(false);

  // 虛擬鍵盤避讓守衛：當 iOS/Android 虛擬鍵盤彈起 (visualViewport 縮小 > 150px) 時，
  // 將動作列由 sticky 切換為 static，防止遮擋目前正在聚焦的輸入框
  useEffect(() => {
    if (typeof window === 'undefined' || !window.visualViewport) return;
    const handleResize = () => {
      const vh = window.visualViewport.height;
      const ih = window.innerHeight;
      setIsKeyboardOpen(ih - vh > 150);
    };

    window.visualViewport.addEventListener('resize', handleResize);
    return () => {
      window.visualViewport.removeEventListener('resize', handleResize);
    };
  }, []);

  return (
    <div
      className={`step-action-bar ${isKeyboardOpen ? 'keyboard-open' : ''} ${className}`.trim()}
      role="region"
      aria-label="步驟導覽動作列"
    >
      <div className="step-action-bar-inner">
        {onPrev ? (
          <button
            type="button"
            className="btn btn-secondary step-btn-prev"
            onClick={onPrev}
          >
            {prevLabel}
          </button>
        ) : <div className="step-btn-placeholder" aria-hidden="true" />}

        {extraActions}

        {onNext && (
          <button
            type="button"
            className="btn btn-primary step-btn-next"
            onClick={onNext}
            disabled={nextDisabled}
          >
            {nextLabel}
          </button>
        )}
      </div>
    </div>
  );
}

StepActionBar.propTypes = {
  onPrev: PropTypes.func,
  onNext: PropTypes.func,
  prevLabel: PropTypes.node,
  nextLabel: PropTypes.node,
  nextDisabled: PropTypes.bool,
  extraActions: PropTypes.node,
  className: PropTypes.string,
};
