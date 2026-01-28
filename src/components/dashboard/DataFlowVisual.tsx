import { Users, ArrowRight, ShieldAlert, Pill, Syringe, BarChart3 } from 'lucide-react';

const DataFlowVisual = () => {
  const steps = [
    { icon: <Users className="w-5 h-5" />, label: 'Census', subtitle: 'Single Source of Truth' },
    { icon: <ShieldAlert className="w-5 h-5" />, label: 'IP Tracker', subtitle: 'Surveillance & Outbreaks' },
    { icon: <Pill className="w-5 h-5" />, label: 'ABT Tracker', subtitle: 'Stewardship & QAPI' },
    { icon: <Syringe className="w-5 h-5" />, label: 'VAX Tracker', subtitle: 'Vaccination Management' },
    { icon: <BarChart3 className="w-5 h-5" />, label: 'Reporting Hub', subtitle: 'Unified Analytics', highlight: true },
  ];

  return (
    <div className="flex flex-wrap justify-center items-center gap-2 py-4 bg-muted/50 rounded-lg border border-border overflow-x-auto">
      {steps.map((step, i) => (
        <div key={i} className="flex items-center gap-2">
          <div className="flow-step">
            <div className={`flow-step-icon ${step.highlight ? 'bg-success' : ''}`}>
              {step.icon}
            </div>
            <div className="font-semibold text-sm">{step.label}</div>
            <div className="text-xs text-muted-foreground">{step.subtitle}</div>
          </div>
          {i < steps.length - 1 && (
            <ArrowRight className="w-4 h-4 text-muted-foreground hidden md:block" />
          )}
        </div>
      ))}
    </div>
  );
};

export default DataFlowVisual;
