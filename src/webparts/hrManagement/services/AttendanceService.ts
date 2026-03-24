
import { SPFI } from "@pnp/sp";
import "@pnp/sp/webs";
import "@pnp/sp/lists";
import "@pnp/sp/items";
import { AttendanceRecord, AttendanceStatus } from "../types";
import { formatDateIST } from "../utils/dateTime";

const LIST_NAME = "AttendanceList";

const normalizeEmployeeId = (value: unknown): string => {
    const raw = String(value ?? "").trim();
    if (!raw) return "";
    const compact = raw.replace(/\s+/g, "");
    const digits = compact.replace(/\D/g, "");
    if (!digits) return compact.toLowerCase();
    const trimmed = digits.replace(/^0+/, "");
    return trimmed || "0";
};

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

export async function saveAttendanceRecords(sp: SPFI, records: AttendanceRecord[]): Promise<{ created: number; updated: number; unchanged: number }> {
    const list = sp.web.lists.getByTitle(LIST_NAME);
    let createdCount = 0;
    let updatedCount = 0;
    let unchangedCount = 0;

    try {
        const allItems = await list.items
            .select("Id", "Date", "EmployeeID", "InTime", "OutTime", "WorkDuration", "Status", "Remarks", "Department", "Title")
            .top(5000)();

        const existingMap = new Map<string, any>();
        for (const item of allItems) {
            const itemDate = formatDateIST(item.Date);
            const employeeId = normalizeEmployeeId(item.EmployeeID);
            if (itemDate && employeeId) {
                existingMap.set(`${itemDate}_${employeeId}`, item);
            }
        }

        for (const record of records) {
            const recordDate = record.date;
            const employeeId = normalizeEmployeeId(record.employeeId);
            const key = `${recordDate}_${employeeId}`;

            const existingItem = existingMap.get(key);

            if (existingItem) {
                const inTimeMatch = (existingItem.InTime || '') === (record.clockIn || '');
                const outTimeMatch = (existingItem.OutTime || '') === (record.clockOut || '');
                const workDurationMatch = (existingItem.WorkDuration || '') === (record.workDuration || '');
                const statusMatch = (existingItem.Status || '') === (record.status || '');
                const remarksMatch = (existingItem.Remarks || '') === (record.remarks || '');
                const departmentMatch = (existingItem.Department || '') === (record.department || '');
                const titleMatch = (existingItem.Title || '') === (record.employeeName || 'Unknown');

                if (inTimeMatch && outTimeMatch && workDurationMatch && statusMatch && remarksMatch && departmentMatch && titleMatch) {
                    unchangedCount++;
                } else {
                    await list.items.getById(existingItem.Id).update({
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
                    updatedCount++;
                }
            } else {
                await list.items.add({
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
                createdCount++;
            }
        }
    } catch (err) {
        console.error("Failed to save attendance records", err);
        throw err;
    }

    return { created: createdCount, updated: updatedCount, unchanged: unchangedCount };
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

export async function deleteAttendanceRecordById(sp: SPFI, itemId: number): Promise<void> {
    if (!itemId) return;
    try {
        await sp.web.lists.getByTitle(LIST_NAME).items.getById(itemId).delete();
    } catch (error) {
        console.error("Error deleting attendance record by id:", error);
        throw error;
    }
}
