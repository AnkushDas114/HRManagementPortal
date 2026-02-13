import { SPFI } from '@pnp/sp';
import '@pnp/sp/webs';
import '@pnp/sp/lists';
import '@pnp/sp/items';
import '@pnp/sp/files';
import '@pnp/sp/folders';
import { SalarySlip, Employee } from '../types';
import { formatDateIST, todayIST } from '../utils/dateTime';

const LIST_NAME = 'SalarySlip';
const EMPLOYEE_LIST_NAME = 'EmployeeMaster';

const toNumber = (value: unknown): number => {
  if (value === null || value === undefined || value === '') return 0;
  const n = Number(value);
  return Number.isNaN(n) ? 0 : n;
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
  // PayrollKey format: EmployeeName-EmployeeID-Month-Year
  // Name may contain hyphens, so parse ID from the 3rd token from right.
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

  // Last fallback is lookup item id (not ideal for matching, but better than empty).
  const fromLookupId = String(item.EmployeeIDId || '').trim();
  return fromLookupId;
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

export async function getAllSalarySlips(sp: SPFI): Promise<SalarySlip[]> {
  try {
    const items = await sp.web.lists
      .getByTitle(LIST_NAME)
      .items
      .select(
        '*'
      )
      // .expand('EmployeeID', 'Employee')
      .top(5000)();
    console.log("salry slips", items);
    return items.map(mapItemToSalarySlip);
  } catch (error) {
    console.error('Failed to load salary slips:', error);
    return [];
  }
}

export async function createSalarySlip(sp: SPFI, slip: SalarySlip, employee?: Employee): Promise<void> {
  let employeeItemId = employee?.itemId;
  if (!employeeItemId && slip.employeeId) {
    try {
      const matched = await sp.web.lists
        .getByTitle(EMPLOYEE_LIST_NAME)
        .items.select('Id', 'EmployeeID')
        .filter(`EmployeeID eq '${String(slip.employeeId).replace(/'/g, "''")}'`)
        .top(1)();
      employeeItemId = matched?.[0]?.Id;
    } catch (error) {
      console.warn('Could not resolve EmployeeMaster item id for salary slip lookup.', error);
    }
  }

  if (!employeeItemId) {
    throw new Error('Unable to save salary slip: Employee lookup id not found.');
  }

  const fileName = `SalarySlip_${slip.employeeId}_${slip.year}_${slip.month}_${Date.now()}.json`;
  const fileContent = JSON.stringify({
    employeeId: slip.employeeId,
    month: slip.month,
    year: slip.year,
    yearlyCtc: slip.yearlyCtc,
    monthlyCtc: slip.monthlyCtc,
    basic: slip.basic,
    hra: slip.hra,
    allowances: slip.allowances,
    deductions: slip.deductions,
    netPay: slip.netPay,
    generatedDate: slip.generatedDate || todayIST(),
    workingDays: slip.workingDays,
    paidDays: slip.paidDays
  }, null, 2);

  const addResult = await sp.web.lists
    .getByTitle(LIST_NAME)
    .rootFolder.files.addUsingPath(fileName, fileContent, { Overwrite: true });

  const fileItem = await addResult.file.getItem();
  const defaultPayrollKey = `${employee?.name || 'Unknown'}-${slip.employeeId}-${slip.month}-${slip.year}`;

  const baseMetadataPayload: Record<string, unknown> = {
    Title: `SalarySlip_${slip.employeeId}_${slip.year}_${slip.month}`,
    Month: String(slip.month || ''),
    Year: String(slip.year || ''),
    YearlyCTC: slip.yearlyCtc || 0,
    MonthlyCTC: slip.monthlyCtc || 0,
    Basic: slip.basic || 0,
    HRA: slip.hra || 0,
    Allowances: slip.allowances || 0,
    Deductions: slip.deductions || 0,
    NetPay: slip.netPay || 0,
    Gross: slip.gross || 0,
    EmployerPF: slip.employerPF || 0,
    EmployeePF: slip.employeePF || 0,
    Bonus: slip.bonus || 0,
    Insurance: slip.insurance || 0,
    ESI: slip.esi || 0,
    GeneratedDate: new Date().toISOString(),
    PayrollKey: String(slip.payrollKey || defaultPayrollKey),
    WorkingDays: slip.workingDays || 0,
    PaidDays: slip.paidDays || 0
  };

  // NOTE:
  // We intentionally avoid setting SlipPdfUrl here due to tenant-specific URL field payload differences
  // that can throw InvalidClientQueryException in document libraries.
  // The uploaded file itself is the slip artifact.

  // Step 1: always save base fields first (never block upload for lookup shape mismatches)
  await fileItem.update(baseMetadataPayload);

  // Step 2: update lookup fields defensively with multiple payload shapes
  const lookupAttempts: Array<Record<string, unknown>> = [
    { EmployeeIDId: employeeItemId, EmployeeId: employeeItemId },
    { EmployeeIDId: { results: [employeeItemId] }, EmployeeId: { results: [employeeItemId] } },
    { EmployeeIDId: employeeItemId },
    { EmployeeId: employeeItemId },
    { EmployeeID: String(slip.employeeId || '') },
    { Employee: String(employee?.name || '') }
  ];

  for (const payload of lookupAttempts) {
    try {
      await fileItem.update(payload);
      break;
    } catch (error) {
      // keep trying alternate lookup payload shapes
      console.warn('SalarySlip lookup metadata update attempt failed.', error);
    }
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
    GeneratedDate: slip.generatedDate,
    PayrollKey: slip.payrollKey,
    WorkingDays: slip.workingDays,
    PaidDays: slip.paidDays
  };

  if (slip.slipPdfUrl) {
    payload.SlipPdfUrl = `${slip.slipPdfUrl}, Salary Slip PDF`;
  }

  if (employee?.itemId) {
    payload.EmployeeId = employee.itemId;
    payload.EmployeeIDId = employee.itemId;
  }

  await sp.web.lists.getByTitle(LIST_NAME).items.getById(id).update(payload);
}

export async function deleteSalarySlip(sp: SPFI, id: number): Promise<void> {
  await sp.web.lists.getByTitle(LIST_NAME).items.getById(id).delete();
}
