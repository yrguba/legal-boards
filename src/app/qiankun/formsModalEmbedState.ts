/** Флаг embed-модалки LF — без импорта qiankun (можно читать из routes при bootstrap). */

let formsModalEmbedActive = false;

export function setFormsModalEmbedActive(active: boolean) {
  formsModalEmbedActive = active;
}

export function isFormsModalEmbedActive(): boolean {
  return formsModalEmbedActive;
}
