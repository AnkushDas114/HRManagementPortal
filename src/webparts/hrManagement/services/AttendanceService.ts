
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
                "Department",
                "Created",
                "Modified",
                "Author/Title",
                "Editor/Title"
            )
            .expand("Author", "Editor")
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
            remarks: item.Remarks,
            createdAt: formatDateIST(item.Created),
            modifiedAt: formatDateIST(item.Modified),
            createdByName: item.Author?.Title || '',
            modifiedByName: item.Editor?.Title || ''
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

export async function updateAttendanceRecord(sp: SPFI, record: AttendanceRecord): Promise<void> {
    if (!record.id) {
        throw new Error("Attendance record ID is required for update.");
    }

    try {
        await sp.web.lists
            .getByTitle(LIST_NAME)
            .items.getById(record.id)
            .update({
                Title: record.employeeName || 'Unknown',
                EmployeeID: record.employeeId,
                Department: record.department || '',
                Date: record.date,
                InTime: record.clockIn || '',
                OutTime: record.clockOut || '',
                WorkDuration: record.workDuration || '',
                Status: record.status,
                Remarks: record.remarks || ''
            });
    } catch (error) {
        console.error("Error updating attendance record:", error);
        throw error;
    }
}

const normalizeEmployeeId = (value: unknown): string => {
    const raw = String(value ?? "").trim();
    if (!raw) return "";
    const compact = raw.replace(/\s+/g, "");
    const digits = compact.replace(/\D/g, "");
    if (!digits) return compact.toLowerCase();
    const trimmed = digits.replace(/^0+/, "");
    return trimmed || "0";
};

export async function deleteAttendanceRecordsByDate(
    sp: SPFI,
    targetDate: string,
    employeeId?: string
): Promise<number> {
    const normalizedTargetDate = String(targetDate || "").trim();
    if (!normalizedTargetDate) return 0;

    try {
        const allItems = await sp.web.lists.getByTitle(LIST_NAME).items
            .select("Id", "Date", "EmployeeID")
            .top(5000)();

        const normalizedTargetEmployeeId = normalizeEmployeeId(employeeId);

        const itemsToDelete = allItems.filter((item: any) => {
            const itemDate = formatDateIST(item.Date);
            if (itemDate !== normalizedTargetDate) return false;

            if (!normalizedTargetEmployeeId) return true;
            return normalizeEmployeeId(item.EmployeeID) === normalizedTargetEmployeeId;
        });

        if (!itemsToDelete.length) {
            return 0;
        }

        const list = sp.web.lists.getByTitle(LIST_NAME);
        const chunkSize = 25;
        for (let i = 0; i < itemsToDelete.length; i += chunkSize) {
            const chunk = itemsToDelete.slice(i, i + chunkSize);
            await Promise.all(
                chunk.map((item: any) => list.items.getById(item.Id).delete())
            );
        }

        return itemsToDelete.length;
    } catch (error) {
        console.error("Error deleting attendance records by date:", error);
        throw error;
    }
}
