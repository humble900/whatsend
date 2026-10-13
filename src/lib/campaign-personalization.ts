export type PersonalizationLead = { name?: string | null; phone: string; variables?: Record<string, string> | null };
export function contactVariables(metadata: Record<string, unknown> | null | undefined): Record<string, string> {
  return Object.fromEntries(Object.entries(metadata || {}).filter(([key, value]) => key.trim() && !key.trim().startsWith('_') && ['string', 'number', 'boolean'].includes(typeof value)).map(([key, value]) => [key.trim(), String(value)]));
}
export function leadVariables(lead: PersonalizationLead): Record<string, string> {
  const imported = contactVariables(lead.variables);
  const name = lead.name?.trim() || imported.name || '';
  const parts = name.split(/\s+/).filter(Boolean);
  return { ...imported, name, first_name: imported.first_name || parts[0] || '', last_name: imported.last_name || parts.slice(1).join(' '), phone: lead.phone };
}
export function templateVariables(text: string): string[] {
  return [...new Set(Array.from(text.matchAll(/\{\{([^{}]+)\}\}|(?<!\{)\{(name|first_name|last_name|phone)\}(?!\})/g), match => (match[1] || match[2]).trim()))];
}
export function missingVariables(text: string, values: Record<string, string>): string[] {
  return templateVariables(text).filter(key => !values[key]?.trim());
}
