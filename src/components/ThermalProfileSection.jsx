import PropTypes from 'prop-types';
import { useFieldOwner } from '../hooks/useFieldOwner';
import { isFieldDisabled, getFieldHighlightClass } from '../utils/fieldUtils';
import { sectionSvg } from '../utils/svgIcons';
import StepActionBar from './StepActionBar';
import './FormSections.css';

export default function ThermalProfileSection({ data, onChange, currentUser, highlightField, onNext, onPrev }) {
  const { setField } = useFieldOwner(onChange, currentUser);

  return (
    <div className="section-form animate-fade-in">
      <h2 className="section-title">測溫點配置</h2>

      <h3 className="sub-section-title"><span className="card-icon-circle card-icon-sm">{sectionSvg.thermometer}</span>關鍵零件與測溫位置</h3>
      <fieldset className={`form-group required-highlight ${getFieldHighlightClass(highlightField, 'keyParts')}`} style={{ border: 'none', padding: 0, margin: 0 }}>
        <legend className="form-label">關鍵零件狀態 <span className="req">*</span></legend>
        <div className="radio-group">
          <label className="radio-label">
            <input type="radio" name="keyParts" checked={data.processControl?.keyParts?.has || false}
              onChange={() => setField('processControl.keyParts', { has: true, none: false })}
              disabled={isFieldDisabled(data, currentUser, 'processControl.keyParts.has')} />
            <span>有關鍵零件</span>
          </label>
          <label className="radio-label">
            <input type="radio" name="keyParts" checked={data.processControl?.keyParts?.none || false}
              onChange={() => setField('processControl.keyParts', { has: false, none: true })}
              disabled={isFieldDisabled(data, currentUser, 'processControl.keyParts.none')} />
            <span>無關鍵零件</span>
          </label>
        </div>
      </fieldset>

      {data.processControl?.keyParts?.has && (
        <div className={`temp-points-table-wrapper animate-fade-in ${getFieldHighlightClass(highlightField, 'tempPoints')}`}>
          <div className="temp-points-grid">
            {[0, 1, 2, 3, 4, 5].map((index) => (
              <div key={index} className="temp-point-field">
                <label htmlFor={`temp-point-${index}`}>#{index + 1}</label>
                <input id={`temp-point-${index}`} type="text" className="form-input edit-active" placeholder="例如: U12, Q5" name={`processControl.tempPoints.${index}.pos`} value={data.processControl.tempPoints?.[index]?.pos || ''}
                  onChange={(e) => setField(`processControl.tempPoints.${index}.pos`, e.target.value)}
                  disabled={isFieldDisabled(data, currentUser, `processControl.tempPoints.${index}.pos`)} />
              </div>
            ))}
          </div>
        </div>
      )}

      <StepActionBar
        onPrev={onPrev}
        onNext={onNext}
        nextLabel="下一步：SMT 首件管制"
      />
    </div>
  );
}

ThermalProfileSection.propTypes = {
  data: PropTypes.object.isRequired,
  onChange: PropTypes.func.isRequired,
  currentUser: PropTypes.object,
  highlightField: PropTypes.string,
  onNext: PropTypes.func.isRequired,
  onPrev: PropTypes.func,
};
