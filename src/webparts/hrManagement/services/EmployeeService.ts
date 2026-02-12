import { SPFI } from "@pnp/sp";
import "@pnp/sp/webs";
import "@pnp/sp/lists";
import "@pnp/sp/items";
import "@pnp/sp/attachments";
import "@pnp/sp/folders";
import "@pnp/sp/files";
import { Employee } from "../types";
import { formatDateIST } from "../utils/dateTime";

const EMPLOYEE_MASTER_LIST_TITLE = "EmployeeMaster";

export const PROFILE_IMAGE_FOLDERS = ['Covers', 'Logos', 'Page-Images', 'PXCDescriptionImage', 'SliderImages', 'TeamMembers', 'Tiles'] as const;

export interface ProfileGalleryImage {
    folder: string;
    name: string;
    url: string;
}

async function fetchEmployeeItems(sp: SPFI): Promise<any[]> {
  const items = await sp.web.lists
    .getByTitle(EMPLOYEE_MASTER_LIST_TITLE)
        .items
        .select(
            '*'
        )
        .top(5000)();
    console.log("items", items);
    return items;
}

export async function getAllEmployees(sp: SPFI): Promise<Employee[]> {
  try {
    const items = await fetchEmployeeItems(sp);
    const mapped = await Promise.all(items.map(async (item) => mapItemToEmployee(sp, item)));
    return mapped;
  } catch (error) {
    console.error('Error loading employees from Master List:', error);
    return [];
  }
}

export async function createEmployee(sp: SPFI, employee: Partial<Employee>): Promise<number> {
    try {
    const addResult = await sp.web.lists.getByTitle(EMPLOYEE_MASTER_LIST_TITLE).items.add({
            Title: employee.name,
            EmployeeID: employee.id,
            Email: employee.email,
            Department: employee.department,
            Designation: employee.position,
            DOJ: employee.joiningDate,
            PAN: employee.pan,
            AccountNumber: employee.accountNumber,
            BankName: employee.bankName,
            IFSCCode: employee.ifscCode,
            Total: String(employee.total || '0')
        });

        return addResult.data?.Id as number;
    } catch (error) {
        console.error('Error creating employee:', error);
        throw error;
    }
}

export async function updateEmployee(sp: SPFI, itemId: number, employee: Partial<Employee>): Promise<void> {
    try {
    await sp.web.lists.getByTitle(EMPLOYEE_MASTER_LIST_TITLE).items.getById(itemId).update({
            Title: employee.name,
            EmployeeID: employee.id,
            Email: employee.email,
            Department: employee.department,
            Designation: employee.position,
            DOJ: employee.joiningDate,
            PAN: employee.pan,
            AccountNumber: employee.accountNumber,
            BankName: employee.bankName,
            IFSCCode: employee.ifscCode,
            Total: String(employee.total || '0')
        });
    } catch (error) {
        console.error('Error updating employee:', error);
        throw error;
    }
}

export async function deleteEmployee(sp: SPFI, itemId: number): Promise<void> {
    try {
    await sp.web.lists.getByTitle(EMPLOYEE_MASTER_LIST_TITLE).items.getById(itemId).delete();
    } catch (error) {
        console.error('Error deleting employee:', error);
        throw error;
    }
}

export async function clearEmployeeProfileImage(sp: SPFI, itemId: number): Promise<void> {
  const item = sp.web.lists.getByTitle(EMPLOYEE_MASTER_LIST_TITLE).items.getById(itemId);
    const attachments = await item.attachmentFiles();
    for (const attachment of attachments) {
        await item.attachmentFiles.getByName(attachment.FileName).delete();
    }
}

export async function replaceEmployeeProfileImage(sp: SPFI, itemId: number, blob: Blob, fileName: string): Promise<void> {
  const item = sp.web.lists.getByTitle(EMPLOYEE_MASTER_LIST_TITLE).items.getById(itemId);
    await clearEmployeeProfileImage(sp, itemId);
    await item.attachmentFiles.add(fileName, await blob.arrayBuffer());
}

export async function getProfileGalleryImages(sp: SPFI): Promise<ProfileGalleryImage[]> {
    const images: ProfileGalleryImage[] = [];
    const seen = new Set<string>();

    try {
        const webInfo = await sp.web.select('ServerRelativeUrl')();
        const rootRaw = (webInfo as any)?.ServerRelativeUrl || '';
        const root = String(rootRaw).replace(/\/$/, '');
        const bases = [`${root}/SiteAssets`, `${root}/SiteAssets/All Pictures`, root];

        for (const folder of PROFILE_IMAGE_FOLDERS) {
            for (const base of bases) {
                try {
                    const path = `${base}/${folder}`.replace(/\/+/g, '/');
                    const files = await sp.web.getFolderByServerRelativePath(path).files.select('Name', 'ServerRelativeUrl').top(200)();
                    files.forEach((file: any) => {
                        const url = String(file.ServerRelativeUrl || '').trim();
                        if (!url || seen.has(url)) return;
                        seen.add(url);
                        images.push({
                            folder,
                            name: String(file.Name || 'image'),
                            url
                        });
                    });
                } catch {
                    // folder path may not exist in this tenant
                }
            }
        }
    } catch (error) {
        console.warn('Could not load profile image folders.', error);
    }

    return images;
}

async function mapItemToEmployee(sp: SPFI, item: any): Promise<Employee> {
  const email = item.Email || item.UserAccount?.EMail || '';
  const avatarSuffix = String(item.Title || item.EmployeeID || email || item.Id || 'employee');
  const fallbackAvatar = `https://ui-avatars.com/api/?name=${encodeURIComponent(avatarSuffix)}&background=2f5596&color=ffffff&bold=true&size=128`;
  let attachmentAvatar = item.AttachmentFiles && item.AttachmentFiles.length > 0
    ? String(item.AttachmentFiles[0].ServerRelativeUrl || '')
    : '';

  // Some SharePoint responses do not hydrate AttachmentFiles reliably in expanded queries.
  if (!attachmentAvatar && item.Id) {
    try {
      const attachments = await sp.web.lists
        .getByTitle(EMPLOYEE_MASTER_LIST_TITLE)
        .items.getById(item.Id)
        .attachmentFiles();
      if (attachments.length > 0) {
        attachmentAvatar = String(attachments[0].ServerRelativeUrl || '');
      }
    } catch {
      // Keep fallback avatar when attachment lookup fails.
    }
  }

  return {
        id: String(item.EmployeeID || item.Id),
        itemId: item.Id,
        name: item.Title || 'Unknown',
        department: item.Department || 'General',
        position: item.Designation || '',
    avatar: attachmentAvatar || fallbackAvatar,
        joiningDate: formatDateIST(item.DOJ),
        email: email,
        pan: item.PAN,
        accountNumber: item.AccountNumber,
        bankName: item.BankName,
        ifscCode: item.IFSCCode,
        total: item.Total ? parseFloat(item.Total) : 0
    };
}
