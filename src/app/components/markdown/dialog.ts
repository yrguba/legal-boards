/** BlockNote рендерит меню в portal на body — Radix Dialog помечает body как inert. */
export function isRichEditorOverlayTarget(target: EventTarget | null): boolean {
  if (!(target instanceof Element)) return false;
  return Boolean(
    target.closest(
      '.bn-markdown-scope, .bn-portal-host, .bn-container, .bn-root, .bn-editor, .ProseMirror, .mantine-Menu-dropdown, .mantine-Popover-dropdown',
    ),
  );
}

export const richEditorDialogHandlers = {
  onOpenAutoFocus: (e: Event) => e.preventDefault(),
  onCloseAutoFocus: (e: Event) => e.preventDefault(),
  onInteractOutside: (e: Event) => {
    if (isRichEditorOverlayTarget(e.target)) e.preventDefault();
  },
  onPointerDownOutside: (e: Event) => {
    if (isRichEditorOverlayTarget(e.target)) e.preventDefault();
  },
  onFocusOutside: (e: Event) => {
    if (isRichEditorOverlayTarget(e.target)) e.preventDefault();
  },
};
