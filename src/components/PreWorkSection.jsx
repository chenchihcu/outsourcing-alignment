import PropTypes from 'prop-types';
import { useFieldOwner } from '../hooks/useFieldOwner';
import { isFieldDisabled, getFieldHighlightClass, updateFieldWithOwner } from '../utils/fieldUtils';
import { sectionSvg } from '../utils/svgIcons';
import StepActionBar from './StepActionBar';
import './FormSections.css';

export default function PreWorkSection({ data, onChange, currentUser, highlightField, onNext, onPrev }) {
  const { setField } = useFieldOwner(onChange, currentUser);

  const handleBakeChange = (field, val) => {
    if (['pcbBakeTemp', 'pcbBakeTol', 'pcbBakeHr', 'fpcaBakeTemp', 'fpcaBakeHr'].includes(field)) {
      val = String(val).replace(/[^\d]/g, '');
    }
    onChange(prev => {
      const pc = prev.processControl || {};
      const bakeObj = pc.bakeRequired || {};
      let updatedBake = { ...bakeObj, [field]: val };
      if (field === 'need' && val === true) {
        updatedBake.noNeed = false;
        if (!updatedBake.fpcaBakeTemp) updatedBake.fpcaBakeTemp = '80';
        if (!updatedBake.fpcaBakeHr) updatedBake.fpcaBakeHr = '4';
      } else if (field === 'noNeed' && val === true) {
        updatedBake = { ...updatedBake, need: false, pcbBakeTemp: '', pcbBakeTol: '', pcbBakeHr: '', fpcaBakeTemp: '', fpcaBakeHr: '', pcbBakeCond: '', fpcaBakeCond: '' };
      }
      if (['pcbBakeTemp', 'pcbBakeTol', 'pcbBakeHr'].includes(field) || (field === 'need' && val === true)) {
        const tempStr = updatedBake.pcbBakeTemp || '_____';
        const tolStr = updatedBake.pcbBakeTol || '___';
        const hrStr = updatedBake.pcbBakeHr || '___';
        updatedBake.pcbBakeCond = `PCB 烘烤: ${tempStr}  °C ± ${tolStr} °C × ${hrStr} hr（依 PCB 廠建議）`;
      }
      if (['fpcaBakeTemp', 'fpcaBakeHr'].includes(field) || (field === 'need' && val === true)) {
        const tempStr = updatedBake.fpcaBakeTemp || '80';
        const hrStr = updatedBake.fpcaBakeHr || '4';
        updatedBake.fpcaBakeCond = `FPCA 烘烤: 依原物料規格書，若無規格則 _${tempStr}__ °C × _${hrStr}__ hr`;
      }
      const updated = { ...pc, bakeRequired: updatedBake };
      const path = `processControl.bakeRequired.${field}`;
      const result = updateFieldWithOwner({ ...prev, processControl: updated }, path, val, currentUser?.unit);
      if (field === 'noNeed' && val === true) {
        const owners = { ...(result._owners || {}) };
        ['need', 'pcbBakeTemp', 'pcbBakeTol', 'pcbBakeHr', 'fpcaBakeTemp', 'fpcaBakeHr', 'pcbBakeCond', 'fpcaBakeCond']
          .forEach(k => { delete owners[`processControl.bakeRequired.${k}`]; });
        return { ...result, _owners: owners };
      }
      return result;
    });
  };

  /* 包材類型互斥切換 */
  const packagingType = data.processControl?.packagingType || null;
  const handlePackagingType = (type) => {
    setField('processControl.packagingType', type);
  };

  const packagingOptions = [
    ['staticBag', '靜電袋'],
    ['honeycomb', '蜂巢式抗靜電隔板'],
    ['tray', 'Tray 抗靜電脆盤'],
    ['sensorCover', 'Sensor 保護貼'],
    ['cameraCover', 'Camera 保護貼']
  ];

  const pkgData = packagingType === 'pcba'
    ? (data.processControl?.pcbaPackaging || {})
    : packagingType === 'fpca'
    ? (data.processControl?.fpcaPackaging || {})
    : {};

  return (
    <div className="section-form animate-fade-in">
      <h2 className="section-title">生產前置作業</h2>

      <div className="form-row-grid" data-accent="indigo">
        <fieldset className={`form-group required-highlight ${getFieldHighlightClass(highlightField, 'sampleProvided')}`} style={{ border: 'none', padding: 0, margin: 0 }}>
          <legend className="form-label"><span className="card-icon-circle card-icon-xs">{sectionSvg.clipboard}</span> 樣品提供確認 <span className="req">*</span></legend>
          <div className="checkbox-flex">
            {['trialBoard', 'tempBoard', 'standardPart'].map(k => (
              <label key={k} className="checkbox-label">
                <input type="checkbox" checked={data.processControl?.sampleProvided?.[k] || false}
                  onChange={(e) => setField(`processControl.sampleProvided.${k}`, e.target.checked)}
                  disabled={isFieldDisabled(data, currentUser, `processControl.sampleProvided.${k}`)} />
                <span>{k === 'trialBoard' ? '試錫板' : k === 'tempBoard' ? '測溫板' : '標準件'}</span>
              </label>
            ))}
          </div>
        </fieldset>
        <fieldset className={`form-group required-highlight ${getFieldHighlightClass(highlightField, 'bakeRequired')}`} style={{ border: 'none', padding: 0, margin: 0 }}>
          <legend className="form-label"><span className="card-icon-circle card-icon-xs">{sectionSvg.thermometer}</span> PCB / FPCA 烘烤需求 <span className="req">*</span></legend>
          <div className="radio-group">
            <label className="radio-label">
              <input type="radio" name="bakeRequired" checked={data.processControl?.bakeRequired?.need || false}
                onChange={() => handleBakeChange('need', true)}
                disabled={isFieldDisabled(data, currentUser, 'processControl.bakeRequired.need')} />
              <span>需要烘烤</span>
            </label>
            <label className="radio-label">
              <input type="radio" name="bakeRequired" checked={data.processControl?.bakeRequired?.noNeed || false}
                onChange={() => handleBakeChange('noNeed', true)}
                disabled={isFieldDisabled(data, currentUser, 'processControl.bakeRequired.noNeed')} />
              <span>不需要</span>
            </label>
          </div>
        </fieldset>
      </div>

      {data.processControl?.bakeRequired?.need && (
        <div className="bake-cond-box animate-fade-in">
          <div className="form-row-grid" style={{ gridTemplateColumns: '1fr' }}>
            <fieldset className={`form-group required-highlight ${getFieldHighlightClass(highlightField, 'bakeRequired')}`} style={{ border: 'none', padding: 0, margin: 0 }}>
              <legend className="form-label">PCB 烘烤條件 <span className="req">*</span></legend>
              <div className="inline-bake-inputs edit-active">
                <span>PCB 烘烤: </span>
                <input type="text" className="inline-num-input" placeholder="120" name="processControl.bakeRequired.pcbBakeTemp" value={data.processControl?.bakeRequired?.pcbBakeTemp || ''}
                  onChange={(e) => handleBakeChange('pcbBakeTemp', e.target.value)} disabled={isFieldDisabled(data, currentUser, 'processControl.bakeRequired.pcbBakeTemp')} />
                <span> °C ± </span>
                <input type="text" className="inline-num-input inline-num-small" placeholder="5" name="processControl.bakeRequired.pcbBakeTol" value={data.processControl?.bakeRequired?.pcbBakeTol || ''}
                  onChange={(e) => handleBakeChange('pcbBakeTol', e.target.value)} disabled={isFieldDisabled(data, currentUser, 'processControl.bakeRequired.pcbBakeTol')} />
                <span> °C × </span>
                <input type="text" className="inline-num-input inline-num-small" placeholder="2" name="processControl.bakeRequired.pcbBakeHr" value={data.processControl?.bakeRequired?.pcbBakeHr || ''}
                  onChange={(e) => handleBakeChange('pcbBakeHr', e.target.value)} disabled={isFieldDisabled(data, currentUser, 'processControl.bakeRequired.pcbBakeHr')} />
                <span> hr（依 PCB 廠建議）</span>
              </div>
              {((data.processControl?.bakeRequired?.pcbBakeTemp && (Number(data.processControl.bakeRequired.pcbBakeTemp) < 90 || Number(data.processControl.bakeRequired.pcbBakeTemp) > 150)) ||
                (data.processControl?.bakeRequired?.pcbBakeHr && (Number(data.processControl.bakeRequired.pcbBakeHr) < 1 || Number(data.processControl.bakeRequired.pcbBakeHr) > 12))) && (
                <div className="inline-input-warning animate-fade-in">⚠️ 警告：PCB 烘烤建議溫度為 100°C~140°C，時間為 2~6 hr。請確認填寫數值是否正確。</div>
              )}
            </fieldset>
            <fieldset className={`form-group required-highlight ${getFieldHighlightClass(highlightField, 'bakeRequired')}`} style={{ border: 'none', padding: 0, margin: 0 }}>
              <legend className="form-label">FPCA 烘烤條件 <span className="req">*</span></legend>
              <div className="inline-bake-inputs edit-active">
                <span>FPCA 烘烤: 依原物料規格書，若無規格則 </span>
                <input type="text" className="inline-num-input" placeholder="80" name="processControl.bakeRequired.fpcaBakeTemp" value={data.processControl?.bakeRequired?.fpcaBakeTemp || ''}
                  onChange={(e) => handleBakeChange('fpcaBakeTemp', e.target.value)} disabled={isFieldDisabled(data, currentUser, 'processControl.bakeRequired.fpcaBakeTemp')} />
                <span> °C × </span>
                <input type="text" className="inline-num-input inline-num-small" placeholder="4" name="processControl.bakeRequired.fpcaBakeHr" value={data.processControl?.bakeRequired?.fpcaBakeHr || ''}
                  onChange={(e) => handleBakeChange('fpcaBakeHr', e.target.value)} disabled={isFieldDisabled(data, currentUser, 'processControl.bakeRequired.fpcaBakeHr')} />
                <span> hr</span>
              </div>
              {((data.processControl?.bakeRequired?.fpcaBakeTemp && (Number(data.processControl.bakeRequired.fpcaBakeTemp) < 50 || Number(data.processControl.bakeRequired.fpcaBakeTemp) > 110)) ||
                (data.processControl?.bakeRequired?.fpcaBakeHr && (Number(data.processControl.bakeRequired.fpcaBakeHr) < 1 || Number(data.processControl.bakeRequired.fpcaBakeHr) > 12))) && (
                <div className="inline-input-warning animate-fade-in">⚠️ 警告：FPCA 烘烤建議溫度為 60°C~100°C，時間為 2~8 hr。請確認填寫數值是否正確。</div>
              )}
            </fieldset>
          </div>
        </div>
      )}

      <div className="divider"></div>

      <fieldset className={`form-group required-highlight ${getFieldHighlightClass(highlightField, 'pcbaPackaging')}`} data-accent="violet" style={{ border: 'none', padding: 0, margin: 0 }}>
        <legend className="form-label"><span className="card-icon-circle card-icon-xs">{sectionSvg.box}</span> 包材種類選擇 <span className="req">*</span></legend>
        <div className="radio-group" style={{ marginBottom: '12px' }}>
          <label className="radio-label">
            <input type="radio" name="packagingType" checked={packagingType === 'pcba'}
              onChange={() => handlePackagingType('pcba')}
              disabled={isFieldDisabled(data, currentUser, 'processControl.packagingType')} />
            <span>PCBA 包材</span>
          </label>
          <label className="radio-label">
            <input type="radio" name="packagingType" checked={packagingType === 'fpca'}
              onChange={() => handlePackagingType('fpca')}
              disabled={isFieldDisabled(data, currentUser, 'processControl.packagingType')} />
            <span>FPCA 包材</span>
          </label>
        </div>
        {packagingType && (
          <div className="checkbox-flex animate-fade-in" style={{ flexWrap: 'wrap', gap: '12px', paddingLeft: '4px' }}>
            {packagingOptions.map(([key, label]) => (
              <label key={key} className="checkbox-label">
                <input type="checkbox" checked={pkgData[key] || false}
                  onChange={(e) => {
                    const target = packagingType === 'pcba' ? 'processControl.pcbaPackaging' : 'processControl.fpcaPackaging';
                    setField(target, { ...pkgData, [key]: e.target.checked });
                  }}
                  disabled={isFieldDisabled(data, currentUser, `processControl.${packagingType}Packaging.${key}`)} />
                <span>{label}</span>
              </label>
            ))}
          </div>
        )}
      </fieldset>

      <StepActionBar
        onPrev={onPrev}
        onNext={onNext}
        nextLabel="下一步：測溫點配置"
      />
    </div>
  );
}

PreWorkSection.propTypes = {
  data: PropTypes.object.isRequired,
  onChange: PropTypes.func.isRequired,
  currentUser: PropTypes.object,
  highlightField: PropTypes.string,
  onNext: PropTypes.func.isRequired,
  onPrev: PropTypes.func,
};
