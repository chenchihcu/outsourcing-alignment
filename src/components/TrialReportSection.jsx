import PropTypes from 'prop-types';
import { useFieldOwner } from '../hooks/useFieldOwner';
import { isFieldDisabled, getFieldHighlightClass } from '../utils/fieldUtils';
import { sectionSvg } from '../utils/svgIcons';
import StepActionBar from './StepActionBar';
import './FormSections.css';

function cleanXrayPart(part) {
  const value = String(part || '').trim();
  return /_{2,}/.test(value) ? '' : value;
}

export function formatTrialReportDisplayName(name) {
  if (!name) return '';
  const str = String(name);
  if (str === '錫膏檢查紀錄表') return '錫膏印刷日常檢查表 (Printing Log)';
  if (str.includes('PCB 板彎/翹曲')) return 'PCB 板彎與板翹檢驗紀錄 (Bow & Twist / IPC-TM-650)';
  if (str === '迴焊爐溫記錄') return '回焊溫度曲線量測紀錄 (Reflow Thermal Profile)';
  if (str === '錫膏厚度測試紀錄') return '錫膏厚度 / SPI 測試紀錄 (Solder Paste Thickness / SPI)';
  if (str.includes('X-Ray')) return str.replace('X-Ray 照片', 'BGA / QFN 封裝 X-Ray 檢驗照片');
  return str;
}

export default function TrialReportSection({ data, onChange, currentUser, highlightField, onNext, onPrev }) {
  const { setField } = useFieldOwner(onChange, currentUser);

  const handleRecordChange = (category, index, field, val) => {
    setField(`trialReport.${category}.${index}.${field}`, val);
  };

  const handleXrayPartChange = (recIdx, partIdx, val) => {
    setField(`trialReport.photoRecords.${recIdx}.parts.${partIdx}`, val);
  };

  const printRecords = Array.isArray(data.trialReport?.printRecords) ? data.trialReport.printRecords : [];
  const inspectRecords = Array.isArray(data.trialReport?.inspectRecords) ? data.trialReport.inspectRecords : [];
  const photoRecords = Array.isArray(data.trialReport?.photoRecords) ? data.trialReport.photoRecords : [];

  return (
    <div className={`section-form animate-fade-in ${getFieldHighlightClass(highlightField, 'trialReport')}`}>
      <h2 className="section-title">試產交付確認</h2>
      <h3 className="sub-section-title"><span className="card-icon-circle card-icon-sm">{sectionSvg.clipboard}</span>試產交付文件、檢驗紀錄與照片清單</h3>

      <div className="record-list-section">
        <h4 className="list-group-title" data-accent="blue"><span className="card-icon-circle card-icon-xs">{sectionSvg.printer}</span>A. 印刷品質 / 迴焊紀錄</h4>
        <div className="records-grid">
          {printRecords.map((rec, idx) => (
            <div key={rec.id} className="record-row edit-active" style={{ margin: 0 }}>
              <label className="checkbox-label flex-1">
                <input type="checkbox" checked={rec.checked || false}
                  onChange={(e) => handleRecordChange('printRecords', idx, 'checked', e.target.checked)}
                  disabled={isFieldDisabled(data, currentUser, `trialReport.printRecords.${idx}.checked`)} />
                <span className="record-name">{formatTrialReportDisplayName(rec.name)}</span>
              </label>
            </div>
          ))}
        </div>
      </div>

      <div className="record-list-section">
        <h4 className="list-group-title" data-accent="purple"><span className="card-icon-circle card-icon-xs">{sectionSvg.search}</span>B. 檢驗紀錄 (Inspection Reports)</h4>
        <div className="records-grid">
          {inspectRecords.map((rec, idx) => (
            <div key={rec.id} className="record-row edit-active" style={{ margin: 0 }}>
              <label className="checkbox-label flex-1">
                <input type="checkbox" checked={rec.checked || false}
                  onChange={(e) => handleRecordChange('inspectRecords', idx, 'checked', e.target.checked)}
                  disabled={isFieldDisabled(data, currentUser, `trialReport.inspectRecords.${idx}.checked`)} />
                <span className="record-name">{formatTrialReportDisplayName(rec.name)}</span>
              </label>
            </div>
          ))}
        </div>
      </div>

      <div className="record-list-section">
        <h4 className="list-group-title" data-accent="emerald"><span className="card-icon-circle card-icon-xs">{sectionSvg.chart}</span>C. SMT 生產良率與 DFM 分析報告 (Trial Run Yield & DFM Report)</h4>
        <div className="records-grid">
          <div className="record-row edit-active" style={{ margin: 0 }}>
            <label className="checkbox-label flex-1">
              <input type="checkbox" checked={data.trialReport?.yieldReport?.ready || false}
                onChange={(e) => setField('trialReport.yieldReport.ready', e.target.checked)}
                disabled={isFieldDisabled(data, currentUser, 'trialReport.yieldReport.ready')} />
              <span className="record-name">SMT 良率與 DFM 分析報告已備妥</span>
            </label>
          </div>
        </div>
      </div>

      <div className="record-list-section">
        <h4 className="list-group-title" data-accent="pink"><span className="card-icon-circle card-icon-xs">{sectionSvg.camera}</span>D. 外觀與 X-Ray 檢驗照片 (Visual & X-Ray Photos)</h4>
        <div className="records-grid">
          {photoRecords.map((rec, idx) => (
            <div key={rec.id} className="record-row edit-active" style={{ display: 'flex', flexDirection: 'column', gap: '8px', alignItems: 'flex-start', margin: 0 }}>
              <label className="checkbox-label flex-1" style={{ display: 'flex', alignItems: 'center', gap: '8px', width: '100%' }}>
                <input type="checkbox" checked={rec.checked || false}
                  onChange={(e) => handleRecordChange('photoRecords', idx, 'checked', e.target.checked)}
                  disabled={isFieldDisabled(data, currentUser, `trialReport.photoRecords.${idx}.checked`)} />
                <span className="record-name">
                  {rec.isXray ? String(formatTrialReportDisplayName(rec.name)).split(/指定零件/)[0] + '指定零件:' : formatTrialReportDisplayName(rec.name)}
                </span>
              </label>
              {rec.isXray && (
                <div className="xray-parts-inputs animate-fade-in" style={{ display: 'flex', gap: '8px', marginLeft: '24px', flexWrap: 'wrap', alignItems: 'center' }}>
                  {[0, 1, 2, 3].map((pIdx) => (
                    <div key={pIdx} style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
                      <span style={{ fontSize: '0.8rem', color: '#6b7280' }}>{pIdx + 1}:</span>
                      <input type="text" className="form-input edit-active compact" placeholder={pIdx === 0 ? '預設空白' : `U${pIdx + 1}`} name={`xrayPart_${idx}_${pIdx}`}
                        value={cleanXrayPart(rec.parts?.[pIdx])}
                        onChange={(e) => handleXrayPartChange(idx, pIdx, e.target.value)}
                        disabled={isFieldDisabled(data, currentUser, `trialReport.photoRecords.${idx}.parts.${pIdx}`)}
                        style={{ width: '70px', padding: '2px 4px', fontSize: '0.8rem' }} />
                    </div>
                  ))}
                </div>
              )}
            </div>
          ))}
        </div>
      </div>

      <StepActionBar
        onPrev={onPrev}
        onNext={onNext}
        nextLabel="下一步：工程文件確認"
      />
    </div>
  );
}

TrialReportSection.propTypes = {
  data: PropTypes.object.isRequired,
  onChange: PropTypes.func.isRequired,
  currentUser: PropTypes.object,
  highlightField: PropTypes.string,
  onNext: PropTypes.func.isRequired,
  onPrev: PropTypes.func,
};


