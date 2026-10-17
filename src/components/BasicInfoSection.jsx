import PropTypes from 'prop-types';
import { useFieldOwner } from '../hooks/useFieldOwner';
import { isFieldDisabled, getFieldHighlightClass } from '../utils/fieldUtils';
import { sectionSvg } from '../utils/svgIcons';
import StepActionBar from './StepActionBar';
import './FormSections.css';

export default function BasicInfoSection({ data, onChange, currentUser, factories, highlightField, onNext, onPrev }) {
  const { setField } = useFieldOwner(onChange, currentUser);

  return (
    <div className="section-form animate-fade-in">
      <div className="form-section-card glass-card" data-accent="indigo">
        <div className="card-header"><span className="card-icon-circle">{sectionSvg.chip}</span>機種基本資訊</div>
        <div className="card-body">
          <div className="form-row-grid-3">
            <div className={`form-group required-highlight ${getFieldHighlightClass(highlightField, 'factory')}`}>
              <label htmlFor="basicInfo-factory" className="form-label">委外加工廠 <span className="req">*</span></label>
              <select id="basicInfo-factory" className="form-input edit-active" value={data.basicInfo.factory || ''}
                onChange={(e) => setField('basicInfo.factory', e.target.value)}
                disabled={isFieldDisabled(data, currentUser, 'basicInfo.factory')}>
                <option value="">-- 請選擇委外加工廠 --</option>
                {(() => {
                  const currentFac = data.basicInfo.factory;
                  const list = [...factories];
                  if (currentFac && !list.includes(currentFac)) list.unshift(currentFac);
                  return list.map((fac) => <option key={fac} value={fac}>{fac}</option>);
                })()}
              </select>
            </div>
            <div className={`form-group required-highlight ${getFieldHighlightClass(highlightField, 'productNo')}`}>
              <label htmlFor="basicInfo-productNo" className="form-label">產品料號 <span className="req">*</span></label>
              <input id="basicInfo-productNo" type="text" className="form-input edit-active" placeholder="請輸入產品料號" name="basicInfo.productNo" value={data.basicInfo.productNo || ''}
                onChange={(e) => setField('basicInfo.productNo', e.target.value)}
                disabled={isFieldDisabled(data, currentUser, 'basicInfo.productNo')} />
            </div>
            <div className={`form-group required-highlight ${getFieldHighlightClass(highlightField, 'productDesc')}`}>
              <label htmlFor="basicInfo-productDesc" className="form-label">產品名稱 / 描述 <span className="req">*</span></label>
              <input id="basicInfo-productDesc" type="text" className="form-input edit-active" placeholder="請輸入產品名稱 / 描述" name="basicInfo.productDesc" value={data.basicInfo.productDesc || ''}
                onChange={(e) => setField('basicInfo.productDesc', e.target.value)}
                disabled={isFieldDisabled(data, currentUser, 'basicInfo.productDesc')} />
            </div>
          </div>
          <div className="form-row-grid-2">
            <fieldset className={`form-group required-highlight ${getFieldHighlightClass(highlightField, 'stage')}`} style={{ border: 'none', padding: 0, margin: 0 }}>
              <legend className="form-label">產品階段 (NPI Stage) <span className="req">*</span></legend>
              <div className="checkbox-flex">
                {Object.keys(data.basicInfo.stage || {}).filter((key) => key !== 'ecn').map((key) => {
                  const stageLabels = {
                    evt: 'EVT (工程驗證)',
                    dvt: 'DVT (設計驗證)',
                    pvt: 'PVT (生產驗證)',
                    politRun: '試產 (Pilot Run)',
                    mp: 'MP (量產)'
                  };
                  return (
                    <label key={key} className="checkbox-label">
                      <input type="checkbox" checked={data.basicInfo.stage[key] || false}
                        onChange={(e) => setField(`basicInfo.stage.${key}`, e.target.checked)}
                        disabled={isFieldDisabled(data, currentUser, `basicInfo.stage.${key}`)} />
                      <span>{stageLabels[key] || key.toUpperCase()}</span>
                    </label>
                  );
                })}
                {!Object.keys(data.basicInfo.stage || {}).includes('mp') && (
                  <label key="mp" className="checkbox-label">
                    <input type="checkbox" checked={data.basicInfo.stage?.mp || false}
                      onChange={(e) => setField('basicInfo.stage.mp', e.target.checked)}
                      disabled={isFieldDisabled(data, currentUser, 'basicInfo.stage.mp')} />
                    <span>MP (量產)</span>
                  </label>
                )}
              </div>
            </fieldset>
            <fieldset className={`form-group required-highlight ${getFieldHighlightClass(highlightField, 'ecnChange')}`} style={{ border: 'none', padding: 0, margin: 0 }}>
              <legend className="form-label">工程變更 (ECN 改版) <span className="req">*</span></legend>
              <div className="radio-group">
                <label className="radio-label">
                  <input type="radio" name="ecnChange" checked={data.basicInfo.ecnChange?.has || false}
                    onChange={() => setField('basicInfo.ecnChange', { ...(data.basicInfo.ecnChange || {}), has: true, no: false })}
                    disabled={isFieldDisabled(data, currentUser, 'basicInfo.ecnChange.has')} />
                  <span>有 (ECN 變更)</span>
                </label>
                <label className="radio-label">
                  <input type="radio" name="ecnChange" checked={data.basicInfo.ecnChange?.no || false}
                    onChange={() => setField('basicInfo.ecnChange', { has: false, no: true, verificationItem: '' })}
                    disabled={isFieldDisabled(data, currentUser, 'basicInfo.ecnChange.no')} />
                  <span>無 / 否</span>
                </label>
              </div>
              {data.basicInfo.ecnChange?.has && (
                <input type="text" className="form-input edit-active animate-fade-in" placeholder="請填寫驗證項目" name="basicInfo.ecnChange.verificationItem" value={data.basicInfo.ecnChange?.verificationItem || ''}
                  onChange={(e) => setField('basicInfo.ecnChange.verificationItem', e.target.value)}
                  disabled={isFieldDisabled(data, currentUser, 'basicInfo.ecnChange.verificationItem')}
                  style={{ marginTop: '10px' }} />
              )}
            </fieldset>
          </div>
        </div>
      </div>

      <StepActionBar
        onPrev={onPrev}
        onNext={onNext}
        nextLabel="下一步：品質與加工需求"
      />
    </div>
  );
}

BasicInfoSection.propTypes = {
  data: PropTypes.object.isRequired,
  onChange: PropTypes.func.isRequired,
  currentUser: PropTypes.object,
  factories: PropTypes.arrayOf(PropTypes.string).isRequired,
  highlightField: PropTypes.string,
  onNext: PropTypes.func.isRequired,
  onPrev: PropTypes.func,
};
