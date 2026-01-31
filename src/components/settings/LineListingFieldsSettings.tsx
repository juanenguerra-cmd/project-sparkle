import { useState, useEffect } from 'react';
import { Plus, Trash2, GripVertical, Save, RotateCcw } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Checkbox } from '@/components/ui/checkbox';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Badge } from '@/components/ui/badge';
import { toast } from 'sonner';
import { 
  ALL_TEMPLATES, 
  type LineListingFieldConfig,
  type CustomLineListingConfig 
} from '@/lib/lineListingTemplates';

interface LineListingFieldsSettingsProps {
  customConfigs: Record<string, CustomLineListingConfig>;
  onSave: (configs: Record<string, CustomLineListingConfig>) => void;
}

const CATEGORY_LABELS: Record<string, string> = {
  demographics: 'Demographics',
  vaccines: 'Vaccinations',
  predisposing: 'Predisposing Factors',
  symptoms: 'Symptoms',
  outcomes: 'Outcomes',
  other: 'Other',
};

const LineListingFieldsSettings = ({ customConfigs, onSave }: LineListingFieldsSettingsProps) => {
  const [configs, setConfigs] = useState<Record<string, CustomLineListingConfig>>(customConfigs);
  const [activeTemplate, setActiveTemplate] = useState(ALL_TEMPLATES[0].id);
  const [newFieldName, setNewFieldName] = useState('');
  const [newFieldType, setNewFieldType] = useState<'text' | 'checkbox' | 'date'>('text');

  useEffect(() => {
    setConfigs(customConfigs);
  }, [customConfigs]);

  const getConfigForTemplate = (templateId: string): CustomLineListingConfig => {
    if (configs[templateId]) {
      return configs[templateId];
    }
    const template = ALL_TEMPLATES.find(t => t.id === templateId);
    return {
      templateId,
      enabledFields: template?.fields.filter(f => f.defaultEnabled).map(f => f.id) || [],
      customFields: [],
    };
  };

  const updateConfig = (templateId: string, updates: Partial<CustomLineListingConfig>) => {
    setConfigs(prev => ({
      ...prev,
      [templateId]: {
        ...getConfigForTemplate(templateId),
        ...updates,
      },
    }));
  };

  const toggleField = (templateId: string, fieldId: string) => {
    const config = getConfigForTemplate(templateId);
    const enabled = config.enabledFields.includes(fieldId);
    updateConfig(templateId, {
      enabledFields: enabled
        ? config.enabledFields.filter(id => id !== fieldId)
        : [...config.enabledFields, fieldId],
    });
  };

  const addCustomField = (templateId: string) => {
    if (!newFieldName.trim()) {
      toast.error('Please enter a field name');
      return;
    }

    const config = getConfigForTemplate(templateId);
    const fieldId = `custom_${Date.now()}`;
    const newField: LineListingFieldConfig = {
      id: fieldId,
      label: newFieldName.trim(),
      shortLabel: newFieldName.trim().slice(0, 10),
      type: newFieldType,
      category: 'other',
      defaultEnabled: true,
    };

    updateConfig(templateId, {
      customFields: [...(config.customFields || []), newField],
      enabledFields: [...config.enabledFields, fieldId],
    });

    setNewFieldName('');
    toast.success(`Added custom field: ${newFieldName}`);
  };

  const removeCustomField = (templateId: string, fieldId: string) => {
    const config = getConfigForTemplate(templateId);
    updateConfig(templateId, {
      customFields: (config.customFields || []).filter(f => f.id !== fieldId),
      enabledFields: config.enabledFields.filter(id => id !== fieldId),
    });
  };

  const resetToDefaults = (templateId: string) => {
    const template = ALL_TEMPLATES.find(t => t.id === templateId);
    if (template) {
      updateConfig(templateId, {
        enabledFields: template.fields.filter(f => f.defaultEnabled).map(f => f.id),
        customFields: [],
      });
      toast.success('Reset to default fields');
    }
  };

  const handleSave = () => {
    onSave(configs);
    toast.success('Line listing field configurations saved');
  };

  const currentTemplate = ALL_TEMPLATES.find(t => t.id === activeTemplate);
  const currentConfig = getConfigForTemplate(activeTemplate);

  // Group fields by category
  const groupedFields: Record<string, LineListingFieldConfig[]> = {};
  currentTemplate?.fields.forEach(field => {
    const cat = field.category || 'other';
    if (!groupedFields[cat]) groupedFields[cat] = [];
    groupedFields[cat].push(field);
  });

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h3 className="text-lg font-semibold">Line Listing Form Fields</h3>
          <p className="text-sm text-muted-foreground">
            Customize which fields appear on each outbreak type form and report
          </p>
        </div>
        <Button size="sm" onClick={handleSave}>
          <Save className="w-4 h-4 mr-2" />
          Save Changes
        </Button>
      </div>

      <Tabs value={activeTemplate} onValueChange={setActiveTemplate}>
        <TabsList className="w-full justify-start flex-wrap h-auto">
          {ALL_TEMPLATES.map(template => (
            <TabsTrigger key={template.id} value={template.id} className="text-xs">
              {template.name}
            </TabsTrigger>
          ))}
        </TabsList>

        {ALL_TEMPLATES.map(template => (
          <TabsContent key={template.id} value={template.id} className="mt-4">
            <div className="border rounded-lg p-4 space-y-4">
              <div className="flex items-center justify-between">
                <h4 className="font-medium">{template.name} Fields</h4>
                <Button 
                  variant="outline" 
                  size="sm"
                  onClick={() => resetToDefaults(template.id)}
                >
                  <RotateCcw className="w-4 h-4 mr-2" />
                  Reset to Defaults
                </Button>
              </div>

              <ScrollArea className="h-64">
                <div className="space-y-4 pr-4">
                  {Object.entries(groupedFields).map(([category, fields]) => (
                    <div key={category}>
                      <h5 className="text-sm font-medium text-muted-foreground mb-2">
                        {CATEGORY_LABELS[category] || category}
                      </h5>
                      <div className="grid grid-cols-2 md:grid-cols-3 gap-2">
                        {fields.map(field => (
                          <label
                            key={field.id}
                            className="flex items-center gap-2 p-2 rounded border cursor-pointer hover:bg-muted/50"
                          >
                            <Checkbox
                              checked={currentConfig.enabledFields.includes(field.id)}
                              onCheckedChange={() => toggleField(template.id, field.id)}
                            />
                            <span className="text-sm">{field.label}</span>
                            <Badge variant="outline" className="text-xs ml-auto">
                              {field.type}
                            </Badge>
                          </label>
                        ))}
                      </div>
                    </div>
                  ))}

                  {/* Custom Fields */}
                  {currentConfig.customFields && currentConfig.customFields.length > 0 && (
                    <div>
                      <h5 className="text-sm font-medium text-muted-foreground mb-2">
                        Custom Fields
                      </h5>
                      <div className="space-y-2">
                        {currentConfig.customFields.map(field => (
                          <div 
                            key={field.id} 
                            className="flex items-center gap-2 p-2 rounded border bg-muted/30"
                          >
                            <GripVertical className="w-4 h-4 text-muted-foreground" />
                            <Checkbox
                              checked={currentConfig.enabledFields.includes(field.id)}
                              onCheckedChange={() => toggleField(template.id, field.id)}
                            />
                            <span className="text-sm flex-1">{field.label}</span>
                            <Badge variant="outline" className="text-xs">
                              {field.type}
                            </Badge>
                            <Button
                              variant="ghost"
                              size="sm"
                              onClick={() => removeCustomField(template.id, field.id)}
                            >
                              <Trash2 className="w-4 h-4" />
                            </Button>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}
                </div>
              </ScrollArea>

              {/* Add Custom Field */}
              <div className="pt-4 border-t">
                <Label className="text-sm font-medium">Add Custom Field</Label>
                <div className="flex gap-2 mt-2">
                  <Input
                    placeholder="Field name"
                    value={newFieldName}
                    onChange={(e) => setNewFieldName(e.target.value)}
                    className="flex-1"
                  />
                  <Select value={newFieldType} onValueChange={(v) => setNewFieldType(v as 'text' | 'checkbox' | 'date')}>
                    <SelectTrigger className="w-28">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="text">Text</SelectItem>
                      <SelectItem value="checkbox">Checkbox</SelectItem>
                      <SelectItem value="date">Date</SelectItem>
                    </SelectContent>
                  </Select>
                  <Button onClick={() => addCustomField(template.id)}>
                    <Plus className="w-4 h-4" />
                  </Button>
                </div>
              </div>
            </div>
          </TabsContent>
        ))}
      </Tabs>
    </div>
  );
};

export default LineListingFieldsSettings;
