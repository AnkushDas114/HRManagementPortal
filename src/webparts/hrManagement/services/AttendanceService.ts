
import { SPFI } from "@pnp/sp";
import "@pnp/sp/webs";
import "@pnp/sp/lists";
import "@pnp/sp/items";
import { AttendanceRecord, AttendanceStatus } from "../types";
import { formatDateIST } from "../utils/dateTime";

const LIST_NAME = "AttendanceList";

export async function getAllAttendanceRecords(sp: SPFI): Promise<AttendanceRecord[]> {
    try {
        const items = await sp.web.lists.getByTitle(LIST_NAME).items
            .select(
                "Id",
                "Title",
                "EmployeeID",
                "Date",
                "InTime",
                "OutTime",
                "WorkDuration",
                "Status",
                "Remarks",
                "Department"
            )
            .top(5000)();
        console.log(items)
        return items.map(item => ({
            id: item.Id,
            employeeId: item.EmployeeID,
            employeeName: item.Title,
            department: item.Department,
            date: formatDateIST(item.Date),
            clockIn: item.InTime,
            clockOut: item.OutTime,
            workDuration: item.WorkDuration,
            status: item.Status as AttendanceStatus,
            remarks: item.Remarks
        }));
    } catch (error) {
        console.error("Error fetching attendance records:", error);
        return [];
    }
}

export async function saveAttendanceRecords(sp: SPFI, records: AttendanceRecord[]): Promise<void> {
    const list = sp.web.lists.getByTitle(LIST_NAME);

    // Batching in chunks of 50 to avoid threshold/timeout issues if needed, 
    // but for simplicity we'll use a loop for now or PnP batch if available.
    // For this implementation, we'll do sequential adds to ensure stability.
    for (const record of records) {
        try {
            await list.items.add({
                Title: record.employeeName || 'Unknown',
                EmployeeID: record.employeeId,
                Department: record.department,
                Date: record.date,
                InTime: record.clockIn || '',
                OutTime: record.clockOut || '',
                WorkDuration: record.workDuration || '',
                Status: record.status,
                Remarks: record.remarks || ''
            });
        } catch (err) {
            console.error(`Failed to save record for ${record.employeeId}`, err);
        }
    }
}
