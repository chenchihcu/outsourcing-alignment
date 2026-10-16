import PropTypes from 'prop-types';
import { useFieldOwner } from '../hooks/useFieldOwner';
import { isFieldDisabled, getFieldHighlightClass } from '../utils/fieldUtils';
import { sectionSvg } from '../utils/svgIcons';
import StepActionBar from './StepActionBar';
import './FormSections.css';

export default function ToolingSection({ data, onChange, currentUser, highlightField, onNext, onPrev }) {
  const { setField } = useFieldOwner(onChange, currentUser);

  return (
    <div className="section-form animate-fade-in">
      <div className="form-section-card glass-card" data-accent="slate">
        <div className="card-header"><span className="card-icon-circle">{sectionSvg.wrench}</span>鋼板與治工具一覽表</div>
        <div className="card-body">
          {data.basicInfo.processItems?.smt && (
            <div className={`tooling-box ${getFieldHighlightClass(highlightField, 'stencil')}`}>
              <span className="tooling-badge">SMT 鋼板</span>
              <div className="form-row-grid-2 animate-fade-in" style={{ marginTop: '8px' }}>
                <div className={`form-group required-highlight ${getFieldHighlightClass(highlightField, 'stencil')}`}>
                  <label htmlFor="tooling-stencil-thickness" className="form-label">鋼板厚度 (mm) <span className="req">*</span></label>
                  <input id="tooling-stencil-thickness" type="text" className="form-input edit-active" placeholder="例如: 0.12" name="basicInfo.tooling.stencil.thickness" value={data.basicInfo.tooling?.stencil?.thickness || ''}
                    onChange={(e) => setField('basicInfo.tooling.stencil.thickness', e.target.value)}
                    disabled={isFieldDisabled(data, currentUser, 'basicInfo.tooling.stencil.thickness')} />
                </div>
                <fieldset className="form-group required-highlight" style={{ border: 'none', padding: 0, margin: 0 }}>
                  <legend className="form-label">鋼板樣式選擇 <span className="req">*</span></legend>
                  <div className="checkbox-flex" style={{ padding: '6px 10px', display: 'flex', flexDirection: 'column', gap: '6px' }}>
                    <div style={{ display: 'flex', gap: '12px' }}>
                      <label className="radio-label" style={{ padding: 0 }}>
                        <input type="radio" name="stencilStyle" checked={(data.basicInfo.tooling?.stencil?.style || 'general') === 'general'}
                          onChange={() => setField('basicInfo.tooling.stencil.style', 'general')}
                          disabled={isFieldDisabled(data, currentUser, 'basicInfo.tooling.stencil.style')} />
                        <span>一般鋼板</span>
                      </label>
                      <label className="radio-label" style={{ padding: 0 }}>
                        <input type="radio" name="stencilStyle" checked={data.basicInfo.tooling?.stencil?.style === 'step'}
                          onChange={() => setField('basicInfo.tooling.stencil.style', 'step')}
                          disabled={isFieldDisabled(data, currentUser, 'basicInfo.tooling.stencil.style')} />
                        <span>階梯鋼板</span>
                      </label>
                    </div>
                    <div style={{ borderTop: '1px dashed rgba(255,255,255,0.1)', paddingTop: '6px', marginTop: '2px' }}>
                      <label className="checkbox-label" style={{ padding: 0, margin: 0 }}>
                        <input type="checkbox" checked={data.basicInfo.tooling?.stencil?.nanoCoating || false}
                          onChange={(e) => setField('basicInfo.tooling.stencil.nanoCoating', e.target.checked)}
                          disabled={isFieldDisabled(data, currentUser, 'basicInfo.tooling.stencil.nanoCoating')} />
                        <span style={{ fontSize: '0.85rem', color: '#4f46e5', fontWeight: '600' }}>表面奈米塗層 (可複選)</span>
                      </label>
                    </div>
                  </div>
                </fieldset>
              </div>
            </div>
          )}
          <div className="tooling-grid">
            {['routingFixture', 'glueFixture', 'testFixture', 'assemblyFixture'].map((key) => {
              const labelMap = { routingFixture: 'Routing 治具', glueFixture: '塗膠治具', testFixture: '測試治具', assemblyFixture: '組裝治具' };
              const item = data.basicInfo.tooling?.[key] || {};
              return (
                <div key={key} className={`tooling-row-align required-highlight ${getFieldHighlightClass(highlightField, key)} m-0`}>
                  <span className="tool-name tool-name-sm">{labelMap[key]}</span>
                  <div className="radio-group">
                    <label className="radio-label">
                      <input type="radio" name={key} checked={item.need || false}
                        onChange={() => { setField(`basicInfo.tooling.${key}.need`, true); setField(`basicInfo.tooling.${key}.noNeed`, false); }}
                        disabled={isFieldDisabled(data, currentUser, `basicInfo.tooling.${key}.need`)} />
                      <span>Offset / 需要</span>
                    </label>
                    <label className="radio-label">
                      <input type="radio" name={key} checked={item.noNeed || false}
                        onChange={() => { setField(`basicInfo.tooling.${key}.need`, false); setField(`basicInfo.tooling.${key}.noNeed`, true); setField(`basicInfo.tooling.${key}.qty`, ''); }}
                        disabled={isFieldDisabled(data, currentUser, `basicInfo.tooling.${key}.noNeed`)} />
                      <span>不需要</span>
                    </label>
                  </div>
                  {item.need && (
                    <div className="fixture-qty-input animate-fade-in" style={{ display: 'flex', alignItems: 'center', gap: '6px', maxWidth: '140px' }}>
                      <span style={{ fontSize: '0.78rem', color: '#6b7280', whiteSpace: 'nowrap' }}>數量:</span>
                      <input type="text" className="form-input edit-active compact" placeholder="例: 2 SETs" name={`basicInfo.tooling.${key}.qty`} value={item.qty || ''}
                        onChange={(e) => setField(`basicInfo.tooling.${key}.qty`, e.target.value)}
                        disabled={isFieldDisabled(data, currentUser, `basicInfo.tooling.${key}.qty`)} style={{ padding: '4px 6px', fontSize: '0.8rem' }} />
                    </div>
                  )}
                </div>
              );
            })}
          </div>
          <div className="tooling-grid">
            <div className={`tooling-row-align required-highlight ${getFieldHighlightClass(highlightField, 'smtCarrier')} m-0`}>
              <span className="tool-name tool-name-sm">SMT刷錫載具</span>
              <div className="radio-group">
                <label className="radio-label"><input type="radio" name="smtCarrierNeed" checked={data.basicInfo.tooling?.smtCarrier?.need || false}
                  onChange={() => { setField('basicInfo.tooling.smtCarrier.need', true); setField('basicInfo.tooling.smtCarrier.noNeed', false); }}
                  disabled={isFieldDisabled(data, currentUser, 'basicInfo.tooling.smtCarrier.need')} /><span>需要</span></label>
                <label className="radio-label"><input type="radio" name="smtCarrierNeed" checked={data.basicInfo.tooling?.smtCarrier?.noNeed || false}
                  onChange={() => { setField('basicInfo.tooling.smtCarrier.need', false); setField('basicInfo.tooling.smtCarrier.noNeed', true); setField('basicInfo.tooling.smtCarrier.upper', false); setField('basicInfo.tooling.smtCarrier.lower', false); }}
                  disabled={isFieldDisabled(data, currentUser, 'basicInfo.tooling.smtCarrier.noNeed')} /><span>不需要</span></label>
              </div>
              {data.basicInfo.tooling?.smtCarrier?.need && (
                <div className="fixture-qty-input animate-fade-in" style={{ display: 'flex', alignItems: 'center', gap: '8px', maxWidth: '160px' }}>
                  <label className="checkbox-label" style={{ margin: 0, padding: 0 }}>
                    <input type="checkbox" checked={data.basicInfo.tooling?.smtCarrier?.upper || false}
                      onChange={(e) => setField('basicInfo.tooling.smtCarrier.upper', e.target.checked)}
                      disabled={isFieldDisabled(data, currentUser, 'basicInfo.tooling.smtCarrier.upper')} />
                    <span style={{ fontSize: '0.8rem' }}>上載板</span>
                  </label>
                  <label className="checkbox-label" style={{ margin: 0, padding: 0 }}>
                    <input type="checkbox" checked={data.basicInfo.tooling?.smtCarrier?.lower || false}
                      onChange={(e) => setField('basicInfo.tooling.smtCarrier.lower', e.target.checked)}
                      disabled={isFieldDisabled(data, currentUser, 'basicInfo.tooling.smtCarrier.lower')} />
                    <span style={{ fontSize: '0.8rem' }}>下載板</span>
                  </label>
                </div>
              )}
            </div>
            <div className={`tooling-row-align required-highlight ${getFieldHighlightClass(highlightField, 'otherFixture')} m-0`}>
              <span className="tool-name tool-name-sm">其他治具</span>
              <div className="radio-group">
                <label className="radio-label"><input type="radio" name="otherFixtureNeed" checked={data.basicInfo.tooling?.otherFixture?.need || false}
                  onChange={() => { setField('basicInfo.tooling.otherFixture.need', true); setField('basicInfo.tooling.otherFixture.noNeed', false); }}
                  disabled={isFieldDisabled(data, currentUser, 'basicInfo.tooling.otherFixture.need')} /><span>需要</span></label>
                <label className="radio-label"><input type="radio" name="otherFixtureNeed" checked={data.basicInfo.tooling?.otherFixture?.noNeed || false}
                  onChange={() => { setField('basicInfo.tooling.otherFixture.need', false); setField('basicInfo.tooling.otherFixture.noNeed', true); setField('basicInfo.tooling.otherFixture.name', ''); setField('basicInfo.tooling.otherFixture.qty', ''); }}
                  disabled={isFieldDisabled(data, currentUser, 'basicInfo.tooling.otherFixture.noNeed')} /><span>不需要</span></label>
              </div>
              {data.basicInfo.tooling?.otherFixture?.need && (
                <div className="fixture-qty-input animate-fade-in" style={{ display: 'flex', alignItems: 'center', gap: '6px', flex: 1, maxWidth: '200px' }}>
                  <input type="text" className="form-input edit-active compact" placeholder="治具名稱" name="basicInfo.tooling.otherFixture.name" value={data.basicInfo.tooling?.otherFixture?.name || ''}
                    onChange={(e) => setField('basicInfo.tooling.otherFixture.name', e.target.value)}
                    disabled={isFieldDisabled(data, currentUser, 'basicInfo.tooling.otherFixture.name')} style={{ flex: 2, padding: '4px 6px', fontSize: '0.8rem' }} />
                  <input type="text" className="form-input edit-active compact" placeholder="數量" name="basicInfo.tooling.otherFixture.qty" value={data.basicInfo.tooling?.otherFixture?.qty || ''}
                    onChange={(e) => setField('basicInfo.tooling.otherFixture.qty', e.target.value)}
                    disabled={isFieldDisabled(data, currentUser, 'basicInfo.tooling.otherFixture.qty')} style={{ flex: 1, padding: '4px 6px', fontSize: '0.8rem' }} />
                </div>
              )}
            </div>
          </div>
        </div>
      </div>

      <StepActionBar
        onPrev={onPrev}
        onNext={onNext}
        nextLabel="下一步：生產前置作業"
      />
    </div>
  );
}

ToolingSection.propTypes = {
  data: PropTypes.object.isRequired,
  onChange: PropTypes.func.isRequired,
  currentUser: PropTypes.object,
  highlightField: PropTypes.string,
  onNext: PropTypes.func.isRequired,
  onPrev: PropTypes.func,
};
