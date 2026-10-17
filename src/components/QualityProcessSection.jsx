import PropTypes from 'prop-types';
import { useFieldOwner } from '../hooks/useFieldOwner';
import { isFieldDisabled, getFieldHighlightClass } from '../utils/fieldUtils';
import { sectionSvg, processMicroIcons } from '../utils/svgIcons';
import StepActionBar from './StepActionBar';
import './FormSections.css';

export default function QualityProcessSection({ data, onChange, currentUser, highlightField, onNext, onPrev }) {
  const { setField } = useFieldOwner(onChange, currentUser);

  const processItemDefs = [
    { key: 'smt', label: 'SMT (表面黏著)', icon: processMicroIcons.smt },
    { key: 'dip', label: 'DIP (通孔插裝)', icon: processMicroIcons.dip },
    { key: 'ict', label: 'ICT (電路在線測試)', icon: processMicroIcons.ict },
    { key: 'assembly', label: '組裝 (成品組裝)', icon: processMicroIcons.assembly },
    { key: 'coating', label: 'Conformal Coating (三防漆塗覆)', icon: processMicroIcons.coating },
    { key: 'packing', label: '包裝 (成品包裝)', icon: processMicroIcons.packing },
    { key: 'fct', label: 'FCT (功能測試)', icon: processMicroIcons.fct },
    { key: 'flyingProbe', label: 'FPT (飛針測試)', icon: processMicroIcons.flyingProbe },
    { key: 'underfillGlue', label: 'Underfill (底部填膠)', icon: processMicroIcons.underfill },
    { key: 'semiFinishedTest', label: '半成品測試', icon: processMicroIcons.fct },
    { key: 'finalTest', label: '成品測試', icon: processMicroIcons.fct },
  ];

  return (
    <div className="section-form animate-fade-in">
      <div className="form-section-card glass-card" data-accent="emerald">
        <div className="card-header"><span className="card-icon-circle">{sectionSvg.shield}</span>品質水準與驗收標準 (IPC Quality Standards)</div>
        <div className="card-body">
          <div className="form-row-grid-2">
            <fieldset className="form-group" style={{ border: 'none', padding: 0, margin: 0 }}>
              <legend className="form-label">品質水準要求 (IPC Class)</legend>
              <div className="checkbox-flex">
                <label className="checkbox-label">
                  <input type="checkbox" checked={data.basicInfo.qualityLevel?.class2 || false}
                    onChange={(e) => setField('basicInfo.qualityLevel', { ...(data.basicInfo.qualityLevel || {}), class2: e.target.checked })}
                    disabled={isFieldDisabled(data, currentUser, 'basicInfo.qualityLevel.class2')} />
                  <span>IPC Class 2 (工規服務級)</span>
                </label>
                <label className="checkbox-label">
                  <input type="checkbox" checked={data.basicInfo.qualityLevel?.class3 || false}
                    onChange={(e) => setField('basicInfo.qualityLevel', { ...(data.basicInfo.qualityLevel || {}), class3: e.target.checked })}
                    disabled={isFieldDisabled(data, currentUser, 'basicInfo.qualityLevel.class3')} />
                  <span>IPC Class 3 (高信賴性醫療/車載級)</span>
                </label>
              </div>
            </fieldset>
            <fieldset className="form-group" style={{ border: 'none', padding: 0, margin: 0 }}>
              <legend className="form-label">IPC 允收規範</legend>
              <div className="checkbox-flex">
                <label className="checkbox-label">
                  <input type="checkbox" checked={data.basicInfo.ipcStandard?.ipcA610 || false}
                    onChange={(e) => setField('basicInfo.ipcStandard', { ...(data.basicInfo.ipcStandard || {}), ipcA610: e.target.checked })}
                    disabled={isFieldDisabled(data, currentUser, 'basicInfo.ipcStandard.ipcA610')} />
                  <span>IPC-A-610 (電子組件允收)</span>
                </label>
                <label className="checkbox-label">
                  <input type="checkbox" checked={data.basicInfo.ipcStandard?.jStd001 || false}
                    onChange={(e) => setField('basicInfo.ipcStandard', { ...(data.basicInfo.ipcStandard || {}), jStd001: e.target.checked })}
                    disabled={isFieldDisabled(data, currentUser, 'basicInfo.ipcStandard.jStd001')} />
                  <span>J-STD-001 (焊接電氣標準)</span>
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
                  disabled={isFieldDisabled(data, currentUser, 'basicInfo.glue')} />
                <span className="item-micro-icon">{processMicroIcons.underfill({ size: 14 })}</span>
                <span>SMD 結構點膠固定</span>
              </label></div>
            </fieldset>
            <fieldset className="form-group" style={{ border: 'none', padding: 0, margin: 0 }}>
              <legend className="form-label">二維條碼 / QR Code 掃描</legend>
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
              <legend className="form-label">單板生產序號管控</legend>
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
                  disabled={isFieldDisabled(data, currentUser, 'basicInfo.aoi.top')} /><span>Top (正面/頂面)</span></label>
                <label className="checkbox-label"><input type="checkbox" checked={data.basicInfo.aoi?.bottom || false}
                  onChange={(e) => setField('basicInfo.aoi', { ...(data.basicInfo.aoi || {}), bottom: e.target.checked })}
                  disabled={isFieldDisabled(data, currentUser, 'basicInfo.aoi.bottom')} /><span>Bottom (背面/底面)</span></label>
              </div>
            </fieldset>
          </div>
          <fieldset className={`form-group required-highlight ${getFieldHighlightClass(highlightField, 'processItems')}`} style={{ border: 'none', padding: 0, margin: 0 }}>
            <legend className="form-label">主要加工項目 <span className="req">*</span></legend>
            <div className="checkbox-flex" style={{ flexWrap: 'wrap', gap: '12px 18px', alignItems: 'center' }}>
              {processItemDefs.map(({ key, label, icon: IconComponent }) => (
                <label key={key} className="checkbox-label">
                  <input type="checkbox" checked={data.basicInfo.processItems?.[key] || false}
                    onChange={(e) => setField(`basicInfo.processItems.${key}`, e.target.checked)}
                    disabled={isFieldDisabled(data, currentUser, `basicInfo.processItems.${key}`)} />
                  <span className="item-micro-icon">{IconComponent({ size: 14 })}</span>
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
                  style={{ width: '160px', maxWidth: '100%', padding: '4px 8px', fontSize: 'var(--fs-footnote)' }} />
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
