import { useState } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import type { CustomReportTemplate } from '@/lib/types';
import Step1_ReportType from './Step1_ReportType';
import Step2_DataSource from './Step2_DataSource';
import Step3_ColumnSelector from './Step3_ColumnSelector';
import Step4_PreviewSave from './Step4_PreviewSave';

interface ReportBuilderWizardProps {
  onClose: () => void;
  onSave: (template: CustomReportTemplate) => void;
}

export const ReportBuilderWizard = ({ onClose, onSave }: ReportBuilderWizardProps) => {
  const [currentStep, setCurrentStep] = useState(1);
  const [template, setTemplate] = useState<Partial<CustomReportTemplate>>({});

  const handleNext = () => setCurrentStep((step) => Math.min(4, step + 1));
  const handleBack = () => setCurrentStep((step) => Math.max(1, step - 1));

  return (
    <Dialog open onOpenChange={onClose}>
      <DialogContent className="max-w-5xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>🧙 Custom Report Builder</DialogTitle>
        </DialogHeader>

        <div className="mb-4 text-sm text-gray-600">Step {currentStep} of 4</div>

        <div className="min-h-[500px]">
          {currentStep === 1 && (
            <Step1_ReportType
              onSelect={(type) => {
                setTemplate({ ...template, category: type.category, dataSource: type.defaultDataSource });
                handleNext();
              }}
            />
          )}
          {currentStep === 2 && (
            <Step2_DataSource
              template={template}
              onUpdate={(updates) => setTemplate({ ...template, ...updates })}
              onNext={handleNext}
              onBack={handleBack}
            />
          )}
          {currentStep === 3 && (
            <Step3_ColumnSelector
              template={template}
              onUpdate={(columns) => setTemplate({ ...template, selectedColumns: columns })}
              onNext={handleNext}
              onBack={handleBack}
            />
          )}
          {currentStep === 4 && (
            <Step4_PreviewSave
              template={template as CustomReportTemplate}
              onSave={(finalTemplate) => {
                onSave(finalTemplate);
                onClose();
              }}
              onBack={handleBack}
            />
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
};

export default ReportBuilderWizard;
