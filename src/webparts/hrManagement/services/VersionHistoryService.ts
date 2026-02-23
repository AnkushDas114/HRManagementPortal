import type { SPFI } from '@pnp/sp';
import '@pnp/sp/webs';
import '@pnp/sp/lists';
import '@pnp/sp/items';

export interface VersionHistoryEntry {
  versionLabel: string;
  modifiedAt: string;
  modifiedBy: string;
  changes: string[];
  isCurrent: boolean;
}

const IGNORED_KEYS = new Set<string>([
  'id',
  'guid',
  'guidstring',
  'metainfo',
  'fileref',
  'filedirref',
  'fileleafref',
  'file_x0020_type',
  'modified',
  'created',
  'editor',
  'author',
  'editorid',
  'authorid',
  'versionlabel',
  'iscurrentversion',
  'odata__uiversionstring',
  'owshiddenversion',
  '__metadata'
]);

const normalizeValue = (value: unknown): string => {
  if (value === null || value === undefined) return '';
  if (typeof value === 'string') return value.trim();
  if (typeof value === 'number' || typeof value === 'boolean') return String(value);
  if (value instanceof Date) return value.toISOString();
  if (Array.isArray(value)) return value.map((entry) => normalizeValue(entry)).join(', ');
  if (typeof value === 'object') {
    const candidate = value as { Title?: string; Name?: string; LookupValue?: string };
    if (candidate.Title) return String(candidate.Title).trim();
    if (candidate.Name) return String(candidate.Name).trim();
    if (candidate.LookupValue) return String(candidate.LookupValue).trim();
    return '';
  }
  return String(value);
};

const shouldIgnoreField = (fieldName: string): boolean => {
  const key = String(fieldName || '').trim();
  const lower = key.toLowerCase();
  if (!lower) return true;
  if (IGNORED_KEYS.has(lower)) return true;
  if (lower.startsWith('_') || lower.startsWith('@odata') || lower.startsWith('odata.')) return true;
  if (lower.startsWith('odata__x005f_') || lower.startsWith('odata__')) return true;
  if (lower.endsWith('id') && !lower.endsWith('employeeid') && !lower.endsWith('referenceid')) return true;
  return false;
};

const humanizeFieldName = (fieldName: string): string => {
  const withSpaces = String(fieldName || '')
    .replace(/_x[0-9a-f]{4}_/gi, ' ')
    .replace(/_/g, ' ')
    .replace(/([a-z])([A-Z])/g, '$1 $2')
    .replace(/\s+/g, ' ')
    .trim();
  if (!withSpaces) return '-';
  return withSpaces.charAt(0).toUpperCase() + withSpaces.slice(1);
};

const toComparableMap = (version: Record<string, unknown>): Record<string, string> => {
  const mapped: Record<string, string> = {};
  Object.keys(version).forEach((key) => {
    if (shouldIgnoreField(key)) return;
    const normalized = normalizeValue(version[key]);
    if (normalized === '') return;
    mapped[key] = normalized;
  });
  return mapped;
};

const humanizeChange = (fieldName: string, previous: string, current: string): string => {
  const shortPrev = previous.length > 90 ? `${previous.slice(0, 87)}...` : previous;
  const shortCurr = current.length > 90 ? `${current.slice(0, 87)}...` : current;
  return `${humanizeFieldName(fieldName)}: ${shortPrev} -> ${shortCurr}`;
};

const buildChanges = (current: Record<string, unknown>, previous?: Record<string, unknown>): string[] => {
  if (!previous) return ['Initial version'];
  const currentMap = toComparableMap(current);
  const previousMap = toComparableMap(previous);
  const fields = new Set([...Object.keys(currentMap), ...Object.keys(previousMap)]);
  const changes: string[] = [];
  fields.forEach((field) => {
    const oldValue = previousMap[field] || '';
    const newValue = currentMap[field] || '';
    if (oldValue === newValue) return;
    changes.push(humanizeChange(field, oldValue, newValue));
  });
  if (!changes.length) return ['No field-level difference available'];
  return changes.slice(0, 8);
};

export const getItemVersionHistory = async (
  sp: SPFI,
  listTitle: string,
  itemId: number
): Promise<VersionHistoryEntry[]> => {
  const versions = await sp.web.lists.getByTitle(listTitle).items.getById(itemId).versions();
  const ordered = [...(versions as Record<string, unknown>[])].sort((a, b) => {
    const dateA = new Date(String(a.Created || a.Modified || 0)).getTime();
    const dateB = new Date(String(b.Created || b.Modified || 0)).getTime();
    return dateB - dateA;
  });

  return ordered.map((version, index) => {
    const previous = ordered[index + 1];
    const editorObj = version.Editor as { Title?: string; LookupValue?: string } | undefined;
    const label = String(version.VersionLabel || version.OData__UIVersionString || `v${index + 1}`);

    return {
      versionLabel: label,
      modifiedAt: String(version.Created || version.Modified || ''),
      modifiedBy: String(editorObj?.Title || editorObj?.LookupValue || version.EditorId || 'Unknown'),
      changes: buildChanges(version, previous),
      isCurrent: index === 0
    };
  });
};
