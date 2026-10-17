import PropTypes from 'prop-types';

// No React import needed — JSX is handled by the framework transform
const svg = (path, viewBox = '0 0 24 24') => (
  <svg viewBox={viewBox} fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="section-svg">
    {path}
  </svg>
);

export const sectionSvg = {
  chip: svg(<><rect x="4" y="4" width="16" height="16" rx="2" /><path d="M9 9h6v6H9z" /><path d="M12 2v2M12 20v2M2 12h2M20 12h2" /></>),
  shield: svg(<><path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z" /><path d="M9 12l2 2 4-4" /></>),
  gear: svg(<><circle cx="12" cy="12" r="3" /><path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1 0 2.83 2 2 0 0 1-2.83 0l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-2 2 2 2 0 0 1-2-2v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83 0 2 2 0 0 1 0-2.83l.06-.06A1.65 1.65 0 0 0 4.68 15a1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1-2-2 2 2 0 0 1 2-2h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 0-2.83 2 2 0 0 1 2.83 0l.06.06A1.65 1.65 0 0 0 9 4.68a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 2-2 2 2 0 0 1 2 2v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 0 2 2 0 0 1 0 2.83l-.06.06A1.65 1.65 0 0 0 19.4 9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 2 2 2 2 0 0 1-2 2h-.09a1.65 1.65 0 0 0-1.51 1z" /></>),
  wrench: svg(<><path d="M14.7 6.3a1 1 0 0 0 0 1.4l1.6 1.6a1 1 0 0 0 1.4 0l3.77-3.77a6 6 0 0 1-7.94 7.94l-6.91 6.91a2.12 2.12 0 0 1-3-3l6.91-6.91a6 6 0 0 1 7.94-7.94l-3.76 3.76z" /></>),
  thermometer: svg(<><path d="M14 14.76V3.5a2.5 2.5 0 0 0-5 0v11.26a4.5 4.5 0 1 0 5 0z" /><circle cx="11.5" cy="18.5" r="2.5" /></>),
  microscope: svg(<><path d="M6 18h8" /><path d="M3 22h18" /><path d="M14 22a7 7 0 1 0 0-14h-1" /><path d="M9 14h2" /><path d="M9 12a1 1 0 0 1 0-2 1 1 0 0 0 0-2" /></>),
  search: svg(<><circle cx="11" cy="11" r="8" /><path d="M21 21l-4.3-4.3" /></>),
  chart: svg(<><line x1="18" y1="20" x2="18" y2="10" /><line x1="12" y1="20" x2="12" y2="4" /><line x1="6" y1="20" x2="6" y2="14" /></>),
  camera: svg(<><path d="M23 19a2 2 0 0 1-2 2H3a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h4l2-3h6l2 3h4a2 2 0 0 1 2 2z" /><circle cx="12" cy="13" r="4" /></>),
  printer: svg(<><polyline points="6 9 6 2 18 2 18 9" /><path d="M6 18H4a2 2 0 0 1-2-2v-5a2 2 0 0 1 2-2h16a2 2 0 0 1 2 2v5a2 2 0 0 1-2 2h-2" /><rect x="6" y="14" width="12" height="8" /></>),
  box: svg(<><path d="M21 16V8a2 2 0 0 0-1-1.73l-7-4a2 2 0 0 0-2 0l-7 4A2 2 0 0 0 3 8v8a2 2 0 0 0 1 1.73l7 4a2 2 0 0 0 2 0l7-4A2 2 0 0 0 21 16z" /><polyline points="3.27 6.96 12 12.01 20.73 6.96" /><line x1="12" y1="22.08" x2="12" y2="12" /></>),
  clipboard: svg(<><path d="M16 4h2a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2V6a2 2 0 0 1 2-2h2" /><rect x="8" y="2" width="8" height="4" rx="1" ry="1" /><path d="M9 14l2 2 4-4" /></>),
  layers: svg(<><polygon points="12 2 2 7 12 12 22 7 12 2" /><polyline points="2 17 12 22 22 17" /><polyline points="2 12 12 17 22 12" /></>),
};

const docProps = { className: "doc-svg", viewBox: "0 0 24 24", fill: "none", stroke: "currentColor", strokeWidth: "2", strokeLinecap: "round", strokeLinejoin: "round" };
const docSvg = (children) => <svg {...docProps}>{children}</svg>;

export const getDocumentIcon = (key) => {
  switch (key) {
    case 'bom': return docSvg(<><path d="M12 6h9M12 12h9M12 18h9M3 6h.01M3 12h.01M3 18h.01" strokeWidth="2.5" /></>);
    case 'gerber': return docSvg(<><path d="M12 2L2 7l10 5 10-5-10-5zM2 17l10 5 10-5M2 12l10 5 10-5" /></>);
    case 'coordinate': return docSvg(<><circle cx="12" cy="12" r="9" /><path d="M12 2v20M2 12h20" /></>);
    case 'placement': return docSvg(<><rect x="3" y="3" width="18" height="18" rx="2" /><rect x="7" y="7" width="10" height="10" rx="1" /><path d="M12 7v10M7 12h10" /></>);
    case 'materialSpec': return docSvg(<><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" /><polyline points="14 2 14 8 20 8" /><line x1="16" y1="13" x2="8" y2="13" /><line x1="16" y1="17" x2="8" y2="17" /><polyline points="10 9 9 9 8 9" /></>);
    case 'reflowProfile': return docSvg(<><path d="M3 20h18M3 17l4-4 4 4 6-10 3 3" /></>);
    case 'assemblyPackingSop': return docSvg(<><path d="M14.7 6.3a1 1 0 0 0 0 1.4l1.6 1.6a1 1 0 0 0 1.4 0l3.77-3.77a6 6 0 0 1-7.94 7.94l-6.91 6.91a2.12 2.12 0 0 1-3-3l6.91-6.91a6 6 0 0 1 7.94-7.94l-3.76 3.76z" /></>);
    case 'testSop': return docSvg(<><path d="M22 12h-4l-3 9L9 3l-3 9H2" /></>);
    default: return docSvg(<><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" /><polyline points="14 2 14 8 20 8" /></>);
  }
};

export const createSvgIcon = (children, viewBox = '0 0 24 24', defaultSize = 24) => {
  function SvgIcon({ size = defaultSize, className = '', style = {}, 'aria-hidden': ariaHidden = true, ...props }) {
    return (
      <svg
        viewBox={viewBox}
        width={size}
        height={size}
        fill="none"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
        className={`ui-icon ${className}`.trim()}
        style={{ flexShrink: 0, ...style }}
        aria-hidden={ariaHidden}
        {...props}
      >
        {children}
      </svg>
    );
  }

  SvgIcon.propTypes = {
    size: PropTypes.oneOfType([PropTypes.number, PropTypes.string]),
    className: PropTypes.string,
    style: PropTypes.object,
    'aria-hidden': PropTypes.oneOfType([PropTypes.bool, PropTypes.string]),
  };

  return SvgIcon;
};

export const uiIcons = {
  chevronLeft: createSvgIcon(<polyline points="15 18 9 12 15 6" />),
  chevronRight: createSvgIcon(<polyline points="9 18 15 12 9 6" />),
  chevronDown: createSvgIcon(<polyline points="6 9 12 15 18 9" />),
  check: createSvgIcon(<polyline points="20 6 9 17 4 12" />),
  spinner: createSvgIcon(
    <>
      <line x1="12" y1="2" x2="12" y2="6" />
      <line x1="12" y1="18" x2="12" y2="22" />
      <line x1="4.93" y1="4.93" x2="7.76" y2="7.76" />
      <line x1="16.24" y1="16.24" x2="19.07" y2="19.07" />
      <line x1="2" y1="12" x2="6" y2="12" />
      <line x1="18" y1="12" x2="22" y2="12" />
      <line x1="4.93" y1="19.07" x2="7.76" y2="16.24" />
      <line x1="16.24" y1="7.76" x2="19.07" y2="4.93" />
    </>
  ),
  plus: createSvgIcon(
    <>
      <line x1="12" y1="5" x2="12" y2="19" />
      <line x1="5" y1="12" x2="19" y2="12" />
    </>
  ),
  dots: createSvgIcon(
    <>
      <circle cx="12" cy="12" r="1.5" />
      <circle cx="19" cy="12" r="1.5" />
      <circle cx="5" cy="12" r="1.5" />
    </>
  ),
  folder: createSvgIcon(
    <>
      <path d="M22 19a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h5l2 3h9a2 2 0 0 1 2 2z" />
    </>
  ),
  dashboard: createSvgIcon(
    <>
      <line x1="18" y1="20" x2="18" y2="10" />
      <line x1="12" y1="20" x2="12" y2="4" />
      <line x1="6" y1="20" x2="6" y2="14" />
    </>
  ),
  workflow: createSvgIcon(
    <>
      <circle cx="12" cy="12" r="3" />
      <path d="M12 3v6M12 15v6M3 12h6M15 12h6" />
    </>
  ),
  todo: createSvgIcon(
    <>
      <path d="M16 4h2a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2V6a2 2 0 0 1 2-2h2" />
      <rect x="8" y="2" width="8" height="4" rx="1" ry="1" />
      <polyline points="9 13 11 15 15 11" />
    </>
  ),
  account: createSvgIcon(
    <>
      <path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2" />
      <circle cx="12" cy="7" r="4" />
    </>
  ),
  settings: createSvgIcon(
    <>
      <circle cx="12" cy="12" r="3" />
      <path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1-2.83 2.83l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-2 2 2 2 0 0 1-2-2v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83-2.83l.06-.06A1.65 1.65 0 0 0 4.68 15a1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1-2-2 2 2 0 0 1 2-2h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 2.83-2.83l.06.06A1.65 1.65 0 0 0 9 4.68a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 2-2 2 2 0 0 1 2 2v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 2.83l-.06.06A1.65 1.65 0 0 0 19.4 9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 2 2 2 2 0 0 1-2 2h-.09a1.65 1.65 0 0 0-1.51 1z" />
    </>
  ),
  trash: createSvgIcon(
    <>
      <polyline points="3 6 5 6 21 6" />
      <path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2" />
    </>
  ),
  importExcel: createSvgIcon(
    <>
      <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
      <polyline points="7 10 12 15 17 10" />
      <line x1="12" y1="15" x2="12" y2="3" />
    </>
  ),
  search: createSvgIcon(
    <>
      <circle cx="11" cy="11" r="8" />
      <line x1="21" y1="21" x2="16.65" y2="16.65" />
    </>
  ),
  close: createSvgIcon(
    <>
      <line x1="18" y1="6" x2="6" y2="18" />
      <line x1="6" y1="6" x2="18" y2="18" />
    </>
  ),
  logout: createSvgIcon(
    <>
      <path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4" />
      <polyline points="16 17 21 12 16 7" />
      <line x1="21" y1="12" x2="9" y2="12" />
    </>
  ),
};

/* 專業製程與治工具微型圖示 (16x16 向量微圖示，供表單選單標籤辨識) */
export const processMicroIcons = {
  smt: createSvgIcon(
    <>
      <rect x="4" y="4" width="16" height="16" rx="2" />
      <rect x="9" y="9" width="6" height="6" />
      <line x1="9" y1="1" x2="9" y2="4" />
      <line x1="15" y1="1" x2="15" y2="4" />
      <line x1="9" y1="20" x2="9" y2="23" />
      <line x1="15" y1="20" x2="15" y2="23" />
      <line x1="20" y1="9" x2="23" y2="9" />
      <line x1="20" y1="15" x2="23" y2="15" />
      <line x1="1" y1="9" x2="4" y2="9" />
      <line x1="1" y1="15" x2="4" y2="15" />
    </>,
    '0 0 24 24',
    16
  ),
  dip: createSvgIcon(
    <>
      <rect x="6" y="3" width="12" height="18" rx="2" />
      <circle cx="12" cy="5" r="1" />
      <line x1="2" y1="7" x2="6" y2="7" />
      <line x1="2" y1="12" x2="6" y2="12" />
      <line x1="2" y1="17" x2="6" y2="17" />
      <line x1="18" y1="7" x2="22" y2="7" />
      <line x1="18" y1="12" x2="22" y2="12" />
      <line x1="18" y1="17" x2="22" y2="17" />
    </>,
    '0 0 24 24',
    16
  ),
  ict: createSvgIcon(
    <>
      <circle cx="6" cy="18" r="2" />
      <circle cx="18" cy="18" r="2" />
      <circle cx="12" cy="18" r="2" />
      <path d="M6 16V6l6 6 6-6v10" />
      <line x1="4" y1="22" x2="20" y2="22" />
    </>,
    '0 0 24 24',
    16
  ),
  fct: createSvgIcon(
    <>
      <polyline points="22 12 18 12 15 21 9 3 6 12 2 12" />
    </>,
    '0 0 24 24',
    16
  ),
  flyingProbe: createSvgIcon(
    <>
      <line x1="4" y1="4" x2="11" y2="11" />
      <line x1="20" y1="4" x2="13" y2="11" />
      <circle cx="12" cy="15" r="2" />
      <line x1="12" y1="17" x2="12" y2="21" />
    </>,
    '0 0 24 24',
    16
  ),
  coating: createSvgIcon(
    <>
      <path d="M12 2.69l5.66 5.66a8 8 0 1 1-11.31 0z" />
    </>,
    '0 0 24 24',
    16
  ),
  underfill: createSvgIcon(
    <>
      <path d="m14 12-8.5 8.5a2.12 2.12 0 1 1-3-3L11 9" />
      <path d="M18 16a3 3 0 0 0 3-3V6l-3-3H9v3" />
      <circle cx="19" cy="19" r="2" />
    </>,
    '0 0 24 24',
    16
  ),
  assembly: createSvgIcon(
    <>
      <path d="M14.7 6.3a1 1 0 0 0 0 1.4l1.6 1.6a1 1 0 0 0 1.4 0l3.77-3.77a6 6 0 0 1-7.94 7.94l-6.91 6.91a2.12 2.12 0 0 1-3-3l6.91-6.91a6 6 0 0 1 7.94-7.94l-3.76 3.76z" />
    </>,
    '0 0 24 24',
    16
  ),
  packing: createSvgIcon(
    <>
      <path d="M21 16V8a2 2 0 0 0-1-1.73l-7-4a2 2 0 0 0-2 0l-7 4A2 2 0 0 0 3 8v8a2 2 0 0 0 1 1.73l7 4a2 2 0 0 0 2 0l7-4A2 2 0 0 0 21 16z" />
      <polyline points="3.27 6.96 12 12.01 20.73 6.96" />
      <line x1="12" y1="22.08" x2="12" y2="12" />
    </>,
    '0 0 24 24',
    16
  ),
  tray: createSvgIcon(
    <>
      <rect x="2" y="4" width="20" height="16" rx="2" />
      <line x1="2" y1="10" x2="22" y2="10" />
      <line x1="2" y1="16" x2="22" y2="16" />
      <line x1="8" y1="4" x2="8" y2="20" />
      <line x1="16" y1="4" x2="16" y2="20" />
    </>,
    '0 0 24 24',
    16
  ),
  stencil: createSvgIcon(
    <>
      <rect x="3" y="3" width="18" height="18" rx="2" />
      <rect x="7" y="7" width="3" height="3" />
      <rect x="14" y="7" width="3" height="3" />
      <rect x="7" y="14" width="3" height="3" />
      <rect x="14" y="14" width="3" height="3" />
    </>,
    '0 0 24 24',
    16
  ),
  router: createSvgIcon(
    <>
      <circle cx="6" cy="6" r="3" />
      <circle cx="6" cy="18" r="3" />
      <line x1="20" y1="4" x2="8.12" y2="15.88" />
      <line x1="14.47" y1="14.48" x2="20" y2="20" />
      <line x1="8.12" y1="8.12" x2="12" y2="12" />
    </>,
    '0 0 24 24',
    16
  ),
  board: createSvgIcon(
    <>
      <rect x="3" y="3" width="18" height="18" rx="2" />
      <circle cx="7" cy="7" r="1.5" />
      <circle cx="17" cy="7" r="1.5" />
      <circle cx="7" cy="17" r="1.5" />
      <circle cx="17" cy="17" r="1.5" />
      <path d="M7 8.5v7M17 8.5v7M8.5 7h7M8.5 17h7" />
    </>,
    '0 0 24 24',
    16
  ),
  sparkle: createSvgIcon(
    <>
      <polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2" />
    </>,
    '0 0 24 24',
    16
  ),
};

