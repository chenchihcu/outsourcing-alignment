import PropTypes from 'prop-types';
import { useFieldOwner } from '../hooks/useFieldOwner';
import { isFieldDisabled, getFieldHighlightClass } from '../utils/fieldUtils';
import { sectionSvg, processMicroIcons } from '../utils/svgIcons';
import StepActionBar from './StepActionBar';
import './FormSections.css';

export default function ToolingSection({ data, onChange, currentUser, highlightField, onNext, onPrev }) {
  const { setField } = useFieldOwner(onChange, currentUser);

  const fixtureDefs = {
    routingFixture: { label: '分板治具 (Router Fixture)', icon: processMicroIcons.router },
    glueFixture: { label: '點膠/塗膠治具 (Dispensing Fixture)', icon: processMicroIcons.underfill },
    testFixture: { label: '測試治具 (ICT/FCT Fixture)', icon: processMicroIcons.ict },
    assemblyFixture: { label: '組裝治具 (Assembly Jig)', icon: processMicroIcons.assembly }
  };

  return (
    <div className="section-form animate-fade-in">
      <div className="form-section-card glass-card" data-accent="slate">
        <div className="card-header"><span className="card-icon-circle">{sectionSvg.wrench}</span>鋼網與治工具需求一覽表 (Tooling & Stencil)</div>
        <div className="card-body">
          {data.basicInfo.processItems?.smt && (
            <div className={`tooling-box ${getFieldHighlightClass(highlightField, 'stencil')}`}>
              <span className="tooling-badge">
                <span className="item-micro-icon" style={{ background: 'transparent', color: '#fff', width: '16px', height: '16px', marginRight: '4px' }}>
                  {processMicroIcons.stencil({ size: 14 })}
                </span>
                SMT 鋼網規格 (Stencil)
              </span>
              <div className="form-row-grid-2 animate-fade-in" style={{ marginTop: '8px' }}>
                <div className={`form-group required-highlight ${getFieldHighlightClass(highlightField, 'stencil')}`}>
                  <label htmlFor="tooling-stencil-thickness" className="form-label">鋼網厚度 (Thickness, mm) <span className="req">*</span></label>
                  <input id="tooling-stencil-thickness" type="text" className="form-input edit-active" placeholder="例如: 0.12" name="basicInfo.tooling.stencil.thickness" value={data.basicInfo.tooling?.stencil?.thickness || ''}
                    onChange={(e) => setField('basicInfo.tooling.stencil.thickness', e.target.value)}
                    disabled={isFieldDisabled(data, currentUser, 'basicInfo.tooling.stencil.thickness')} />
                </div>
                <fieldset className="form-group required-highlight" style={{ border: 'none', padding: 0, margin: 0 }}>
                  <legend className="form-label">鋼網工藝樣式 <span className="req">*</span></legend>
                  <div className="checkbox-flex" style={{ padding: '6px 10px', display: 'flex', flexDirection: 'column', gap: '6px' }}>
                    <div style={{ display: 'flex', gap: '12px' }}>
                      <label className="radio-label" style={{ padding: 0 }}>
                        <input type="radio" name="stencilStyle" checked={(data.basicInfo.tooling?.stencil?.style || 'general') === 'general'}
                          onChange={() => setField('basicInfo.tooling.stencil.style', 'general')}
                          disabled={isFieldDisabled(data, currentUser, 'basicInfo.tooling.stencil.style')} />
                        <span>一般標準鋼網</span>
                      </label>
                      <label className="radio-label" style={{ padding: 0 }}>
                        <input type="radio" name="stencilStyle" checked={data.basicInfo.tooling?.stencil?.style === 'step'}
                          onChange={() => setField('basicInfo.tooling.stencil.style', 'step')}
                          disabled={isFieldDisabled(data, currentUser, 'basicInfo.tooling.stencil.style')} />
                        <span>階梯鋼網 (Step Stencil)</span>
                      </label>
                    </div>
                    <div style={{ borderTop: '1px dashed rgba(255,255,255,0.1)', paddingTop: '6px', marginTop: '2px' }}>
                      <label className="checkbox-label" style={{ padding: 0, margin: 0 }}>
                        <input type="checkbox" checked={data.basicInfo.tooling?.stencil?.nanoCoating || false}
                          onChange={(e) => setField('basicInfo.tooling.stencil.nanoCoating', e.target.checked)}
                          disabled={isFieldDisabled(data, currentUser, 'basicInfo.tooling.stencil.nanoCoating')} />
                        <span style={{ fontSize: '0.85rem', color: '#4f46e5', fontWeight: '600' }}>表面奈米塗層 (Nano-Coating, 可複選)</span>
                      </label>
                    </div>
                  </div>
                </fieldset>
              </div>
            </div>
          )}
          <div className="tooling-grid">
            {['routingFixture', 'glueFixture', 'testFixture', 'assemblyFixture'].map((key) => {
              const def = fixtureDefs[key] || { label: key, icon: processMicroIcons.assembly };
              const item = data.basicInfo.tooling?.[key] || {};
              return (
                <div key={key} className={`tooling-row-align required-highlight ${getFieldHighlightClass(highlightField, key)} m-0`}>
                  <span className="tool-name tool-name-sm" style={{ display: 'inline-flex', alignItems: 'center' }}>
                    <span className="item-micro-icon">{def.icon({ size: 14 })}</span>
                    {def.label}
                  </span>
                  <div className="radio-group">
                    <label className="radio-label">
                      <input type="radio" name={key} checked={item.need || false}
                        onChange={() => { setField(`basicInfo.tooling.${key}.need`, true); setField(`basicInfo.tooling.${key}.noNeed`, false); }}
                        disabled={isFieldDisabled(data, currentUser, `basicInfo.tooling.${key}.need`)} />
                      <span>委外製作 / 需要</span>
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
              <span className="tool-name tool-name-sm" style={{ display: 'inline-flex', alignItems: 'center' }}>
                <span className="item-micro-icon">{processMicroIcons.tray({ size: 14 })}</span>
                SMT 印刷/過爐載具 (Carrier)
              </span>
              <div className="radio-group">
                <label className="radio-label"><input type="radio" name="smtCarrierNeed" checked={data.basicInfo.tooling?.smtCarrier?.need || false}
                  onChange={() => { setField('basicInfo.tooling.smtCarrier.need', true); setField('basicInfo.tooling.smtCarrier.noNeed', false); }}
                  disabled={isFieldDisabled(data, currentUser, 'basicInfo.tooling.smtCarrier.need')} /><span>需要</span></label>
                <label className="radio-label"><input type="radio" name="smtCarrierNeed" checked={data.basicInfo.tooling?.smtCarrier?.noNeed || false}
                  onChange={() => { setField('basicInfo.tooling.smtCarrier.need', false); setField('basicInfo.tooling.smtCarrier.noNeed', true); setField('basicInfo.tooling.smtCarrier.upper', false); setField('basicInfo.tooling.smtCarrier.lower', false); }}
                  disabled={isFieldDisabled(data, currentUser, 'basicInfo.tooling.smtCarrier.noNeed')} /><span>不需要</span></label>
              </div>
              {data.basicInfo.tooling?.smtCarrier?.need && (
                <div className="fixture-qty-input animate-fade-in" style={{ display: 'flex', alignItems: 'center', gap: '8px', maxWidth: '240px' }}>
                  <label className="checkbox-label" style={{ margin: 0, padding: 0 }}>
                    <input type="checkbox" checked={data.basicInfo.tooling?.smtCarrier?.upper || false}
                      onChange={(e) => setField('basicInfo.tooling.smtCarrier.upper', e.target.checked)}
                      disabled={isFieldDisabled(data, currentUser, 'basicInfo.tooling.smtCarrier.upper')} />
                    <span style={{ fontSize: '0.8rem' }}>Top 面載具 (正面)</span>
                  </label>
                  <label className="checkbox-label" style={{ margin: 0, padding: 0 }}>
                    <input type="checkbox" checked={data.basicInfo.tooling?.smtCarrier?.lower || false}
                      onChange={(e) => setField('basicInfo.tooling.smtCarrier.lower', e.target.checked)}
                      disabled={isFieldDisabled(data, currentUser, 'basicInfo.tooling.smtCarrier.lower')} />
                    <span style={{ fontSize: '0.8rem' }}>Bottom 面載具 (背面)</span>
                  </label>
                </div>
              )}
            </div>
            <div className={`tooling-row-align required-highlight ${getFieldHighlightClass(highlightField, 'otherFixture')} m-0`}>
              <span className="tool-name tool-name-sm" style={{ display: 'inline-flex', alignItems: 'center' }}>
                <span className="item-micro-icon">{processMicroIcons.assembly({ size: 14 })}</span>
                其他專案治具
              </span>
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
