import * as React from 'react';
import type { SPFI } from '@pnp/sp';
import '@pnp/sp/webs';
import '@pnp/sp/lists';
import '@pnp/sp/items';
import CommonTable, { ColumnDef } from '../ui/CommonTable';
import type { Employee, LeaveRequest } from '../types';
import { LeaveStatus } from '../types';

interface CarryForwardLeavesAdminProps {
  sp: SPFI;
  employees: Employee[];
  leaveRequests: LeaveRequest[];
  listId: string;
}

interface BalanceItem {
  Id: number;
  Title?: string;
  PolicyCode?: string;
  PeriodMonth?: string;
  Opening?: number;
  Accrued?: number;
  Used?: number;
  Adjusted?: number;
  Closing?: number;
  CarryForward?: number;
  IsLocked?: boolean;
  CalculatedOn?: string;
  EmployeeId?: number;
}

interface CarryForwardRow {
  itemId?: number;
  employeeLookupId?: number;
  employeeId: string;
  employeeName: string;
  department: string;
  policyCode: string;
  opening: number;
  allocated: number;
  used: number;
  adjusted: number;
  closing: number;
  carryForward: number;
  isLocked: boolean;
}

const DEFAULT_POLICY_CODE = 'DEFAULT';
const GUID_REGEX = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

const round2 = (value: number): number => Math.round((value + Number.EPSILON) * 100) / 100;
const parseNumberInput = (value: string): number => {
  const parsed = Number(value);
  return Number.isNaN(parsed) ? 0 : parsed;
};
const normalizeText = (value: unknown): string => String(value ?? '').trim().toLowerCase();

const toMonthKey = (date: Date): string => {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, '0');
  return `${y}-${m}`;
};

const firstDayOfMonth = (monthKey: string): Date => {
  const [year, month] = monthKey.split('-').map(Number);
  return new Date(year, (month || 1) - 1, 1, 12, 0, 0);
};

const toIsoDateString = (date: Date): string => {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, '0');
  const d = String(date.getDate()).padStart(2, '0');
  return `${y}-${m}-${d}`;
};

const parseDateSafe = (value: string): Date | undefined => {
  const raw = String(value || '').trim();
  if (!raw) return undefined;
  const parsed = new Date(raw);
  return Number.isNaN(parsed.getTime()) ? undefined : parsed;
};

const daysBetweenInclusive = (start: Date, end: Date): number => {
  const startUtc = Date.UTC(start.getFullYear(), start.getMonth(), start.getDate());
  const endUtc = Date.UTC(end.getFullYear(), end.getMonth(), end.getDate());
  return Math.floor((endUtc - startUtc) / (1000 * 60 * 60 * 24)) + 1;
};

const employeesMatch = (requestEmployee: Employee, employee: Employee): boolean => {
  if (normalizeText(requestEmployee.id) && normalizeText(requestEmployee.id) === normalizeText(employee.id)) return true;
  if (normalizeText(requestEmployee.email) && normalizeText(requestEmployee.email) === normalizeText(employee.email)) return true;
  if (normalizeText(requestEmployee.name) && normalizeText(requestEmployee.name) === normalizeText(employee.name)) return true;
  return false;
};

const calculateUsedDaysInMonth = (request: LeaveRequest, monthStart: Date, monthEnd: Date): number => {
  const start = parseDateSafe(request.startDate);
  const end = parseDateSafe(request.endDate) || start;
  if (!start || !end) return 0;
  if (end < monthStart || start > monthEnd) return 0;

  const overlapStart = start > monthStart ? start : monthStart;
  const overlapEnd = end < monthEnd ? end : monthEnd;
  if (overlapStart > overlapEnd) return 0;

  if (request.isHalfDay && daysBetweenInclusive(start, end) === 1) return 0.5;

  const totalSpanDays = Math.max(1, daysBetweenInclusive(start, end));
  const overlapDays = Math.max(0, daysBetweenInclusive(overlapStart, overlapEnd));
  const totalRequested = Math.max(0, Number(request.days || 0));
  return round2((totalRequested / totalSpanDays) * overlapDays);
};

const getList = (sp: SPFI, listRef: string) => (
  GUID_REGEX.test(String(listRef || '').trim())
    ? sp.web.lists.getById(listRef)
    : sp.web.lists.getByTitle(listRef || 'LeaveMonthlyBalance')
);

const itemMonthKey = (item: BalanceItem): string => {
  const parsed = parseDateSafe(String(item.PeriodMonth || ''));
  return parsed ? toMonthKey(parsed) : '';
};

const CarryForwardLeavesAdmin: React.FC<CarryForwardLeavesAdminProps> = ({ sp, employees, leaveRequests, listId }) => {
  const [selectedMonth, setSelectedMonth] = React.useState<string>(toMonthKey(new Date()));
  const [defaultMonthlyAccrual, setDefaultMonthlyAccrual] = React.useState<number>(1.5);
  const [isLoading, setIsLoading] = React.useState<boolean>(false);
  const [isSaving, setIsSaving] = React.useState<boolean>(false);
  const [manualEditMode, setManualEditMode] = React.useState<boolean>(false);
  const [error, setError] = React.useState<string>('');
  const [info, setInfo] = React.useState<string>('');
  const [allMonthEntries, setAllMonthEntries] = React.useState<BalanceItem[]>([]);
  const [rows, setRows] = React.useState<CarryForwardRow[]>([]);
  const [editableRows, setEditableRows] = React.useState<CarryForwardRow[]>([]);

  const loadEntries = React.useCallback(async (): Promise<void> => {
    if (!sp) return;
    setIsLoading(true);
    setError('');
    try {
      const items = await getList(sp, listId).items
        .select(
          'Id',
          'Title',
          'PolicyCode',
          'PeriodMonth',
          'Opening',
          'Accrued',
          'Used',
          'Adjusted',
          'Closing',
          'CarryForward',
          'IsLocked',
          'CalculatedOn',
          'EmployeeId'
        )
        .top(5000)() as BalanceItem[];
      setAllMonthEntries(items);
    } catch (err) {
      console.error('Failed to load LeaveMonthlyBalance data', err);
      setError('Failed to load carry-forward data from SharePoint.');
    } finally {
      setIsLoading(false);
    }
  }, [sp, listId]);

  React.useEffect(() => {
    loadEntries().catch(() => undefined);
  }, [loadEntries]);

  React.useEffect(() => {
    const monthStart = firstDayOfMonth(selectedMonth);
    const monthEnd = new Date(monthStart.getFullYear(), monthStart.getMonth() + 1, 0, 12, 0, 0);
    const prevMonthDate = new Date(monthStart.getFullYear(), monthStart.getMonth() - 1, 1, 12, 0, 0);
    const previousMonthKey = toMonthKey(prevMonthDate);

    const approvedPaidRequests = leaveRequests.filter((request) => {
      const isApproved = request.status === LeaveStatus.Approved;
      const isWfh = request.requestCategory === 'Work From Home' || /work\s*from\s*home|wfh/i.test(String(request.leaveType || ''));
      return isApproved && !isWfh;
    });

    const computedRows = [...employees]
      .sort((a, b) => String(a.name || '').localeCompare(String(b.name || '')))
      .map((employee) => {
        const currentMonthEntry = allMonthEntries.find((entry) =>
          itemMonthKey(entry) === selectedMonth &&
          (
            (entry.EmployeeId && employee.itemId && Number(entry.EmployeeId) === Number(employee.itemId)) ||
            normalizeText(entry.Title).indexOf(normalizeText(employee.id)) !== -1
          )
        );

        const previousMonthEntry = allMonthEntries.find((entry) =>
          itemMonthKey(entry) === previousMonthKey &&
          (
            (entry.EmployeeId && employee.itemId && Number(entry.EmployeeId) === Number(employee.itemId)) ||
            normalizeText(entry.Title).indexOf(normalizeText(employee.id)) !== -1
          )
        );

        const policyCode = String(currentMonthEntry?.PolicyCode || (employee as any).leavePolicyCode || DEFAULT_POLICY_CODE);
        const opening = round2(Number(currentMonthEntry?.Opening ?? previousMonthEntry?.CarryForward ?? 0));
        const allocated = round2(Number(currentMonthEntry?.Accrued ?? defaultMonthlyAccrual));
        const computedUsed = round2(approvedPaidRequests
          .filter((request) => employeesMatch(request.employee, employee))
          .reduce((sum, request) => sum + calculateUsedDaysInMonth(request, monthStart, monthEnd), 0));
        const used = round2(Number(currentMonthEntry?.Used ?? computedUsed));
        const adjusted = round2(Number(currentMonthEntry?.Adjusted ?? 0));
        const closing = round2(Number(currentMonthEntry?.Closing ?? (opening + allocated + adjusted - used)));
        const carryForward = round2(Number(currentMonthEntry?.CarryForward ?? closing));

        return {
          itemId: currentMonthEntry?.Id,
          employeeLookupId: employee.itemId,
          employeeId: employee.id,
          employeeName: employee.name,
          department: employee.department || '-',
          policyCode,
          opening,
          allocated,
          used,
          adjusted,
          closing,
          carryForward,
          isLocked: Boolean(currentMonthEntry?.IsLocked || false)
        } as CarryForwardRow;
      });

    setRows(computedRows);
    setEditableRows(computedRows);
  }, [employees, leaveRequests, selectedMonth, defaultMonthlyAccrual, allMonthEntries]);

  const resolveEmployeeLookupId = React.useCallback(async (row: CarryForwardRow): Promise<number | undefined> => {
    if (row.employeeLookupId) return row.employeeLookupId;
    const match = employees.find((employee) => normalizeText(employee.id) === normalizeText(row.employeeId));
    if (match?.itemId) return match.itemId;
    return undefined;
  }, [employees]);

  const handleSaveConfigAndSnapshot = async (): Promise<void> => {
    if (!sp) return;
    setIsSaving(true);
    setError('');
    setInfo('');

    try {
      const rowsToSave = manualEditMode ? editableRows : rows;
      const monthStart = firstDayOfMonth(selectedMonth);
      const monthDateText = `${toIsoDateString(monthStart)}T00:00:00Z`;
      const list = getList(sp, listId);

      for (const row of rowsToSave) {
        const employeeLookupId = await resolveEmployeeLookupId(row);
        if (!employeeLookupId) continue;

        const payload: Record<string, unknown> = {
          Title: `${row.employeeName} - ${selectedMonth}`,
          PolicyCode: String(row.policyCode || DEFAULT_POLICY_CODE),
          PeriodMonth: monthDateText,
          Opening: row.opening,
          Accrued: row.allocated,
          Used: row.used,
          Adjusted: row.adjusted,
          Closing: row.closing,
          CarryForward: row.carryForward,
          IsLocked: row.isLocked,
          CalculatedOn: new Date().toISOString(),
          EmployeeId: employeeLookupId
        };

        if (row.itemId) {
          await list.items.getById(row.itemId).update(payload);
        } else {
          const added = await list.items.add(payload);
          row.itemId = Number(added?.data?.Id || 0) || row.itemId;
        }
      }

      setInfo(`Carry-forward calculated and saved for ${selectedMonth}.`);
      await loadEntries();
    } catch (err) {
      console.error('Failed to save LeaveMonthlyBalance records', err);
      setError('Failed to save carry-forward records.');
    } finally {
      setIsSaving(false);
    }
  };

  const handleManualNumberChange = (employeeId: string, field: keyof CarryForwardRow, value: string): void => {
    setEditableRows((prev) => prev.map((row) => {
      if (row.employeeId !== employeeId) return row;
      const nextValue = round2(parseNumberInput(value));
      return { ...row, [field]: nextValue };
    }));
  };

  const handleManualTextChange = (employeeId: string, field: keyof CarryForwardRow, value: string): void => {
    setEditableRows((prev) => prev.map((row) => {
      if (row.employeeId !== employeeId) return row;
      return { ...row, [field]: String(value || '') };
    }));
  };

  const resetManualChanges = (): void => {
    setEditableRows(rows);
  };

  const columns = React.useMemo<ColumnDef<CarryForwardRow>[]>(() => ([
    { key: 'employeeName', header: 'Employee Name' },
    { key: 'employeeId', header: 'Employee Code/ID' },
    { key: 'department', header: 'Employee Department' },
    { key: 'policyCode', header: 'Leave Rule (Policy)' },
    { key: 'opening', header: 'Opening (Prev Month)', accessor: (row) => row.opening, render: (row) => row.opening.toFixed(2) },
    { key: 'allocated', header: 'Added This Month', accessor: (row) => row.allocated, render: (row) => row.allocated.toFixed(2) },
    { key: 'used', header: 'Used This Month', accessor: (row) => row.used, render: (row) => row.used.toFixed(2) },
    { key: 'adjusted', header: 'Manual Adj.', accessor: (row) => row.adjusted, render: (row) => row.adjusted.toFixed(2) },
    { key: 'closing', header: 'Month-End Balance', accessor: (row) => row.closing, render: (row) => row.closing.toFixed(2) },
    { key: 'carryForward', header: 'Carry to Next Month', accessor: (row) => row.carryForward, render: (row) => <span className="fw-bold">{row.carryForward.toFixed(2)}</span> }
  ]), []);

  return (
    <div className="card border-0 shadow-sm">
      <div className="card-header bg-white py-3 d-flex justify-content-between align-items-center flex-wrap gap-2">
        <h5 className="mb-0 fw-bold color-primary">Carry Forward Leaves</h5>
        <div className="d-flex align-items-center gap-2 flex-wrap">
          <label className="small text-muted mb-0">Month</label>
          <input
            type="month"
            className="form-control form-control-sm"
            style={{ width: '160px' }}
            value={selectedMonth}
            onChange={(e) => setSelectedMonth(e.target.value)}
          />
          <label className="small text-muted mb-0">Monthly Accrual</label>
          <input
            type="number"
            step="0.1"
            min="0"
            className="form-control form-control-sm"
            style={{ width: '110px' }}
            value={defaultMonthlyAccrual}
            onChange={(e) => setDefaultMonthlyAccrual(Number(e.target.value || 0))}
          />
          <button className="btn btn-sm btn-primary" onClick={handleSaveConfigAndSnapshot} disabled={isSaving || isLoading}>
            {isSaving ? 'Saving...' : 'Recalculate & Save'}
          </button>
          <button
            className={`btn btn-sm ${manualEditMode ? 'btn-warning' : 'btn-outline-secondary'}`}
            onClick={() => setManualEditMode((prev) => !prev)}
            disabled={isSaving || isLoading}
          >
            {manualEditMode ? 'Manual Edit: ON' : 'Manual Edit: OFF'}
          </button>
          {manualEditMode && (
            <button
              className="btn btn-sm btn-outline-dark"
              onClick={resetManualChanges}
              disabled={isSaving || isLoading}
            >
              Reset Manual Changes
            </button>
          )}
        </div>
      </div>
      <div className="card-body">
        <div className="small text-muted mb-3">
          Automatically tracks allocated, used, closing, and carry-forward leaves per employee for the selected month.
        </div>
        {error && <div className="alert alert-danger py-2">{error}</div>}
        {info && <div className="alert alert-success py-2">{info}</div>}
        {isLoading ? (
          <div className="text-center py-4">
            <div className="spinner-border text-primary" role="status">
              <span className="visually-hidden">Loading...</span>
            </div>
          </div>
        ) : manualEditMode ? (
          <div className="table-responsive">
            <table className="table table-hover align-middle mb-0">
              <thead className="table-light">
                <tr>
                  <th>Employee Name</th>
                  <th>Employee Code/ID</th>
                  <th>Employee Department</th>
                  <th>Leave Rule (Policy)</th>
                  <th>Opening (Prev Month)</th>
                  <th>Added This Month</th>
                  <th>Used This Month</th>
                  <th>Manual Adj.</th>
                  <th>Month-End Balance</th>
                  <th>Carry to Next Month</th>
                </tr>
              </thead>
              <tbody>
                {editableRows.map((row) => (
                  <tr key={`${row.employeeId}-${selectedMonth}`}>
                    <td>{row.employeeName}</td>
                    <td>{row.employeeId}</td>
                    <td>{row.department}</td>
                    <td>
                      <input
                        type="text"
                        className="form-control form-control-sm"
                        value={row.policyCode}
                        onChange={(e) => handleManualTextChange(row.employeeId, 'policyCode', e.target.value)}
                      />
                    </td>
                    <td>
                      <input type="number" step="0.1" className="form-control form-control-sm" value={row.opening} onChange={(e) => handleManualNumberChange(row.employeeId, 'opening', e.target.value)} />
                    </td>
                    <td>
                      <input type="number" step="0.1" className="form-control form-control-sm" value={row.allocated} onChange={(e) => handleManualNumberChange(row.employeeId, 'allocated', e.target.value)} />
                    </td>
                    <td>
                      <input type="number" step="0.1" className="form-control form-control-sm" value={row.used} onChange={(e) => handleManualNumberChange(row.employeeId, 'used', e.target.value)} />
                    </td>
                    <td>
                      <input type="number" step="0.1" className="form-control form-control-sm" value={row.adjusted} onChange={(e) => handleManualNumberChange(row.employeeId, 'adjusted', e.target.value)} />
                    </td>
                    <td>
                      <input type="number" step="0.1" className="form-control form-control-sm" value={row.closing} onChange={(e) => handleManualNumberChange(row.employeeId, 'closing', e.target.value)} />
                    </td>
                    <td>
                      <input type="number" step="0.1" className="form-control form-control-sm" value={row.carryForward} onChange={(e) => handleManualNumberChange(row.employeeId, 'carryForward', e.target.value)} />
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : (
          <CommonTable
            data={rows}
            columns={columns}
            getRowId={(row) => `${row.employeeId}-${selectedMonth}`}
            globalSearchPlaceholder="Search employee carry-forward"
          />
        )}
      </div>
    </div>
  );
};

export default CarryForwardLeavesAdmin;
