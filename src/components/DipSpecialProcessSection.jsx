import PropTypes from 'prop-types';
import { useFieldOwner } from '../hooks/useFieldOwner';
import { isFieldDisabled, getFieldHighlightClass } from '../utils/fieldUtils';
import { sectionSvg } from '../utils/svgIcons';
import './FormSections.css';

export default function DipSpecialProcessSection({ data, onChange, currentUser, highlightField, onNext, onPrev }) {
  const { setField } = useFieldOwner(onChange, currentUser);
  const dipApplicable = !!data.basicInfo.processItems?.dip;
  const underfillApplicable = !!data.basicInfo.processItems?.underfillGlue;
  const applicable = dipApplicable || underfillApplicable;

  return (
    <div className="section-form animate-fade-in">
      {!applicable ? (
        <div className="workflow-na-note glass-card">
          <strong>此機種未選擇 DIP 或 Underfill，這一步目前不適用。</strong>
          <span>如需填寫，請先回到「品質與加工需求」勾選對應加工項目。</span>
        </div>
      ) : (
        <>
          {dipApplicable && (
            <div className={`form-section-card glass-card ${getFieldHighlightClass(highlightField, 'dipFirstPiece')}`} data-accent="cyan">
              <div className="card-header"><span className="card-icon-circle">{sectionSvg.microscope}</span>DIP 首件管制</div>
              <div className="card-body">
                <div className="form-group required-highlight">
                  <label className="checkbox-label">
                    <input type="checkbox" checked={data.processControl?.dipFirstPiece?.cutLead || false}
                      onChange={(e) => setField('processControl.dipFirstPiece', { ...(data.processControl?.dipFirstPiece || {}), cutLead: e.target.checked })}
                      disabled={isFieldDisabled(data, currentUser, 'processControl.dipFirstPiece.cutLead')} />
                    <span>剪腳前置作業（切腳、折腳、預成型）<span className="req"> *</span></span>
                  </label>
                  <textarea className="form-input edit-active compact" placeholder="DIP 注意事項（限 50 字）" name="processControl.dipFirstPiece.memo" maxLength={50}
                    value={data.processControl?.dipFirstPiece?.memo || ''}
                    onChange={(e) => setField('processControl.dipFirstPiece', { ...(data.processControl?.dipFirstPiece || {}), memo: e.target.value })}
                    disabled={isFieldDisabled(data, currentUser, 'processControl.dipFirstPiece.memo')} />
                </div>
                <fieldset className={`form-group required-highlight ${getFieldHighlightClass(highlightField, 'dipOrder')}`} style={{ border: 'none', padding: 0, margin: 0 }}>
                  <legend className="form-label">DIP 焊接順序 <span className="req">*</span></legend>
                  <div className="radio-group">
                    <label className="radio-label"><input type="radio" name="dipOrder" checked={data.processControl?.dipOrder?.bToT || false}
                      onChange={() => setField('processControl.dipOrder', { bToT: true, tToB: false })}
                      disabled={isFieldDisabled(data, currentUser, 'processControl.dipOrder.bToT')} /><span>先焊底面 (B→T)</span></label>
                    <label className="radio-label"><input type="radio" name="dipOrder" checked={data.processControl?.dipOrder?.tToB || false}
                      onChange={() => setField('processControl.dipOrder', { bToT: false, tToB: true })}
                      disabled={isFieldDisabled(data, currentUser, 'processControl.dipOrder.tToB')} /><span>先焊頂面 (T→B)</span></label>
                  </div>
                </fieldset>
              </div>
            </div>
          )}

          {underfillApplicable && (
            <div className="form-section-card glass-card" data-accent="amber">
              <div className="card-header"><span className="card-icon-circle">{sectionSvg.gear}</span>Underfill 製程條件</div>
              <div className="card-body">
                <div className="form-row-grid-3">
                  <div className="form-group required-highlight">
                    <label htmlFor="underfill-bakeTemp" className="form-label">後烘烤溫度 <span className="req">*</span></label>
                    <div className="inline-control-row">
                      <input id="underfill-bakeTemp" type="text" className="form-input edit-active compact" placeholder="溫度" name="processControl.underfill.bakeTemp" value={data.processControl?.underfill?.bakeTemp || ''}
                        onChange={(e) => setField('processControl.underfill', { ...(data.processControl.underfill || {}), bakeTemp: e.target.value })}
                        disabled={isFieldDisabled(data, currentUser, 'processControl.underfill.bakeTemp')} />
                      <span>°C</span>
                    </div>
                  </div>
                  <div className="form-group required-highlight">
                    <label htmlFor="underfill-bakeTime" className="form-label">後烘烤時間 <span className="req">*</span></label>
                    <div className="inline-control-row">
                      <input id="underfill-bakeTime" type="text" className="form-input edit-active compact" placeholder="時間" name="processControl.underfill.bakeTime" value={data.processControl?.underfill?.bakeTime || ''}
                        onChange={(e) => setField('processControl.underfill', { ...(data.processControl.underfill || {}), bakeTime: e.target.value })}
                        disabled={isFieldDisabled(data, currentUser, 'processControl.underfill.bakeTime')} />
                      <span>min</span>
                    </div>
                  </div>
                  <div className="form-group required-highlight">
                    <label htmlFor="underfill-glueModel" className="form-label">膠材型號 <span className="req">*</span></label>
                    <input id="underfill-glueModel" type="text" className="form-input edit-active" placeholder="例如: Loctite 3513" name="processControl.underfill.glueModel" value={data.processControl?.underfill?.glueModel || ''}
                      onChange={(e) => setField('processControl.underfill', { ...(data.processControl.underfill || {}), glueModel: e.target.value })}
                      disabled={isFieldDisabled(data, currentUser, 'processControl.underfill.glueModel')} />
                  </div>
                </div>
              </div>
            </div>
          )}

          <div className="form-group">
            <label htmlFor="special-process-memo" className="form-label">特殊製程備註（選填）</label>
            <textarea id="special-process-memo" className="form-textarea edit-active" rows={3} placeholder="如有特殊焊接、清洗、塗覆要求，請在此填寫..." name="processControl.specialProcessMemo"
              value={data.processControl?.specialProcessMemo || ''}
              onChange={(e) => setField('processControl.specialProcessMemo', e.target.value)}
              disabled={isFieldDisabled(data, currentUser, 'processControl.specialProcessMemo')} />
          </div>
        </>
      )}

      <div className="action-row">
        {onPrev && <button type="button" className="btn btn-secondary" onClick={onPrev}>上一步</button>}
        <button type="button" className="btn btn-primary" onClick={onNext}>下一步：試產交付確認</button>
      </div>
    </div>
  );
}

DipSpecialProcessSection.propTypes = {
  data: PropTypes.object.isRequired,
  onChange: PropTypes.func.isRequired,
  currentUser: PropTypes.object,
  highlightField: PropTypes.string,
  onNext: PropTypes.func.isRequired,
  onPrev: PropTypes.func,
};
