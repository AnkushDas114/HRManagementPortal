import { SPFI } from '@pnp/sp';
import '@pnp/sp/webs';
import '@pnp/sp/lists';
import '@pnp/sp/items';
import { SalarySlip, Employee } from '../types';
import { formatDateIST, todayIST } from '../utils/dateTime';

const LIST_REF = 'SalarySlip';
const EMPLOYEE_LIST_NAME = 'EmployeeMaster';
const GUID_REGEX = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

const toNumber = (value: unknown): number => {
  if (value === null || value === undefined || value === '') return 0;
  const n = Number(value);
  return Number.isNaN(n) ? 0 : n;
};

const getErrorMessage = (error: unknown): string => {
  const e = error as any;
  return String(
    e?.data?.responseBody?.['odata.error']?.message?.value ||
    e?.data?.responseBody?.error?.message?.value ||
    e?.message ||
    error ||
    'Unknown error'
  );
};

const isFormatError = (error: unknown): boolean => /format/i.test(getErrorMessage(error));

const getSalarySlipList = (sp: SPFI) => {
  const ref = String(LIST_REF || '').trim();
  return GUID_REGEX.test(ref) ? sp.web.lists.getById(ref) : sp.web.lists.getByTitle(ref);
};

const buildPayrollKey = (slip: SalarySlip, employee?: Employee): string =>
  String(slip.payrollKey || `${employee?.name || 'Unknown'}-${slip.employeeId}-${slip.month}-${slip.year}`);

const buildPayload = (slip: SalarySlip, employee?: Employee): Record<string, unknown> => {
  return {
    Title: `SalarySlip_${slip.employeeId}_${slip.year}_${slip.month}`,
    Month: String(slip.month || ''),
    Year: String(slip.year || ''),
    YearlyCTC: toNumber(slip.yearlyCtc),
    MonthlyCTC: toNumber(slip.monthlyCtc),
    Basic: toNumber(slip.basic),
    HRA: toNumber(slip.hra),
    Allowances: toNumber(slip.allowances),
    Deductions: toNumber(slip.deductions),
    NetPay: toNumber(slip.netPay),
    Gross: toNumber(slip.gross),
    EmployerPF: toNumber(slip.employerPF),
    EmployeePF: toNumber(slip.employeePF),
    Bonus: toNumber(slip.bonus),
    Insurance: toNumber(slip.insurance),
    ESI: toNumber(slip.esi),
    EmployerESI: String(slip.employerEsi ?? ''),
    GeneratedDate: new Date().toISOString(),
    PayrollKey: buildPayrollKey(slip, employee),
    WorkingDays: toNumber(slip.workingDays),
    PaidDays: toNumber(slip.paidDays)
  };
};

const lookupTitle = (value: any): string => {
  if (!value) return '';
  if (typeof value === 'string') return value;
  if (typeof value === 'number') return String(value);
  return String(value.Title || value.LookupValue || value.Id || '');
};

const extractEmployeeIdFromRecord = (item: any): string => {
  const fromLookup = lookupTitle(item.EmployeeID);
  if (fromLookup && fromLookup !== '0') return fromLookup;

  const payrollKey = String(item.PayrollKey || '');
  if (payrollKey) {
    const parts = payrollKey.split('-').map((p: string) => p.trim()).filter(Boolean);
    if (parts.length >= 4) {
      const idToken = parts[parts.length - 3];
      if (idToken) return idToken;
    }
  }

  const title = String(item.Title || '');
  const titleMatch = title.match(/^SalarySlip_(.+?)_\d{4}_.+$/i);
  if (titleMatch?.[1]) return titleMatch[1].trim();

  const fromText = String(item.EmployeeIdText || item.EmployeeId || '').trim();
  if (fromText && fromText !== '0') return fromText;

  return String(item.EmployeeIDId || '').trim();
};

const mapItemToSalarySlip = (item: any): SalarySlip => {
  const resolvedEmployeeId = extractEmployeeIdFromRecord(item);

  return {
    id: String(item.Id),
    employeeId: resolvedEmployeeId || '',
    month: String(item.Month || ''),
    year: String(item.Year || ''),
    yearlyCtc: toNumber(item.YearlyCTC),
    monthlyCtc: toNumber(item.MonthlyCTC),
    basic: toNumber(item.Basic),
    hra: toNumber(item.HRA),
    allowances: toNumber(item.Allowances),
    deductions: toNumber(item.Deductions),
    netPay: toNumber(item.NetPay),
    gross: toNumber(item.Gross),
    employerPF: toNumber(item.EmployerPF),
    employeePF: toNumber(item.EmployeePF),
    bonus: toNumber(item.Bonus),
    insurance: toNumber(item.Insurance),
    esi: toNumber(item.ESI),
    employerEsi: toNumber(item.EmployerESI),
    payrollKey: String(item.PayrollKey || ''),
    slipPdfUrl: typeof item.SlipPdfUrl === 'string' ? item.SlipPdfUrl : String(item.SlipPdfUrl?.Url || ''),
    generatedDate: formatDateIST(item.GeneratedDate) || todayIST(),
    workingDays: toNumber(item.WorkingDays),
    paidDays: toNumber(item.PaidDays)
  };
};

const updateItemOneByOne = async (
  updateFn: (payload: Record<string, unknown>) => Promise<unknown>,
  payload: Record<string, unknown>
): Promise<void> => {
  const failed: string[] = [];
  for (const [key, value] of Object.entries(payload)) {
    if (value === undefined) continue;
    try {
      await updateFn({ [key]: value });
    } catch (error) {
      if (value !== null && typeof value !== 'string' && /Edm\.String/i.test(getErrorMessage(error))) {
        try {
          await updateFn({ [key]: String(value) });
          continue;
        } catch (stringRetryError) {
          failed.push(`${key}: ${getErrorMessage(stringRetryError)}`);
          continue;
        }
      }
      failed.push(`${key}: ${getErrorMessage(error)}`);
    }
  }
  if (failed.length) {
    throw new Error(`Failed to save some SalarySlip fields. ${failed.join(' | ')}`);
  }
};

const safeUpdate = async (
  updateFn: (payload: Record<string, unknown>) => Promise<unknown>,
  payload: Record<string, unknown>
): Promise<void> => {
  try {
    await updateFn(payload);
  } catch (error) {
    if (!isFormatError(error)) throw error;
    await updateItemOneByOne(updateFn, payload);
  }
};

const resolveEmployeeItemId = async (sp: SPFI, slip: SalarySlip, employee?: Employee): Promise<number | undefined> => {
  if (employee?.itemId) return employee.itemId;
  if (!slip.employeeId) return undefined;
  const matched = await sp.web.lists
    .getByTitle(EMPLOYEE_LIST_NAME)
    .items.select('Id', 'EmployeeID')
    .filter(`EmployeeID eq '${String(slip.employeeId).replace(/'/g, "''")}'`)
    .top(1)();
  return matched?.[0]?.Id as number | undefined;
};

export async function getAllSalarySlips(sp: SPFI): Promise<SalarySlip[]> {
  try {
    const items = await getSalarySlipList(sp).items
      .select(
        'Id',
        'Title',
        'Month',
        'Year',
        'YearlyCTC',
        'MonthlyCTC',
        'Basic',
        'HRA',
        'Allowances',
        'Deductions',
        'NetPay',
        'Gross',
        'EmployerPF',
        'EmployeePF',
        'Bonus',
        'Insurance',
        'ESI',
        'EmployerESI',
        'GeneratedDate',
        'PayrollKey',
        'SlipPdfUrl',
        'WorkingDays',
        'PaidDays',
        'EmployeeID/Title',
        'Employee/Title',
        'Employee/EmployeeID',
        'Employee/Email'
      )
      .expand('EmployeeID', 'Employee')
      .top(5000)();
    return items.map(mapItemToSalarySlip);
  } catch (error) {
    console.error('Failed to load salary slips:', error);
    return [];
  }
}

export async function createSalarySlip(sp: SPFI, slip: SalarySlip, employee?: Employee): Promise<void> {
  const employeeItemId = await resolveEmployeeItemId(sp, slip, employee);
  if (!employeeItemId) {
    throw new Error('Unable to save salary slip: Employee lookup id not found.');
  }

  const salaryList = getSalarySlipList(sp);
  const payload = buildPayload(slip, employee);
  const safePayrollKey = String(payload.PayrollKey || '').replace(/'/g, "''");
  const existing = safePayrollKey
    ? await salaryList.items.select('Id').filter(`PayrollKey eq '${safePayrollKey}'`).top(1)()
    : [];

  const lookupPayloads: Array<Record<string, unknown>> = [
    { EmployeeIDId: employeeItemId, EmployeeId: employeeItemId },
    { EmployeeIDId: { results: [employeeItemId] }, EmployeeId: { results: [employeeItemId] } },
    { EmployeeIDId: employeeItemId },
    { EmployeeId: employeeItemId }
  ];

  let targetId: number;
  if (existing.length) {
    targetId = Number(existing[0].Id);
    await safeUpdate((p) => salaryList.items.getById(targetId).update(p), payload);
  } else {
    try {
      const created = await salaryList.items.add(payload);
      targetId = Number(created?.data?.Id);
    } catch (error) {
      if (!isFormatError(error) && !/Edm\.String/i.test(getErrorMessage(error))) throw error;
      const createdMinimal = await salaryList.items.add({
        Title: String(payload.Title || `SalarySlip_${Date.now()}`),
        Month: String(payload.Month || ''),
        Year: String(payload.Year || ''),
        PayrollKey: String(payload.PayrollKey || '')
      });
      targetId = Number(createdMinimal?.data?.Id);
      const payloadWithoutBase = { ...payload };
      delete payloadWithoutBase.Title;
      delete payloadWithoutBase.Month;
      delete payloadWithoutBase.Year;
      delete payloadWithoutBase.PayrollKey;
      await safeUpdate((p) => salaryList.items.getById(targetId).update(p), payloadWithoutBase);
    }
  }

  let lookupUpdated = false;
  for (const lp of lookupPayloads) {
    try {
      await salaryList.items.getById(targetId).update(lp);
      lookupUpdated = true;
      break;
    } catch {
      // try next payload shape
    }
  }

  if (!lookupUpdated) {
    console.warn('Salary slip saved, but lookup field update did not succeed for any payload shape.');
  }
}

export async function updateSalarySlip(sp: SPFI, id: number, slip: Partial<SalarySlip>, employee?: Employee): Promise<void> {
  const payload: Record<string, unknown> = {
    Month: slip.month ? String(slip.month) : undefined,
    Year: slip.year ? String(slip.year) : undefined,
    YearlyCTC: slip.yearlyCtc,
    MonthlyCTC: slip.monthlyCtc,
    Basic: slip.basic,
    HRA: slip.hra,
    Allowances: slip.allowances,
    Deductions: slip.deductions,
    NetPay: slip.netPay,
    Gross: slip.gross,
    EmployerPF: slip.employerPF,
    EmployeePF: slip.employeePF,
    Bonus: slip.bonus,
    Insurance: slip.insurance,
    ESI: slip.esi,
    EmployerESI: slip.employerEsi !== undefined ? String(slip.employerEsi) : undefined,
    GeneratedDate: slip.generatedDate || new Date().toISOString(),
    PayrollKey: slip.payrollKey,
    WorkingDays: slip.workingDays,
    PaidDays: slip.paidDays
  };

  if (employee?.itemId) {
    payload.EmployeeId = employee.itemId;
    payload.EmployeeIDId = employee.itemId;
  }

  if (slip.slipPdfUrl) {
    payload.SlipPdfUrl = {
      Url: String(slip.slipPdfUrl),
      Description: 'Salary Slip'
    };
  }

  await safeUpdate((p) => getSalarySlipList(sp).items.getById(id).update(p), payload);
}

export async function deleteSalarySlip(sp: SPFI, id: number): Promise<void> {
  await getSalarySlipList(sp).items.getById(id).delete();
}
