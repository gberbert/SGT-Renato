export const MODULE_STORAGE_KEY = 'sgt_active_module';

export const MODULES = {
  GESTAO: 'gestao',
  OPERACAO: 'operacao',
};

export const getActiveModule = () => sessionStorage.getItem(MODULE_STORAGE_KEY);

export const setActiveModule = (module) => {
  sessionStorage.setItem(MODULE_STORAGE_KEY, module);
};

export const clearActiveModule = () => {
  sessionStorage.removeItem(MODULE_STORAGE_KEY);
};
