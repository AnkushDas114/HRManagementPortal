import { SPFI } from "@pnp/sp";
import "@pnp/sp/webs";
import "@pnp/sp/lists";
import "@pnp/sp/items";
import { Concern, ConcernStatus, ConcernType } from "../types";
import { formatDateIST, nowISTISOString } from "../utils/dateTime";

const LIST_NAME = "EmployeeConcerns";

/**
 * GET: Fetch all concerns (for HR admin)
 */
export async function getAllConcerns(sp: SPFI): Promise<Concern[]> {
    try {
        const items = await sp.web.lists
            .getByTitle(LIST_NAME)
            .items
            .select(
                'Id',
                'Title',
                'Concern_x0020_Type',
                'ReferenceID',
                'Description',
                'Status',
                'Reply',
                'RepliedAt',
                'Created',
                'Modified',
                'Author/Title',
                'Author/EMail',
                'Author/Email',
                'Editor/Title',
                'Employee/Id',
                'Employee/Title',
                'Employee/EMail',
                'Employee/Email'
            )
            .expand('Employee', 'Author', 'Editor')
            .orderBy('Created', false)();
        console.log("concern", items);
        return items.map(mapItemToConcern);
    } catch (error) {
        console.error('Error loading all concerns:', error);
        return [];
    }
}

/**
 * CREATE: Submit a new concern
 */
export async function createConcern(
    sp: SPFI,
    concern: Omit<Concern, 'id' | 'submittedAt' | 'employeeId'>,
    employeeItemId: string | number | undefined
): Promise<void> {
    try {
        const parsedEmployeeItemId = Number(String(employeeItemId ?? '').trim());
        const payload = {
            Title: concern.description.substring(0, 255), // Use part of description as title
            Concern_x0020_Type: concern.type,
            ReferenceID: String(concern.referenceId),
            Description: concern.description,
            Status: concern.status,
            ...(Number.isNaN(parsedEmployeeItemId) ? {} : { EmployeeId: parsedEmployeeItemId })
        };

        await sp.web.lists
            .getByTitle(LIST_NAME)
            .items
            .add(payload);
    } catch (error) {
        console.error('Error creating concern:', error);
        throw error;
    }
}

/**
 * UPDATE: HR Response / Resolution
 */
export async function updateConcernReply(
    sp: SPFI,
    concernId: number,
    reply: string
): Promise<void> {
    try {
        await sp.web.lists
            .getByTitle(LIST_NAME)
            .items
            .getById(concernId)
            .update({
                Reply: reply,
                Status: ConcernStatus.Resolved,
                RepliedAt: nowISTISOString()
            });
    } catch (error) {
        console.error('Error updating concern reply:', error);
        throw error;
    }
}

/**
 * UPDATE: Change concern status (e.g., reopen)
 */
export async function updateConcernStatus(
    sp: SPFI,
    concernId: number,
    status: ConcernStatus
): Promise<void> {
    try {
        const payload: Record<string, unknown> = { Status: status };
        if (status === ConcernStatus.Open) {
            payload.RepliedAt = null;
        }
        await sp.web.lists
            .getByTitle(LIST_NAME)
            .items
            .getById(concernId)
            .update(payload);
    } catch (error) {
        console.error('Error updating concern status:', error);
        throw error;
    }
}

/**
 * DELETE: Remove a concern item
 */
export async function deleteConcern(
    sp: SPFI,
    concernId: number
): Promise<void> {
    try {
        await sp.web.lists
            .getByTitle(LIST_NAME)
            .items
            .getById(concernId)
            .delete();
    } catch (error) {
        console.error('Error deleting concern:', error);
        throw error;
    }
}

/**
 * Helper: Map SharePoint item to Concern object
 */
function normalizeConcernType(value: unknown): ConcernType {
    const raw = String(value ?? '').trim().toLowerCase();
    if (!raw) return ConcernType.General;
    if (raw.includes('attendance')) return ConcernType.Attendance;
    if (raw.includes('salary')) return ConcernType.Salary;
    if (raw.includes('work from home') || raw.includes('wfh')) return ConcernType.WorkFromHome;
    if (raw.includes('leave')) return ConcernType.Leave;
    if (raw.includes('general')) return ConcernType.General;
    return ConcernType.General;
}

function mapItemToConcern(item: any): Concern {
    // Strip HTML from Description if it's wrapped in SharePoint Rich Text <div>
    const rawDescription = item.Description || '';
    const cleanDescription = rawDescription.replace(/<[^>]*>/g, '').trim();
    const employeeLookup = item.Employee || {};
    const employeeSpUserId = employeeLookup?.Id ? Number(employeeLookup.Id) : undefined;
    const employeeId = String(employeeLookup?.Id || '');
    const employeeName = employeeLookup?.Title || item.Author?.Title || '';
    const employeeEmail = employeeLookup?.EMail || employeeLookup?.Email || '';

    return {
        id: item.Id,
        employeeId: employeeId,
        employeeItemId: employeeSpUserId,
        employeeName: employeeName,
        employeeEmail: employeeEmail,
        type: normalizeConcernType(item.Concern_x0020_Type),
        referenceId: item.ReferenceID || '',
        description: cleanDescription,
        reply: item.Reply || undefined,
        status: (item.Status as ConcernStatus) || ConcernStatus.Open,
        submittedAt: formatDateIST(item.Created),
        repliedAt: formatDateIST(item.RepliedAt) || undefined,
        createdAt: formatDateIST(item.Created),
        modifiedAt: formatDateIST(item.Modified),
        createdByName: item.Author?.Title || '',
        createdByEmail: item.Author?.EMail || item.Author?.Email || '',
        modifiedByName: item.Editor?.Title || ''
    };
}
