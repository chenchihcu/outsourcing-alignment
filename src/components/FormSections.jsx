import PropTypes from 'prop-types';
import BasicInfoSection from './BasicInfoSection';
import QualityProcessSection from './QualityProcessSection';
import ToolingSection from './ToolingSection';
import PreWorkSection from './PreWorkSection';
import ThermalProfileSection from './ThermalProfileSection';
import SmtControlSection from './SmtControlSection';
import DipSpecialProcessSection from './DipSpecialProcessSection';
import TrialReportSection from './TrialReportSection';
import DocumentsSection from './DocumentsSection';
import './FormSections.css';

export default function FormSections({ data, activeSection, onChange, onNext, onPrev, currentUser, factories, highlightField }) {
  return (
    <div className="sections-container">
      {activeSection === 'basicInfo' && (
        <BasicInfoSection {...{ data, onChange, currentUser, factories, highlightField, onNext, onPrev }} />
      )}
      {activeSection === 'qualityProcess' && (
        <QualityProcessSection {...{ data, onChange, currentUser, highlightField, onNext, onPrev }} />
      )}
      {activeSection === 'tooling' && (
        <ToolingSection {...{ data, onChange, currentUser, highlightField, onNext, onPrev }} />
      )}
      {activeSection === 'preparation' && (
        <PreWorkSection {...{ data, onChange, currentUser, highlightField, onNext, onPrev }} />
      )}
      {activeSection === 'thermalProfile' && (
        <ThermalProfileSection {...{ data, onChange, currentUser, highlightField, onNext, onPrev }} />
      )}
      {activeSection === 'smtControl' && (
        <SmtControlSection {...{ data, onChange, currentUser, highlightField, onNext, onPrev }} />
      )}
      {activeSection === 'dipSpecialProcess' && (
        <DipSpecialProcessSection {...{ data, onChange, currentUser, highlightField, onNext, onPrev }} />
      )}
      {activeSection === 'trialReport' && (
        <TrialReportSection {...{ data, onChange, currentUser, highlightField, onNext, onPrev }} />
      )}
      {activeSection === 'documents' && (
        <DocumentsSection {...{ data, onChange, currentUser, highlightField, onNext, onPrev }} />
      )}
    </div>
  );
}

FormSections.propTypes = {
  data: PropTypes.object.isRequired,
  activeSection: PropTypes.string.isRequired,
  onChange: PropTypes.func.isRequired,
  onNext: PropTypes.func.isRequired,
  onPrev: PropTypes.func,
  currentUser: PropTypes.object,
  factories: PropTypes.arrayOf(PropTypes.string),
  highlightField: PropTypes.string,
};
