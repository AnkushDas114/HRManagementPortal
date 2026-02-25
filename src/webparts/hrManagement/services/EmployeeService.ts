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
const IMAGE_LIBRARY_TITLE = 'Images';

export interface ProfileGalleryImage {
  folder: string;
  name: string;
  url: string;
}

export interface SPFolder {
  Name: string;
  ItemCount: number;
  ServerRelativeUrl: string;
}

export interface SPImage {
  id: string;
  fileName: string;
  serverRelativeUrl: string;
  absoluteUrl: string;
  folderName: string;
}

const IMAGE_RETRY_BASE_DELAY_MS = 700;
const IMAGE_RETRY_MAX_ATTEMPTS = 5;
const IMAGE_CACHE_TTL_MS = 2 * 60 * 1000;
let imageGalleryCache: { ts: number; data: ProfileGalleryImage[] } | null = null;
const ALLOWED_DEPARTMENTS = [
  'SPFx',
  'Design',
  'QA',
  'HR',
  'Finance',
  'Smalsus Lead',
  'Portfolio Lead',
  'Management',
  'Trainee',
  'Project Management Trainee'
] as const;

const normalizeDepartment = (value: unknown): string => {
  const raw = String(value ?? '').trim();
  if (!raw) return '';
  const matched = ALLOWED_DEPARTMENTS.find((dept) => dept.toLowerCase() === raw.toLowerCase());
  return matched || raw;
};

const sleep = async (ms: number): Promise<void> => new Promise((resolve) => setTimeout(resolve, ms));

const isThrottleError = (error: unknown): boolean => {
  const status = Number((error as { status?: number; statusCode?: number })?.status || (error as { statusCode?: number })?.statusCode || 0);
  const message = String((error as { message?: string })?.message || '').toLowerCase();
  return status === 429 || status === 503 || message.includes('throttl') || message.includes('too many requests');
};

const withThrottleRetry = async <T>(operation: () => Promise<T>, label: string): Promise<T> => {
  let lastError: unknown;
  for (let attempt = 0; attempt < IMAGE_RETRY_MAX_ATTEMPTS; attempt++) {
    try {
      return await operation();
    } catch (error) {
      lastError = error;
      if (!isThrottleError(error) || attempt === IMAGE_RETRY_MAX_ATTEMPTS - 1) break;
      const jitter = Math.floor(Math.random() * 220);
      const delay = IMAGE_RETRY_BASE_DELAY_MS * (2 ** attempt) + jitter;
      console.warn(`Throttled while ${label}. Retrying in ${delay}ms (attempt ${attempt + 1}/${IMAGE_RETRY_MAX_ATTEMPTS}).`);
      await sleep(delay);
    }
  }
  throw lastError;
};

async function fetchEmployeeItems(sp: SPFI): Promise<any[]> {
  const items = await sp.web.lists
    .getByTitle(EMPLOYEE_MASTER_LIST_TITLE)
    .items
    .select(
      '*',
      'Author/Title',
      'Editor/Title',
      'AttachmentFiles'
    )
    .expand('Author', 'Editor', 'AttachmentFiles')
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
    const department = normalizeDepartment(employee.department);
    const addResult = await sp.web.lists.getByTitle(EMPLOYEE_MASTER_LIST_TITLE).items.add({
      Title: employee.name,
      EmployeeID: employee.id,
      Email: employee.email,
      Department: department,
      Designation: employee.position,
      DOJ: employee.joiningDate,
      PAN: employee.pan,
      UAN: employee.uan,
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
    const payload: Record<string, unknown> = {};

    if (employee.name !== undefined) payload.Title = employee.name;
    if (employee.id !== undefined) payload.EmployeeID = employee.id;
    if (employee.email !== undefined) payload.Email = employee.email;
    if (employee.department !== undefined) payload.Department = normalizeDepartment(employee.department);
    if (employee.position !== undefined) payload.Designation = employee.position;
    if (employee.joiningDate !== undefined) payload.DOJ = employee.joiningDate;
    if (employee.pan !== undefined) payload.PAN = employee.pan;
    if (employee.uan !== undefined) payload.UAN = employee.uan;
    if (employee.accountNumber !== undefined) payload.AccountNumber = employee.accountNumber;
    if (employee.bankName !== undefined) payload.BankName = employee.bankName;
    if (employee.ifscCode !== undefined) payload.IFSCCode = employee.ifscCode;
    if (employee.total !== undefined) payload.Total = String(employee.total || '0');
    if (employee.yearlyCTC !== undefined) payload.YearlyCTC = employee.yearlyCTC;
    if (employee.employeeESI !== undefined) payload.EmployeeESI = employee.employeeESI;
    if (employee.employerESI !== undefined) payload.EmployerESI = employee.employerESI;
    if (employee.salaryInsurance !== undefined) payload.SalaryInsurance = employee.salaryInsurance;
    if (employee.salaryBonus !== undefined) payload.SalaryBonus = employee.salaryBonus;
    if (employee.insuranceTaken !== undefined) payload.InsuranceTaken = employee.insuranceTaken;
    if (employee.phone !== undefined) payload.Phone = employee.phone;
    if (employee.location !== undefined) payload.Location = employee.location;
    if (employee.reportingManager !== undefined) payload.ReportingManager = employee.reportingManager;

    if (!Object.keys(payload).length) return;
    await sp.web.lists.getByTitle(EMPLOYEE_MASTER_LIST_TITLE).items.getById(itemId).update(payload);
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
  if (imageGalleryCache && (Date.now() - imageGalleryCache.ts) < IMAGE_CACHE_TTL_MS) {
    return imageGalleryCache.data;
  }

  const webInfo = await sp.web.select('Url')();
  const siteUrl = String((webInfo as { Url?: string })?.Url || window.location.href);
  try {
    const folders = await getImageLibraryFolders(sp, siteUrl);
    const allImages: ProfileGalleryImage[] = [];
    for (const folder of folders) {
      if (folder.ItemCount <= 0) continue;
      const files = await getImagesByFolder(sp, siteUrl, folder.ServerRelativeUrl);
      files.forEach((file) => {
        allImages.push({
          folder: folder.Name,
          name: file.fileName,
          url: file.serverRelativeUrl
        });
      });
    }
    if (allImages.length > 0) {
      imageGalleryCache = { ts: Date.now(), data: allImages };
      return allImages;
    }
  } catch {
    // fallback below
  }

  const fallback = await getProfileGalleryImagesFallback(sp);
  imageGalleryCache = { ts: Date.now(), data: fallback };
  return fallback;
}

export const getImageLibraryFolders = async (
  sp: SPFI,
  _siteUrl: string
): Promise<SPFolder[]> => {
  try {
    const folders = await withThrottleRetry(
      async () => sp.web.lists
        .getByTitle(IMAGE_LIBRARY_TITLE)
        .rootFolder
        .folders
        .select("Name", "ServerRelativeUrl", "ItemCount")(),
      'loading image library folders'
    );

    return (folders as Array<{ Name?: string; ItemCount?: number; ServerRelativeUrl?: string }>)
      .filter((f) => String(f.Name || '') !== 'Forms' && !String(f.Name || '').startsWith('_'))
      .map((f) => ({
        Name: String(f.Name || ''),
        ItemCount: Number(f.ItemCount || 0),
        ServerRelativeUrl: String(f.ServerRelativeUrl || '')
      }))
      .filter((f) => !!f.Name && !!f.ServerRelativeUrl);
  } catch (e) {
    console.error("Error fetching image library folders:", e);
    return [];
  }
};

export const getImagesByFolder = async (
  sp: SPFI,
  siteUrl: string,
  folderServerRelativeUrl: string
): Promise<SPImage[]> => {
  try {
    const files = await withThrottleRetry(
      async () => sp.web
        .getFolderByServerRelativePath(folderServerRelativeUrl)
        .files
        .select('UniqueId', 'Name', 'ServerRelativeUrl')(),
      `loading images from ${folderServerRelativeUrl}`
    );

    let origin = '';
    try {
      origin = new URL(siteUrl).origin;
    } catch {
      origin = window.location.origin;
    }

    return (files as Array<{ UniqueId?: string; Name?: string; ServerRelativeUrl?: string }>).map((f) => {
      const serverRelativeUrl = String(f.ServerRelativeUrl || '');
      return {
        id: String(f.UniqueId || serverRelativeUrl || f.Name || ''),
        fileName: String(f.Name || ''),
        serverRelativeUrl,
        absoluteUrl: `${origin}${serverRelativeUrl}`,
        folderName: folderServerRelativeUrl.split('/').pop() || ''
      };
    }).filter((file) => !!file.serverRelativeUrl);
  } catch (e) {
    console.error(`Error fetching images from ${folderServerRelativeUrl}:`, e);
    return [];
  }
};

export async function getProfileGalleryImagesFallback(sp: SPFI): Promise<ProfileGalleryImage[]> {
  const images: ProfileGalleryImage[] = [];
  const seen = new Set<string>();

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
                folder: folderName || 'Images',
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
    uan: item.UAN,
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
    reportingManager: item.ReportingManager,
    createdAt: formatDateIST(item.Created),
    modifiedAt: formatDateIST(item.Modified),
    createdByName: item.Author?.Title || '',
    modifiedByName: item.Editor?.Title || ''
  };
}
