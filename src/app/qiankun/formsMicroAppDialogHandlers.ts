import { FORMS_MICRO_APP_CONTAINER } from './formsMicroApp.config';

const FORMS_MOUNT_ID = FORMS_MICRO_APP_CONTAINER.replace(/^#/, '');

/**
 * Legal Forms (Ant Design / rc-*) рендерит date picker, select и popover в portal на body.
 * Radix Dialog иначе закрывает модалку и блокирует клики (inert / pointer-events).
 */
const LF_OVERLAY_SELECTOR = [
  `#${FORMS_MOUNT_ID}`,
  `[id^="__qiankun_microapp_wrapper_for_"]`,
  '.ant-picker-dropdown',
  '.ant-select-dropdown',
  '.ant-dropdown',
  '.ant-popover',
  '.ant-cascader-menus',
  '.ant-tree-select-dropdown',
  '.ant-mentions-dropdown',
  '.ant-modal-root',
  '.ant-drawer-root',
  '.rc-picker-dropdown',
  '.rc-select-dropdown',
  '.mantine-Popover-dropdown',
  '.mantine-Select-dropdown',
  '.mantine-DatePicker-dropdown',
].join(', ');

export function isLegalFormsOverlayTarget(target: EventTarget | null): boolean {
  if (!(target instanceof Element)) return false;
  return Boolean(target.closest(LF_OVERLAY_SELECTOR));
}

export const legalFormsDialogHandlers = {
  onOpenAutoFocus: (e: Event) => e.preventDefault(),
  onInteractOutside: (e: Event) => {
    if (isLegalFormsOverlayTarget(e.target)) e.preventDefault();
  },
  onPointerDownOutside: (e: Event) => {
    if (isLegalFormsOverlayTarget(e.target)) e.preventDefault();
  },
  onFocusOutside: (e: Event) => {
    if (isLegalFormsOverlayTarget(e.target)) e.preventDefault();
  },
};
