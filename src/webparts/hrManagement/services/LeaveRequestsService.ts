import { SPFI } from '@pnp/sp';
import '@pnp/sp/webs';
import '@pnp/sp/lists';
import '@pnp/sp/items';
import type { LeaveRequest, Employee } from '../types';
import { LeaveStatus } from '../types';
import { formatDateIST, nowISTISOString, todayIST } from '../utils/dateTime';

const LEAVE_REQUESTS_LIST_ID = '7BB0C02A58-E04A-43EA-8708-CB69E4D9BC88';
const TASK_USERS_LIST_ID = '117bc416-3fbf-4641-8584-20d149078ee8';

/**
 * GET: Load all leave requests from SharePoint
 */
export async function getAllLeaveRequests(sp: SPFI, employees: Employee[]): Promise<LeaveRequest[]> {
    try {
        const items = await sp.web.lists
            .getByTitle("Leave Request")
            .items
            .select(
                '*',
                'EmployeeLookup/Title',
                'EmployeeLookup/Email',
                'EmployeeLookup/EmployeeID',
                'EmployeeLookup/ID'
            )
            .expand('EmployeeLookup')
            .orderBy('SubmittedAt', false)
            .top(1000)();

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
        if (!employee.email) {
            throw new Error('Employee email is missing');
        }
        const employeeId = await getEmployeeIdByEmail(sp, employee.email);

        if (!employeeId) {
            throw new Error('Employee not found in Task Users list');
        }

        // Prepare LeaveData JSON
        const leaveData: any = {
            isHalfDay: formData.isHalfDay || false,
            halfDayType: formData.halfDayType || null,
            isRecurring: formData.isRecurring || false
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
            .getByTitle("Leave Request")
            .items.add({
                Title: `${formData.leaveType} - ${formData.startDate}`,
                LeaveType: formData.leaveType,
                Startdate: formData.startDate,
                Enddate: formData.isHalfDay ? formData.startDate : formData.endDate,
                Days: days,
                Reason: formData.reason,
                Status: 'Pending',
                SubmittedAt: nowISTISOString(),
                EmployeeLookupId: employeeId,
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
            .getByTitle("Leave Request").items.getById(requestId)
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
            .getById(LEAVE_REQUESTS_LIST_ID)
            .items.getById(requestId)
            .delete();

        console.log('Leave request deleted successfully');
    } catch (error) {
        console.error('Error deleting leave request:', error);
        throw error;
    }
}

/**
 * Helper: Get employee ID from Task Users list by email
 */
async function getEmployeeIdByEmail(sp: SPFI, email: string): Promise<number | null> {
    try {
        const items = await sp.web.lists
            .getById(TASK_USERS_LIST_ID)
            .items
            .select('Id')
            .filter(`Email eq '${email}'`)
            .top(1)();

        return items.length > 0 ? items[0].Id : null;
    } catch (error) {
        console.error('Error getting employee ID:', error);
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
    const employee = employees.find(emp =>
        emp.email === item.EmployeeLookup?.Email ||
        emp.id === String(item.EmployeeLookup?.EmployeeID)
    ) || {
        id: String(item.EmployeeLookup?.EmployeeID || item.EmployeeLookup?.ID || item.Id),
        name: item.EmployeeLookup?.Title || 'Unknown',
        department: 'Unknown' as any,
        avatar: `https://i.pravatar.cc/150?u=${item.EmployeeLookup?.Email || item.Id}`,
        joiningDate: todayIST(),
        email: item.EmployeeLookup?.Email || ''
    };

    // Build LeaveRequest object
    const leaveRequest: LeaveRequest = {
        id: item.Id,
        employee,
        leaveType: item.LeaveType || 'Unknown',
        startDate: formatDateIST(item.Startdate),
        endDate: formatDateIST(item.Enddate),
        days: item.Days || 0,
        reason: item.Reason || '',
        status: item.Status as LeaveStatus || LeaveStatus.Pending,
        submittedAt: formatDateIST(item.SubmittedAt) || todayIST(),
        approverName: item.ApproverName,
        approverComment: item.ApproverComment,
        isHalfDay: leaveData.isHalfDay || false,
        halfDayType: leaveData.halfDayType || 'first',
        isRecurring: leaveData.isRecurring || false,
        recurringFrequency: leaveData.recurrence?.frequency || 'Daily'
    };

    return leaveRequest;
}
