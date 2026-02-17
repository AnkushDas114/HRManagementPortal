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
    .select('*')
    .top(5000)();
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
      Total: String(employee.total || '0'),
      YearlyCTC: employee.yearlyCTC ?? employee.total ?? 0,
      EmployeeESI: employee.employeeESI ?? 0,
      EmployerESI: employee.employerESI ?? 0,
      SalaryInsurance: employee.salaryInsurance ?? 0,
      SalaryBonus: employee.salaryBonus ?? 0,
      InsuranceTaken: employee.insuranceTaken ?? 'Yes',
      Phone: employee.phone,
      Location: employee.location,
      ReportingManager: employee.reportingManager
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
      Total: String(employee.total || '0'),
      YearlyCTC: employee.yearlyCTC ?? employee.total ?? 0,
      EmployeeESI: employee.employeeESI ?? 0,
      EmployerESI: employee.employerESI ?? 0,
      SalaryInsurance: employee.salaryInsurance ?? 0,
      SalaryBonus: employee.salaryBonus ?? 0,
      ...(employee.insuranceTaken !== undefined ? { InsuranceTaken: employee.insuranceTaken } : {}),
      Phone: employee.phone,
      Location: employee.location,
      ReportingManager: employee.reportingManager
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
  const normalize = (value: string): string => value.toLowerCase().replace(/[^a-z0-9]/g, '');
  const targetByNormalized = new Map<string, string>(
    PROFILE_IMAGE_FOLDERS.map((name) => [normalize(name), name])
  );

  try {
    const webInfo = await sp.web.select('ServerRelativeUrl')();
    const rootRaw = (webInfo as any)?.ServerRelativeUrl || '';
    const root = String(rootRaw).replace(/\/$/, '');

    const libraryRoots = new Set<string>([
      `${root}/SiteAssets`,
      `${root}/SiteAssets/All Pictures`,
      `${root}/All Pictures`,
      `${root}/AllPictures`
    ]);

    try {
      const docLibs = await sp.web.lists
        .select('Title', 'BaseTemplate', 'Hidden', 'RootFolder/ServerRelativeUrl')
        .expand('RootFolder')
        .filter('BaseTemplate eq 101 and Hidden eq false')();

      docLibs.forEach((lib: any) => {
        const title = String(lib.Title || '').toLowerCase();
        const rootFolderUrl = String(lib.RootFolder?.ServerRelativeUrl || '').trim();
        if (!rootFolderUrl) return;
        if (title.includes('pictures') || title.includes('assets') || title.includes('images')) {
          libraryRoots.add(rootFolderUrl.replace(/\/$/, ''));
        }
      });
    } catch {
      // ignore and continue with fallback roots
    }

    const roots: string[] = [];
    libraryRoots.forEach((value) => roots.push(value));

    for (const libraryRoot of roots) {
      try {
        const subFolders = await sp.web
          .getFolderByServerRelativePath(libraryRoot)
          .folders.select('Name', 'ServerRelativeUrl')
          .top(500)();

        for (const folderInfo of subFolders as any[]) {
          const folderName = String(folderInfo.Name || '');
          const normalized = normalize(folderName);
          const mappedFolderName = targetByNormalized.get(normalized);
          if (!mappedFolderName) continue;

          const folderPath = String(folderInfo.ServerRelativeUrl || '').trim();
          if (!folderPath) continue;

          try {
            const files = await sp.web
              .getFolderByServerRelativePath(folderPath)
              .files.select('Name', 'ServerRelativeUrl')
              .top(500)();

            (files as any[]).forEach((file) => {
              const url = String(file.ServerRelativeUrl || '').trim();
              if (!url || seen.has(url)) return;
              seen.add(url);
              images.push({
                folder: mappedFolderName,
                name: String(file.Name || 'image'),
                url
              });
            });
          } catch {
            // ignore broken folder/file access
          }
        }
      } catch {
        // ignore root access failure
      }
    }
  } catch (error) {
    console.warn('Could not load profile image folders.', error);
  }

  return images;
}

async function mapItemToEmployee(sp: SPFI, item: any): Promise<Employee> {
  const parseOptionalNumber = (value: unknown): number | undefined => {
    if (value === null || value === undefined || value === '') return undefined;
    const parsed = Number(value);
    return Number.isNaN(parsed) ? undefined : parsed;
  };
  const normalizeInsuranceTaken = (value: unknown): 'Yes' | 'No' => {
    const normalized = String(value ?? '').trim().toLowerCase();
    return normalized === 'no' ? 'No' : 'Yes';
  };

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
    total: item.Total ? parseFloat(item.Total) : 0,
    yearlyCTC: parseOptionalNumber(item.YearlyCTC) ?? (item.Total ? parseFloat(item.Total) : 0),
    employeeESI: parseOptionalNumber(item.EmployeeESI),
    employerESI: parseOptionalNumber(item.EmployerESI),
    salaryInsurance: parseOptionalNumber(item.SalaryInsurance),
    salaryBonus: parseOptionalNumber(item.SalaryBonus),
    insuranceTaken: normalizeInsuranceTaken(item.InsuranceTaken),
    phone: item.Phone,
    location: item.Location,
    reportingManager: item.ReportingManager
  };
}
