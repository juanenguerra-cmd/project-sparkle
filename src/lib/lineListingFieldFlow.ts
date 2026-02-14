import type { LineListingFieldConfig } from '@/lib/lineListingTemplates';

/**
 * Fields managed by the core line-listing record and shown in dedicated UI inputs.
 * We exclude these from template-driven rendering to avoid duplicate entry points
 * that can make data appear to be saved in a different location.
 */
export const CORE_LINE_LISTING_FIELD_IDS = new Set(['unit', 'labResults']);

export const filterTemplateManagedFields = (
  fields: LineListingFieldConfig[],
): LineListingFieldConfig[] => fields.filter((field) => !CORE_LINE_LISTING_FIELD_IDS.has(field.id));

export const stripCoreFieldsFromTemplateData = (
  templateData: Record<string, string | number | boolean | undefined>,
): Record<string, string | number | boolean | undefined> =>
  Object.fromEntries(
    Object.entries(templateData).filter(([fieldId]) => !CORE_LINE_LISTING_FIELD_IDS.has(fieldId)),
  );

