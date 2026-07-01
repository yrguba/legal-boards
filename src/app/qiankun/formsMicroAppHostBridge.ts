/** Колбэки и локальное состояние формы LF для props qiankun (setGlobalForm / saveForm). */

type FormsHostSession = {
  globalForm: unknown;
  savedFormData: unknown;
  onSaveForm?: (data: unknown) => void;
};

let currentSession: FormsHostSession = {
  globalForm: null,
  savedFormData: null,
};

const formsMicroAppHostCallbacks = {
  setGlobalForm(form: unknown) {
    currentSession.globalForm = form;
  },
  saveForm(data: unknown) {
    currentSession.savedFormData = data;
    currentSession.onSaveForm?.(data);
  },
};

export function resetFormsHostSession(onSaveForm?: (data: unknown) => void) {
  currentSession = {
    globalForm: null,
    savedFormData: null,
    onSaveForm,
  };
}

export function getFormsHostGlobalForm(): unknown {
  return currentSession.globalForm;
}

export function getFormsHostSavedFormData(): unknown {
  return currentSession.savedFormData;
}

export function getFormsMicroAppHostCallbacks() {
  return formsMicroAppHostCallbacks;
}
