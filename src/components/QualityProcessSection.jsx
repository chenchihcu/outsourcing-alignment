import PropTypes from 'prop-types';
import { useFieldOwner } from '../hooks/useFieldOwner';
import { isFieldDisabled, getFieldHighlightClass } from '../utils/fieldUtils';
import { sectionSvg } from '../utils/svgIcons';
import StepActionBar from './StepActionBar';
import './FormSections.css';

export default function QualityProcessSection({ data, onChange, currentUser, highlightField, onNext, onPrev }) {
  const { setField } = useFieldOwner(onChange, currentUser);

  return (
    <div className="section-form animate-fade-in">
      <div className="form-section-card glass-card" data-accent="emerald">
        <div className="card-header"><span className="card-icon-circle">{sectionSvg.shield}</span>品質與驗收標準</div>
        <div className="card-body">
          <div className="form-row-grid-2">
            <fieldset className="form-group" style={{ border: 'none', padding: 0, margin: 0 }}>
              <legend className="form-label">品質水準要求</legend>
              <div className="checkbox-flex">
                <label className="checkbox-label">
                  <input type="checkbox" checked={data.basicInfo.qualityLevel?.class2 || false}
                    onChange={(e) => setField('basicInfo.qualityLevel', { ...(data.basicInfo.qualityLevel || {}), class2: e.target.checked })}
                    disabled={isFieldDisabled(data, currentUser, 'basicInfo.qualityLevel.class2')} />
                  <span>Class 2</span>
                </label>
                <label className="checkbox-label">
                  <input type="checkbox" checked={data.basicInfo.qualityLevel?.class3 || false}
                    onChange={(e) => setField('basicInfo.qualityLevel', { ...(data.basicInfo.qualityLevel || {}), class3: e.target.checked })}
                    disabled={isFieldDisabled(data, currentUser, 'basicInfo.qualityLevel.class3')} />
                  <span>Class 3</span>
                </label>
              </div>
            </fieldset>
            <fieldset className="form-group" style={{ border: 'none', padding: 0, margin: 0 }}>
              <legend className="form-label">IPC 驗收標準</legend>
              <div className="checkbox-flex">
                <label className="checkbox-label">
                  <input type="checkbox" checked={data.basicInfo.ipcStandard?.ipcA610 || false}
                    onChange={(e) => setField('basicInfo.ipcStandard', { ...(data.basicInfo.ipcStandard || {}), ipcA610: e.target.checked })}
                    disabled={isFieldDisabled(data, currentUser, 'basicInfo.ipcStandard.ipcA610')} />
                  <span>IPC-A-610</span>
                </label>
                <label className="checkbox-label">
                  <input type="checkbox" checked={data.basicInfo.ipcStandard?.jStd001 || false}
                    onChange={(e) => setField('basicInfo.ipcStandard', { ...(data.basicInfo.ipcStandard || {}), jStd001: e.target.checked })}
                    disabled={isFieldDisabled(data, currentUser, 'basicInfo.ipcStandard.jStd001')} />
                  <span>J-STD-001</span>
                </label>
              </div>
            </fieldset>
          </div>
        </div>
      </div>

      <div className="form-section-card glass-card" data-accent="amber">
        <div className="card-header"><span className="card-icon-circle">{sectionSvg.gear}</span>加工製程與管制需求</div>
        <div className="card-body">
          <div className="form-row-grid-3">
            <fieldset className="form-group" style={{ border: 'none', padding: 0, margin: 0 }}>
              <legend className="form-label">點膠工藝</legend>
              <div className="checkbox-flex"><label className="checkbox-label">
                <input type="checkbox" checked={data.basicInfo.glue || false} onChange={(e) => setField('basicInfo.glue', e.target.checked)}
                  disabled={isFieldDisabled(data, currentUser, 'basicInfo.glue')} /><span>需要點膠</span></label></div>
            </fieldset>
            <fieldset className="form-group" style={{ border: 'none', padding: 0, margin: 0 }}>
              <legend className="form-label">QR Code 掃描需求</legend>
              <div className="radio-group radio-group-compact">
                <label className="radio-label"><input type="radio" name="qrCodeScan" checked={data.basicInfo.qrCode?.need || false}
                  onChange={() => setField('basicInfo.qrCode', { need: true, noNeed: false })}
                  disabled={isFieldDisabled(data, currentUser, 'basicInfo.qrCode.need')} /><span>需要</span></label>
                <label className="radio-label"><input type="radio" name="qrCodeScan" checked={data.basicInfo.qrCode?.noNeed || false}
                  onChange={() => setField('basicInfo.qrCode', { need: false, noNeed: true })}
                  disabled={isFieldDisabled(data, currentUser, 'basicInfo.qrCode.noNeed')} /><span>不需要</span></label>
              </div>
            </fieldset>
            <fieldset className="form-group" style={{ border: 'none', padding: 0, margin: 0 }}>
              <legend className="form-label">序號管控需求</legend>
              <div className="radio-group radio-group-compact">
                <label className="radio-label"><input type="radio" name="snControlReq" checked={data.basicInfo.snControl?.need || false}
                  onChange={() => setField('basicInfo.snControl', { need: true, noNeed: false })}
                  disabled={isFieldDisabled(data, currentUser, 'basicInfo.snControl.need')} /><span>需要</span></label>
                <label className="radio-label"><input type="radio" name="snControlReq" checked={data.basicInfo.snControl?.noNeed || false}
                  onChange={() => setField('basicInfo.snControl', { need: false, noNeed: true })}
                  disabled={isFieldDisabled(data, currentUser, 'basicInfo.snControl.noNeed')} /><span>不需要</span></label>
              </div>
            </fieldset>
            <fieldset className={`form-group ${getFieldHighlightClass(highlightField, 'aoi')}`} style={{ border: 'none', padding: 0, margin: 0 }}>
              <legend className="form-label">AOI 檢驗面</legend>
              <div className="checkbox-flex">
                <label className="checkbox-label"><input type="checkbox" checked={data.basicInfo.aoi?.top || false}
                  onChange={(e) => setField('basicInfo.aoi', { ...(data.basicInfo.aoi || {}), top: e.target.checked })}
                  disabled={isFieldDisabled(data, currentUser, 'basicInfo.aoi.top')} /><span>Top (頂面)</span></label>
                <label className="checkbox-label"><input type="checkbox" checked={data.basicInfo.aoi?.bottom || false}
                  onChange={(e) => setField('basicInfo.aoi', { ...(data.basicInfo.aoi || {}), bottom: e.target.checked })}
                  disabled={isFieldDisabled(data, currentUser, 'basicInfo.aoi.bottom')} /><span>Bottom (底面)</span></label>
              </div>
            </fieldset>
          </div>
          <fieldset className={`form-group required-highlight ${getFieldHighlightClass(highlightField, 'processItems')}`} style={{ border: 'none', padding: 0, margin: 0 }}>
            <legend className="form-label">主要加工項目 <span className="req">*</span></legend>
            <div className="checkbox-flex" style={{ flexWrap: 'wrap', gap: '12px 18px', alignItems: 'center' }}>
              {[
                ['smt', 'SMT'], ['dip', 'DIP'], ['ict', 'In-Circuit Test'], ['assembly', '組裝'],
                ['coating', '三防膠塗覆'], ['packing', '包裝'], ['fct', 'FCT 功能測試'],
                ['flyingProbe', '飛針測試'], ['underfillGlue', 'Underfill 塗膠'],
                ['semiFinishedTest', '半成品測試'], ['finalTest', '成品測試'],
              ].map(([key, label]) => (
                <label key={key} className="checkbox-label">
                  <input type="checkbox" checked={data.basicInfo.processItems?.[key] || false}
                    onChange={(e) => setField(`basicInfo.processItems.${key}`, e.target.checked)}
                    disabled={isFieldDisabled(data, currentUser, `basicInfo.processItems.${key}`)} />
                  <span>{label}</span>
                </label>
              ))}
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                <label className="checkbox-label" style={{ margin: 0 }}>
                  <input type="checkbox" checked={data.basicInfo.processItems?.otherProcess || false}
                    onChange={(e) => {
                      setField('basicInfo.processItems.otherProcess', e.target.checked);
                      if (!e.target.checked) setField('basicInfo.processItems.otherProcessText', '');
                    }}
                    disabled={isFieldDisabled(data, currentUser, 'basicInfo.processItems.otherProcess')} />
                  <span>其他:</span>
                </label>
                <input type="text" className="form-input edit-active compact" placeholder="請說明其他加工項目" name="basicInfo.processItems.otherProcessText"
                  value={data.basicInfo.processItems?.otherProcessText || ''}
                  onChange={(e) => setField('basicInfo.processItems.otherProcessText', e.target.value)}
                  disabled={!data.basicInfo.processItems?.otherProcess || isFieldDisabled(data, currentUser, 'basicInfo.processItems.otherProcessText')}
                  style={{ width: '160px', maxWidth: '100%', padding: '4px 8px', fontSize: '0.82rem' }} />
              </div>
            </div>
          </fieldset>
        </div>
      </div>

      <StepActionBar
        onPrev={onPrev}
        onNext={onNext}
        nextLabel="下一步：鋼板與治工具"
      />
    </div>
  );
}

QualityProcessSection.propTypes = {
  data: PropTypes.object.isRequired,
  onChange: PropTypes.func.isRequired,
  currentUser: PropTypes.object,
  highlightField: PropTypes.string,
  onNext: PropTypes.func.isRequired,
  onPrev: PropTypes.func,
};
