import type { SPFI } from '@pnp/sp';
import { showAlert } from '../ui/CustomAlert';

type FormType = 'edit' | 'display';

const listRootCache = new Map<string, string>();

const getFormPage = (formType: FormType): string => (
  formType === 'display' ? 'DispForm.aspx' : 'EditForm.aspx'
);

export const openOutOfBoxListItemForm = async (
  sp: SPFI,
  listTitle: string,
  itemId?: number | string,
  formType: FormType = 'edit'
): Promise<void> => {
  if (!sp || !listTitle || itemId === null || itemId === undefined || String(itemId).trim() === '') {
    return;
  }

  try {
    let rootPath = listRootCache.get(listTitle);
    if (!rootPath) {
      const listInfo = await sp.web.lists
        .getByTitle(listTitle)
        .select('RootFolder/ServerRelativeUrl')
        .expand('RootFolder')();

      rootPath = String((listInfo as { RootFolder?: { ServerRelativeUrl?: string } })?.RootFolder?.ServerRelativeUrl || '').replace(/\/$/, '');
      if (!rootPath) {
        throw new Error(`Could not resolve RootFolder URL for list "${listTitle}".`);
      }
      listRootCache.set(listTitle, rootPath);
    }

    const page = getFormPage(formType);
    const url = `${window.location.origin}${rootPath}/${page}?ID=${encodeURIComponent(String(itemId))}`;
    window.open(url, '_blank', 'noopener,noreferrer');
  } catch (error) {
    console.error(`Unable to open out-of-the-box form for list "${listTitle}" and item "${itemId}".`, error);
    showAlert('Unable to open the out-of-the-box form for this item.');
  }
};

