import PropTypes from 'prop-types';
import { useFieldOwner } from '../hooks/useFieldOwner';
import { isFieldDisabled } from '../utils/fieldUtils';
import { getDocumentIcon } from '../utils/svgIcons';
import StepActionBar from './StepActionBar';
import './FormSections.css';

export default function DocumentsSection({ data, onChange, currentUser, onNext, onPrev }) {
  const { setField } = useFieldOwner(onChange, currentUser);

  return (
    <div className="section-form animate-fade-in">
      <h2 className="section-title">工程文件確認</h2>

      <div className="documents-grid" style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(280px, 1fr))', gap: '16px', marginTop: '20px' }}>
        {[
          ['bom', '材料清單 (BOM, Bill of Materials)', '主要電子零組件與電路板規格清單 (含廠牌/料號/封裝)'],
          ['gerber', 'Gerber / ODB++ / CAD 圖面', '電路板各層佈線、阻焊與鋼網製造必要檔案'],
          ['coordinate', 'SMT 元件座標檔 (Pick & Place)', '貼片機高速貼裝座標配置圖 (XY Centroid Coordinates)'],
          ['placement', '零件位置圖 (Placement / Assembly)', '用以核對零件方向與極性參考之裝配圖面'],
          ['materialSpec', '零組件規格書 (Datasheet / Spec)', '特殊敏感元件、連接器或客製機構之原廠規格書'],
          ['reflowProfile', '建議回焊溫度曲線 (Reflow Profile)', '零件耐熱極限與錫膏焊接建議之溫控曲線圖'],
          ['assemblyPackingSop', '組裝與包裝標準作業程序 (SOP)', '指導生產線作業人員進行組裝與防護包裝的標準程序'],
          ['testSop', '測試標準作業程序 (Testing SOP)', '定義測試工位、治具操作與軟硬體判定之標準作業']
        ].map(([key, label, desc]) => {
          const checked = data.basicInfo.documents?.[key] || false;
          return (
            <div key={key} className={`document-card glass-card ${checked ? 'checked-active' : ''}`} style={{ padding: '16px', display: 'flex', gap: '12px', alignItems: 'center', transition: 'all 0.25s' }}>
              <label className="checkbox-label" style={{ margin: 0, display: 'flex', gap: '14px', alignItems: 'center', cursor: 'pointer', flex: 1 }}>
                <input 
                  type="checkbox" 
                  checked={checked} 
                  onChange={(e) => setField(`basicInfo.documents.${key}`, e.target.checked)}
                  disabled={isFieldDisabled(data, currentUser, `basicInfo.documents.${key}`)}
                  style={{ width: '22px', height: '22px', minWidth: '22px', minHeight: '22px', accentColor: 'var(--c-accent, #2563eb)', cursor: 'pointer' }}
                />
                <div className="doc-icon-container">{getDocumentIcon(key)}</div>
                <div style={{ flex: 1 }}>
                  <span className="doc-label" style={{ fontWeight: 600, fontSize: '0.98rem' }}>{label}</span>
                  <p className="doc-desc" style={{ fontSize: '0.8rem', color: '#6b7280', marginTop: '4px', lineHeight: 1.4 }}>{desc}</p>
                </div>
              </label>
            </div>
          );
        })}
      </div>

      <StepActionBar
        onPrev={onPrev}
        onNext={onNext}
        nextLabel="下一步：簽章與匯出"
      />
    </div>
  );
}

DocumentsSection.propTypes = {
  data: PropTypes.object.isRequired,
  onChange: PropTypes.func.isRequired,
  currentUser: PropTypes.object,
  onNext: PropTypes.func.isRequired,
  onPrev: PropTypes.func,
};

