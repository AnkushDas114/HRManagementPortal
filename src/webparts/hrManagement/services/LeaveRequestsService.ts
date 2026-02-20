import { SPFI } from '@pnp/sp';
import '@pnp/sp/webs';
import '@pnp/sp/lists';
import '@pnp/sp/items';
import type { LeaveRequest, Employee } from '../types';
import { LeaveStatus } from '../types';
import { formatDateIST, nowISTISOString, todayIST } from '../utils/dateTime';

// const LEAVE_REQUESTS_LIST_TITLE = 'Leave Request';
const EMPLOYEE_MASTER_LIST_TITLE = 'EmployeeMaster';

/**
 * GET: Load all leave requests from SharePoint
 */
export async function getAllLeaveRequests(sp: SPFI, employees: Employee[]): Promise<LeaveRequest[]> {
    try {
        const items = await sp.web.lists
            .getByTitle('Leave Request')
            .items
            .select(
                'Id',
                'Title',
                'LeaveType',
                'Startdate',
                'Enddate',
                'Days',
                'Reason',
                'Status',
                'SubmittedAt',
                'ApprovedAt',
                'Created',
                'ApproverName',
                'ApproverComment',
                'LeaveData',
                'DeductedDays',
                'IsCountedInCarryForward',
                // 'EmployeeLookup/Id',
                'EmployeeLookup/Title',
                'EmployeeLookup/Email',
                'EmployeeLookup/EmployeeID',

            )
            .expand('EmployeeLookup')
            .top(500)();

        console.log('Leave Requests loaded from SharePoint:', items);

        return items.map((item: any) => mapItemToLeaveRequest(item, employees));
    } catch (error) {
        console.error('Error loading leave requests:', error);
        throw error;
    }
}

/**
 * POST: Create a new leave request
 */
export async function createLeaveRequest(
    sp: SPFI,
    employee: Employee,
    formData: any,
    days: number
): Promise<void> {
    try {
        const employeeLookupId = await getEmployeeLookupId(sp, employee);
        if (!employeeLookupId) {
            throw new Error('Employee lookup id not found in EmployeeMaster.');
        }

        // Prepare LeaveData JSON
        const leaveData: any = {
            isHalfDay: formData.isHalfDay || false,
            halfDayType: formData.halfDayType || null,
            isRecurring: formData.isRecurring || false,
            requestCategory: formData.requestCategory || 'Leave'
        };

        // Add recurrence data if recurring
        if (formData.isRecurring) {
            leaveData.recurrence = {
                frequency: formData.recurringFrequency,
                pattern: buildRecurrencePattern(formData),
                range: buildRecurrenceRange(formData)
            };
        }

        // Create item in SharePoint
        await sp.web.lists
            .getByTitle('Leave Request')
            .items.add({
                Title: `${formData.leaveType} - ${formData.startDate}`,
                LeaveType: formData.leaveType,
                Startdate: formData.startDate,
                Enddate: formData.isHalfDay ? formData.startDate : formData.endDate,
                Days: days,
                Reason: formData.reason,
                Status: 'Pending',
                SubmittedAt: nowISTISOString(),
                EmployeeLookupId: employeeLookupId,
                ApproverName: null,
                ApproverComment: null,
                ApprovedAt: null,
                LeaveData: JSON.stringify(leaveData)
            });

        console.log('Leave request created successfully');
    } catch (error) {
        console.error('Error creating leave request:', error);
        throw error;
    }
}

/**
 * PUT: Update leave request status (Approve/Reject)
 */
export async function updateLeaveRequestStatus(
    sp: SPFI,
    requestId: number,
    status: LeaveStatus,
    approverName: string,
    comment: string
): Promise<void> {
    try {
        const updateData: any = {
            Status: status,
            ApproverName: status === LeaveStatus.Pending ? null : approverName,
            ApproverComment: status === LeaveStatus.Pending ? null : comment,
        };

        if (status !== LeaveStatus.Pending) {
            updateData.ApprovedAt = nowISTISOString();
        }

        await sp.web.lists
            .getByTitle('Leave Request').items.getById(requestId)
            .update(updateData);

        console.log('Leave request status updated successfully');
    } catch (error) {
        console.error('Error updating leave request status:', error);
        throw error;
    }
}

/**
 * DELETE: Delete a leave request
 */
export async function deleteLeaveRequest(sp: SPFI, requestId: number): Promise<void> {
    try {
        await sp.web.lists
            .getByTitle('Leave Request')
            .items.getById(requestId)
            .delete();

        console.log('Leave request deleted successfully');
    } catch (error) {
        console.error('Error deleting leave request:', error);
        throw error;
    }
}

/**
 * Helper: Resolve EmployeeMaster lookup id for leave request
 */
async function getEmployeeLookupId(sp: SPFI, employee: Employee): Promise<number | null> {
    try {
        if (employee.itemId) {
            return employee.itemId;
        }

        const escapedEmpId = String(employee.id || '').replace(/'/g, "''");
        const escapedEmail = String(employee.email || '').replace(/'/g, "''");
        const escapedName = String(employee.name || '').replace(/'/g, "''");

        const filters: string[] = [];
        if (escapedEmpId) filters.push(`EmployeeID eq '${escapedEmpId}'`);
        if (escapedEmail) filters.push(`Email eq '${escapedEmail}'`);
        if (escapedName) filters.push(`Title eq '${escapedName}'`);

        if (!filters.length) return null;

        for (const filter of filters) {
            const items = await sp.web.lists
                .getByTitle(EMPLOYEE_MASTER_LIST_TITLE)
                .items
                .select('Id')
                .filter(filter)
                .top(1)();
            if (items.length > 0) return items[0].Id;
        }

        return null;
    } catch (error) {
        console.error('Error resolving employee lookup id:', error);
        return null;
    }
}

/**
 * Helper: Build recurrence pattern based on frequency
 */
function buildRecurrencePattern(formData: any): any {
    switch (formData.recurringFrequency) {
        case 'Daily':
            return {
                interval: formData.dailyInterval || 1,
                weekdaysOnly: formData.dailyWeekdaysOnly || false
            };

        case 'Weekly':
            return {
                interval: formData.weeklyInterval || 1,
                daysOfWeek: formData.weeklyDays || []
            };

        case 'Monthly':
            if (formData.monthlyPattern === 'day') {
                return {
                    type: 'day',
                    dayOfMonth: formData.monthlyDay || 1,
                    interval: formData.monthlyInterval || 1
                };
            } else {
                return {
                    type: 'the',
                    weekNumber: formData.monthlyWeekNumber || 'first',
                    dayOfWeek: formData.monthlyWeekDay || 'Monday',
                    interval: formData.monthlyIntervalThe || 1
                };
            }

        case 'Yearly':
            if (formData.yearlyPattern === 'every') {
                return {
                    type: 'every',
                    month: formData.yearlyMonth || 'January',
                    dayOfMonth: formData.yearlyInterval || 1
                };
            } else {
                return {
                    type: 'the',
                    weekNumber: formData.yearlyWeekNumber || 'first',
                    dayOfWeek: formData.yearlyWeekDay || 'Monday',
                    month: formData.yearlyMonthThe || 'January'
                };
            }

        default:
            return {};
    }
}

/**
 * Helper: Build recurrence range
 */
function buildRecurrenceRange(formData: any): any {
    const range: any = {
        type: formData.endDateOption || 'noEnd'
    };

    if (formData.endDateOption === 'endBy') {
        range.endDate = formData.recurrenceEndDate;
    } else if (formData.endDateOption === 'endAfter') {
        range.occurrences = formData.recurrenceOccurrences || 1;
    }

    return range;
}

/**
 * Helper: Map SharePoint item to LeaveRequest object
 */
function mapItemToLeaveRequest(item: any, employees: Employee[]): LeaveRequest {
    // Parse LeaveData JSON
    let leaveData: any = {};
    if (item.LeaveData) {
        try {
            leaveData = JSON.parse(item.LeaveData);
        } catch (e) {
            console.error('Error parsing LeaveData JSON:', e);
        }
    }

    // Find employee from employees array or use lookup data
    const lookupEmail = String(item.EmployeeLookup?.Email || '').trim().toLowerCase();
    const lookupEmpId = String(item.EmployeeLookup?.EmployeeID || '').trim();
    const lookupItemId = Number(item.EmployeeLookupId || item.EmployeeLookup?.Id || 0);
    const lookupName = String(item.EmployeeLookup?.Title || '').trim().toLowerCase();

    const employee = employees.find((emp) => {
        if (lookupItemId && emp.itemId && emp.itemId === lookupItemId) return true;
        if (lookupEmpId && String(emp.id || '').trim() === lookupEmpId) return true;
        if (lookupEmail && String(emp.email || '').trim().toLowerCase() === lookupEmail) return true;
        if (lookupName && String(emp.name || '').trim().toLowerCase() === lookupName) return true;
        return false;
    }) || {
        id: String(item.EmployeeLookup?.EmployeeID || item.EmployeeLookup?.Id || item.EmployeeLookupId || item.Id),
        itemId: lookupItemId || undefined,
        name: item.EmployeeLookup?.Title || 'Unknown',
        department: item.EmployeeLookup?.Department || 'Unknown',
        position: item.EmployeeLookup?.Designation || '',
        avatar: `https://ui-avatars.com/api/?name=${encodeURIComponent(item.EmployeeLookup?.Title || 'Employee')}&background=2f5596&color=ffffff&bold=true&size=128`,
        joiningDate: todayIST(),
        email: item.EmployeeLookup?.Email || ''
    };

    // Build LeaveRequest object
    const leaveRequest: LeaveRequest = {
        id: item.Id,
        employee,
        requestCategory: leaveData.requestCategory === 'Work From Home' || /work\s*from\s*home|wfh/i.test(String(item.LeaveType || ''))
            ? 'Work From Home'
            : 'Leave',
        leaveType: item.LeaveType || 'Unknown',
        startDate: formatDateIST(item.Startdate),
        endDate: formatDateIST(item.Enddate || item.Startdate),
        days: item.Days || 0,
        reason: item.Reason || '',
        status: item.Status as LeaveStatus || LeaveStatus.Pending,
        submittedAt: formatDateIST(item.SubmittedAt || item.Created) || todayIST(),
        approverName: item.ApproverName,
        approverComment: item.ApproverComment,
        isHalfDay: leaveData.isHalfDay || false,
        halfDayType: leaveData.halfDayType || 'first',
        isRecurring: leaveData.isRecurring || false,
        recurringFrequency: leaveData.recurrence?.frequency || 'Daily'
    };

    return leaveRequest;
}
