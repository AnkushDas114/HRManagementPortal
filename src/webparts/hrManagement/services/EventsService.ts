
import { SPFI } from "@pnp/sp";
import "@pnp/sp/webs";
import "@pnp/sp/lists";
import "@pnp/sp/items";
import { TeamEvent, Employee } from "../types";
import { formatDateIST } from "../utils/dateTime";

const LIST_NAME = "TeamCelebrations";

/**
 * GET: Fetch all team events from SharePoint
 */
export async function getAllEvents(sp: SPFI, employees: Employee[]): Promise<TeamEvent[]> {
    try {
        const items = await sp.web.lists
            .getByTitle(LIST_NAME)
            .items
            .select(
                'Id',
                'Title',
                'Event_x0020_Type',
                'Description',
                'Date',
                'Employee/Title',
                'Employee/EMail',
                'Employee/Id'
            )
            .expand('Employee')
            .top(5000)();

        console.log('Team Events loaded from SharePoint:', items);

        return items.map(item => mapItemToTeamEvent(item, employees));
    } catch (error) {
        console.error('Error loading team events:', error);
        return [];
    }
}

/**
 * CREATE: Add a new team event
 */
export async function createEvent(
    sp: SPFI,
    event: Omit<TeamEvent, 'id'>,
    employeeId?: string
): Promise<void> {
    try {
        const payload: any = {
            Title: event.name,
            Event_x0020_Type: event.type,
            Description: event.description || '',
            Date: event.date,
        };

        if (employeeId) {
            payload.EmployeeId = parseInt(employeeId);
        }

        await sp.web.lists
            .getByTitle(LIST_NAME)
            .items
            .add(payload);

        console.log('Team event created successfully');
    } catch (error) {
        console.error('Error creating team event:', error);
        throw error;
    }
}

/**
 * UPDATE: Modify an existing team event
 */
export async function updateEvent(
    sp: SPFI,
    eventId: number,
    event: Omit<TeamEvent, 'id'>,
    employeeId?: string
): Promise<void> {
    try {
        const payload: any = {
            Title: event.name,
            Event_x0020_Type: event.type,
            Description: event.description || '',
            Date: event.date,
            EmployeeId: employeeId ? parseInt(employeeId, 10) : null
        };

        await sp.web.lists
            .getByTitle(LIST_NAME)
            .items
            .getById(eventId)
            .update(payload);

        console.log('Team event updated successfully');
    } catch (error) {
        console.error('Error updating team event:', error);
        throw error;
    }
}

/**
 * DELETE: Remove a team event
 */
export async function deleteEvent(sp: SPFI, eventId: number): Promise<void> {
    try {
        await sp.web.lists
            .getByTitle(LIST_NAME)
            .items
            .getById(eventId)
            .delete();
        console.log('Team event deleted successfully');
    } catch (error) {
        console.error('Error deleting team event:', error);
        throw error;
    }
}

/**
 * Helper: Map SharePoint item to TeamEvent object
 */
function mapItemToTeamEvent(item: any, employees: Employee[]): TeamEvent {
    // Find employee from lookup data
    const employee = employees.find(emp =>
        emp.email === item.Employee?.EMail ||
        emp.id === String(item.Employee?.Id)
    );

    return {
        id: item.Id,
        name: item.Title || employee?.name || item.Employee?.Title || 'Unknown',
        type: (item.Event_x0020_Type as any) || 'Other',
        date: formatDateIST(item.Date),
        description: String(item.Description || '').trim(),
        employee: employee
    };
}
