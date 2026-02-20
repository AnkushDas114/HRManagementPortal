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
                'Employee/Id',
                'Employee/Title',
                'Employee/EMail'
            )
            .expand('Employee')
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
    employeeId: string
): Promise<void> {
    try {
        const payload = {
            Title: concern.description.substring(0, 255), // Use part of description as title
            Concern_x0020_Type: concern.type,
            ReferenceID: String(concern.referenceId),
            Description: concern.description,
            Status: concern.status,
            EmployeeId: parseInt(employeeId)
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
 * Helper: Map SharePoint item to Concern object
 */
function mapItemToConcern(item: any): Concern {
    // Strip HTML from Description if it's wrapped in SharePoint Rich Text <div>
    const rawDescription = item.Description || '';
    const cleanDescription = rawDescription.replace(/<[^>]*>/g, '').trim();

    return {
        id: item.Id,
        employeeId: item.Employee?.Id ? String(item.Employee.Id) : '',
        type: item.Concern_x0020_Type as ConcernType,
        referenceId: item.ReferenceID || '',
        description: cleanDescription,
        reply: item.Reply || undefined,
        status: (item.Status as ConcernStatus) || ConcernStatus.Open,
        submittedAt: formatDateIST(item.Created),
        repliedAt: formatDateIST(item.RepliedAt) || undefined
    };
}
