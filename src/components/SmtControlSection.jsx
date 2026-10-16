import PropTypes from 'prop-types';
import { useFieldOwner } from '../hooks/useFieldOwner';
import { isFieldDisabled, getFieldHighlightClass } from '../utils/fieldUtils';
import { sectionSvg } from '../utils/svgIcons';
import StepActionBar from './StepActionBar';
import './FormSections.css';

export default function SmtControlSection({ data, onChange, currentUser, highlightField, onNext, onPrev }) {
  const { setField } = useFieldOwner(onChange, currentUser);
  const applicable = !!data.basicInfo.processItems?.smt;

  return (
    <div className="section-form animate-fade-in">
      <h2 className="section-title">SMT 首件管制</h2>

      {!applicable ? (
        <div className="workflow-na-note glass-card">
          <strong>此機種未選擇 SMT，這一步目前不適用。</strong>
          <span>如需填寫，請先回到「品質與加工需求」勾選 SMT。</span>
        </div>
      ) : (
        <fieldset className={`form-group required-highlight ${getFieldHighlightClass(highlightField, 'smtFirstPiece')}`} style={{ border: 'none', padding: 0, margin: 0 }}>
          <legend className="form-label"><span className="card-icon-circle card-icon-xs">{sectionSvg.layers}</span> SMT 首件檢查項目 <span className="req">*</span></legend>
          <div className="checkbox-flex smt-control-stack">
            <div className="checkbox-flex" style={{ flexWrap: 'wrap' }}>
              {[
                ['polarity', '極性方向檢查'], ['measureLcr', '量測 LCR'], ['spi', 'SPI 錫膏厚度'],
                ['steelTension', '鋼板張力量測'], ['pcbReflow', 'PCB外觀檢查'], ['solderability', '濕潤性檢查'],
              ].map(([key, label]) => (
                <label key={key} className="checkbox-label">
                  <input type="checkbox" checked={data.processControl?.smtFirstPiece?.[key] || false}
                    onChange={(e) => setField('processControl.smtFirstPiece', { ...(data.processControl?.smtFirstPiece || {}), [key]: e.target.checked })}
                    disabled={isFieldDisabled(data, currentUser, `processControl.smtFirstPiece.${key}`)} />
                  <span>{label}</span>
                </label>
              ))}
            </div>
            <div className={`form-group required-highlight ${getFieldHighlightClass(highlightField, 'stencilApertureRatio')}`}>
              <label htmlFor="smt-stencilApertureRatio" className="form-label">鋼板開孔比例（錫膏印刷） <span className="req">*</span></label>
              <div className="inline-control-row">
                <input id="smt-stencilApertureRatio" type="text" className="form-input edit-active compact" placeholder="例如: 100" name="processControl.smtFirstPiece.stencilApertureRatio"
                  value={data.processControl?.smtFirstPiece?.stencilApertureRatio || ''}
                  onChange={(e) => setField('processControl.smtFirstPiece.stencilApertureRatio', e.target.value)}
                  disabled={isFieldDisabled(data, currentUser, 'processControl.smtFirstPiece.stencilApertureRatio')} />
                <span>%</span>
              </div>
            </div>
            <fieldset className={`form-group required-highlight ${getFieldHighlightClass(highlightField, 'ledTest')}`} style={{ border: 'none', padding: 0, margin: 0 }}>
              <legend className="form-label">LED 點亮測試 <span className="req">*</span></legend>
              <div className="radio-group">
                <label className="radio-label"><input type="radio" name="ledTest" checked={data.processControl?.smtFirstPiece?.ledTest === 'yes'}
                  onChange={() => setField('processControl.smtFirstPiece', { ...(data.processControl?.smtFirstPiece || {}), ledTest: 'yes' })}
                  disabled={isFieldDisabled(data, currentUser, 'processControl.smtFirstPiece.ledTest')} /><span>有</span></label>
                <label className="radio-label"><input type="radio" name="ledTest" checked={data.processControl?.smtFirstPiece?.ledTest === 'no'}
                  onChange={() => setField('processControl.smtFirstPiece', { ...(data.processControl?.smtFirstPiece || {}), ledTest: 'no' })}
                  disabled={isFieldDisabled(data, currentUser, 'processControl.smtFirstPiece.ledTest')} /><span>無 / 不適用</span></label>
              </div>
            </fieldset>
            <fieldset className={`form-group required-highlight ${getFieldHighlightClass(highlightField, 'smtOrder')}`} style={{ border: 'none', padding: 0, margin: 0 }}>
              <legend className="form-label">SMT 焊接順序 <span className="req">*</span></legend>
              <div className="radio-group">
                <label className="radio-label"><input type="radio" name="smtOrder" checked={data.processControl?.smtOrder?.bToT || false}
                  onChange={() => setField('processControl.smtOrder', { bToT: true, tToB: false })}
                  disabled={isFieldDisabled(data, currentUser, 'processControl.smtOrder.bToT')} /><span>先焊底面 (B→T)</span></label>
                <label className="radio-label"><input type="radio" name="smtOrder" checked={data.processControl?.smtOrder?.tToB || false}
                  onChange={() => setField('processControl.smtOrder', { bToT: false, tToB: true })}
                  disabled={isFieldDisabled(data, currentUser, 'processControl.smtOrder.tToB')} /><span>先焊頂面 (T→B)</span></label>
              </div>
            </fieldset>
          </div>
        </fieldset>
      )}

      <StepActionBar
        onPrev={onPrev}
        onNext={onNext}
        nextLabel="下一步：DIP 與特殊製程"
      />
    </div>
  );
}

SmtControlSection.propTypes = {
  data: PropTypes.object.isRequired,
  onChange: PropTypes.func.isRequired,
  currentUser: PropTypes.object,
  highlightField: PropTypes.string,
  onNext: PropTypes.func.isRequired,
  onPrev: PropTypes.func,
};
