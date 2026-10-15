import PropTypes from 'prop-types';
import { useFieldOwner } from '../hooks/useFieldOwner';
import { isFieldDisabled } from '../utils/fieldUtils';
import { getDocumentIcon } from '../utils/svgIcons';
import './FormSections.css';

export default function DocumentsSection({ data, onChange, currentUser, onNext }) {
  const { setField } = useFieldOwner(onChange, currentUser);

  return (
    <div className="section-form animate-fade-in">
      <h2 className="section-title">工程文件確認</h2>

      <div className="documents-grid" style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(280px, 1fr))', gap: '16px', marginTop: '20px' }}>
        {[
          ['bom', '材料清單 BOM', '主要電子零組件與電路板規格清單'],
          ['gerber', 'Gerber file / CAD', '電路板佈線與鋼網製造必要檔案'],
          ['coordinate', '元件座標檔', 'SMT 貼片機高速貼裝座標配置圖'],
          ['placement', '零件位置圖 (Placement)', '用以核對零件方向與極性參考圖面'],
          ['materialSpec', '原物料規格書', '特殊零件或連接器等規格說明書'],
          ['reflowProfile', 'Reflow 建議曲線圖', '零件耐熱極限與錫膏焊接建議溫度控制曲線'],
          ['assemblyPackingSop', '組裝(包裝)作業標準書 (SOP)', '指導生產線作業人員進行組裝與包裝的標準程序'],
          ['testSop', '測試作業標準書 (SOP)', '定義測試工位與測試軟硬體的標準操作']
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

      <div className="action-row" style={{ marginTop: '24px' }}>
        <button type="button" className="btn btn-primary" onClick={onNext}>下一步：簽章與匯出</button>
      </div>
    </div>
  );
}

DocumentsSection.propTypes = {
  data: PropTypes.object.isRequired,
  onChange: PropTypes.func.isRequired,
  currentUser: PropTypes.object,
  onNext: PropTypes.func.isRequired,
};

