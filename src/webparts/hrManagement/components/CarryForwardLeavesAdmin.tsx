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

interface MetadataItem {
  Id: number;
  Title?: string;
  TaxType?: string;
  Leaves?: unknown;
  Configurations?: string;
  Date?: string;
}

interface SnapshotEntry {
  id: number;
  employeeId: string;
  monthKey: string;
  carryForward: number;
  policyCode: string;
}

interface CarryForwardRow {
  employeeId: string;
  employeeName: string;
  department: string;
  policyCode: string;
  opening: number;
  allocated: number;
  used: number;
  closing: number;
  carryForward: number;
}

const CARRY_FORWARD_CONFIG_TAXTYPE = 'CarryForwardConfig';
const CARRY_FORWARD_SNAPSHOT_TAXTYPE = 'CarryForwardLeaves';
const DEFAULT_POLICY_CODE = 'DEFAULT';

const toMonthKey = (date: Date): string => {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, '0');
  return `${y}-${m}`;
};

const firstDayOfMonth = (monthKey: string): Date => {
  const [year, month] = monthKey.split('-').map(Number);
  return new Date(year, (month || 1) - 1, 1, 12, 0, 0);
};

const lastDayOfMonth = (monthKey: string): Date => {
  const first = firstDayOfMonth(monthKey);
  return new Date(first.getFullYear(), first.getMonth() + 1, 0, 12, 0, 0);
};

const parseDateSafe = (value: string): Date | undefined => {
  const raw = String(value || '').trim();
  if (!raw) return undefined;
  if (/^\d{4}-\d{2}-\d{2}$/.test(raw)) {
    const [y, m, d] = raw.split('-').map(Number);
    const date = new Date(y, m - 1, d, 12, 0, 0);
    return Number.isNaN(date.getTime()) ? undefined : date;
  }
  const parsed = new Date(raw);
  return Number.isNaN(parsed.getTime()) ? undefined : parsed;
};

const daysBetweenInclusive = (start: Date, end: Date): number => {
  const startUtc = Date.UTC(start.getFullYear(), start.getMonth(), start.getDate());
  const endUtc = Date.UTC(end.getFullYear(), end.getMonth(), end.getDate());
  return Math.floor((endUtc - startUtc) / (1000 * 60 * 60 * 24)) + 1;
};

const round2 = (value: number): number => Math.round((value + Number.EPSILON) * 100) / 100;
const parseNumberInput = (value: string): number => {
  const parsed = Number(value);
  return Number.isNaN(parsed) ? 0 : parsed;
};

const normalizeText = (value: unknown): string => String(value ?? '').trim().toLowerCase();

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

  if (request.isHalfDay && daysBetweenInclusive(start, end) === 1) {
    return 0.5;
  }

  const totalSpanDays = Math.max(1, daysBetweenInclusive(start, end));
  const overlapDays = Math.max(0, daysBetweenInclusive(overlapStart, overlapEnd));
  const totalRequested = Math.max(0, Number(request.days || 0));
  return round2((totalRequested / totalSpanDays) * overlapDays);
};

const CarryForwardLeavesAdmin: React.FC<CarryForwardLeavesAdminProps> = ({ sp, employees, leaveRequests, listId }) => {
  const [selectedMonth, setSelectedMonth] = React.useState<string>(toMonthKey(new Date()));
  const [defaultMonthlyAccrual, setDefaultMonthlyAccrual] = React.useState<number>(1.5);
  const [isLoading, setIsLoading] = React.useState<boolean>(false);
  const [isSaving, setIsSaving] = React.useState<boolean>(false);
  const [manualEditMode, setManualEditMode] = React.useState<boolean>(false);
  const [error, setError] = React.useState<string>('');
  const [info, setInfo] = React.useState<string>('');
  const [snapshotEntries, setSnapshotEntries] = React.useState<SnapshotEntry[]>([]);
  const [rows, setRows] = React.useState<CarryForwardRow[]>([]);
  const [editableRows, setEditableRows] = React.useState<CarryForwardRow[]>([]);

  const loadMeta = React.useCallback(async (): Promise<void> => {
    if (!sp) return;
    setIsLoading(true);
    setError('');

    try {
      const items = await sp.web.lists
        .getById(listId)
        .items.select('Id', 'Title', 'TaxType', 'Leaves', 'Configurations')
        .top(5000)() as MetadataItem[];

      const configItems = items.filter((item) => String(item.TaxType || '') === CARRY_FORWARD_CONFIG_TAXTYPE);
      const snapshotItems = items.filter((item) => String(item.TaxType || '') === CARRY_FORWARD_SNAPSHOT_TAXTYPE);

      const defaultConfig = configItems.find((item) => String(item.Title || '').toUpperCase() === DEFAULT_POLICY_CODE);
      if (defaultConfig) {
        const n = Number(defaultConfig.Leaves);
        if (!Number.isNaN(n) && n > 0) setDefaultMonthlyAccrual(n);
      }

      const parsedSnapshots: SnapshotEntry[] = snapshotItems
        .map((item) => {
          try {
            const payload = JSON.parse(String(item.Configurations || '{}'));
            const employeeId = String(payload.employeeId || '').trim();
            const monthKey = String(payload.monthKey || '').trim();
            const carryForward = Number(payload.carryForward);
            const policyCode = String(payload.policyCode || DEFAULT_POLICY_CODE);
            if (!employeeId || !monthKey) return null;
            return {
              id: Number(item.Id),
              employeeId,
              monthKey,
              carryForward: Number.isNaN(carryForward) ? 0 : carryForward,
              policyCode
            } as SnapshotEntry;
          } catch {
            return null;
          }
        })
        .filter((entry: SnapshotEntry | null): entry is SnapshotEntry => !!entry);

      setSnapshotEntries(parsedSnapshots);
    } catch (err) {
      console.error('Failed to load carry-forward metadata', err);
      setError('Failed to load carry-forward data from SharePoint.');
    } finally {
      setIsLoading(false);
    }
  }, [sp, listId]);

  React.useEffect(() => {
    loadMeta().catch(() => undefined);
  }, [loadMeta]);

  React.useEffect(() => {
    const monthStart = firstDayOfMonth(selectedMonth);
    const monthEnd = lastDayOfMonth(selectedMonth);
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
        const policyCode = String((employee as any).leavePolicyCode || DEFAULT_POLICY_CODE).trim() || DEFAULT_POLICY_CODE;
        const previousSnapshot = snapshotEntries.find((entry) =>
          normalizeText(entry.employeeId) === normalizeText(employee.id) &&
          entry.monthKey === previousMonthKey &&
          normalizeText(entry.policyCode) === normalizeText(policyCode)
        );

        const opening = round2(previousSnapshot?.carryForward || 0);
        const allocated = round2(defaultMonthlyAccrual);
        const used = round2(approvedPaidRequests
          .filter((request) => employeesMatch(request.employee, employee))
          .reduce((sum, request) => sum + calculateUsedDaysInMonth(request, monthStart, monthEnd), 0));
        const closing = round2(opening + allocated - used);

        return {
          employeeId: employee.id,
          employeeName: employee.name,
          department: employee.department || '-',
          policyCode,
          opening,
          allocated,
          used,
          closing,
          carryForward: closing
        } as CarryForwardRow;
      });

    setRows(computedRows);
    setEditableRows(computedRows);
  }, [employees, leaveRequests, selectedMonth, defaultMonthlyAccrual, snapshotEntries]);

  const handleSaveConfigAndSnapshot = async (): Promise<void> => {
    if (!sp) return;
    setIsSaving(true);
    setError('');
    setInfo('');

    try {
      const rowsToSave = manualEditMode ? editableRows : rows;

      const allItems = await sp.web.lists
        .getById(listId)
        .items.select('Id', 'Title', 'TaxType', 'Leaves', 'Configurations', 'Date')
        .top(5000)() as MetadataItem[];

      const configItems = allItems.filter((item) => String(item.TaxType || '') === CARRY_FORWARD_CONFIG_TAXTYPE);
      const snapshotItems = allItems.filter((item) => String(item.TaxType || '') === CARRY_FORWARD_SNAPSHOT_TAXTYPE);

      const defaultConfig = configItems.find((item) => String(item.Title || '').toUpperCase() === DEFAULT_POLICY_CODE);
      if (defaultConfig) {
        await sp.web.lists.getById(listId).items.getById(defaultConfig.Id).update({
          Leaves: defaultMonthlyAccrual,
          TaxType: CARRY_FORWARD_CONFIG_TAXTYPE,
          Title: DEFAULT_POLICY_CODE,
          Configurations: JSON.stringify({ policyCode: DEFAULT_POLICY_CODE, monthlyAccrual: defaultMonthlyAccrual })
        });
      } else {
        await sp.web.lists.getById(listId).items.add({
          Title: DEFAULT_POLICY_CODE,
          TaxType: CARRY_FORWARD_CONFIG_TAXTYPE,
          Leaves: defaultMonthlyAccrual,
          Configurations: JSON.stringify({ policyCode: DEFAULT_POLICY_CODE, monthlyAccrual: defaultMonthlyAccrual })
        });
      }

      for (const row of rowsToSave) {
        const existing = snapshotItems.find((item) => {
          try {
            const payload = JSON.parse(String(item.Configurations || '{}'));
            return normalizeText(payload.employeeId) === normalizeText(row.employeeId) && String(payload.monthKey || '') === selectedMonth;
          } catch {
            return false;
          }
        });

        const payload = {
          Title: `${row.employeeName} - ${selectedMonth}`,
          TaxType: CARRY_FORWARD_SNAPSHOT_TAXTYPE,
          Date: `${selectedMonth}-01`,
          Leaves: row.carryForward,
          Configurations: JSON.stringify({
            employeeId: row.employeeId,
            employeeName: row.employeeName,
            department: row.department,
            policyCode: row.policyCode,
            monthKey: selectedMonth,
            opening: row.opening,
            allocated: row.allocated,
            used: row.used,
            closing: row.closing,
            carryForward: row.carryForward,
            isManualEdited: manualEditMode
          })
        };

        if (existing) {
          await sp.web.lists.getById(listId).items.getById(existing.Id).update(payload);
        } else {
          await sp.web.lists.getById(listId).items.add(payload);
        }
      }

      setInfo(`Carry-forward calculated and saved for ${selectedMonth}.`);
      await loadMeta();
    } catch (err) {
      console.error('Failed to save carry-forward records', err);
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
                      <input
                        type="number"
                        step="0.1"
                        className="form-control form-control-sm"
                        value={row.opening}
                        onChange={(e) => handleManualNumberChange(row.employeeId, 'opening', e.target.value)}
                      />
                    </td>
                    <td>
                      <input
                        type="number"
                        step="0.1"
                        className="form-control form-control-sm"
                        value={row.allocated}
                        onChange={(e) => handleManualNumberChange(row.employeeId, 'allocated', e.target.value)}
                      />
                    </td>
                    <td>
                      <input
                        type="number"
                        step="0.1"
                        className="form-control form-control-sm"
                        value={row.used}
                        onChange={(e) => handleManualNumberChange(row.employeeId, 'used', e.target.value)}
                      />
                    </td>
                    <td>
                      <input
                        type="number"
                        step="0.1"
                        className="form-control form-control-sm"
                        value={row.closing}
                        onChange={(e) => handleManualNumberChange(row.employeeId, 'closing', e.target.value)}
                      />
                    </td>
                    <td>
                      <input
                        type="number"
                        step="0.1"
                        className="form-control form-control-sm"
                        value={row.carryForward}
                        onChange={(e) => handleManualNumberChange(row.employeeId, 'carryForward', e.target.value)}
                      />
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
