import React, { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react';
import {
  ensureOperacaoRadarBootstrap,
  getOperacaoRadarSnapshot,
  refreshOperacaoRadar,
  resetOperacaoRadarStore,
  subscribeOperacaoRadar,
} from '../services/operacaoRadarStore';

const OperacaoRadarContext = createContext(null);

export function OperacaoRadarProvider({ user, children }) {
  const uid = user?.uid || null;
  const [snapshot, setSnapshot] = useState(getOperacaoRadarSnapshot);

  useEffect(() => {
    return subscribeOperacaoRadar(setSnapshot);
  }, []);

  useEffect(() => {
    if (!uid) {
      resetOperacaoRadarStore();
    }
  }, [uid]);

  const ensureRadarBootstrap = useCallback(
    (options = {}) => (uid ? ensureOperacaoRadarBootstrap(uid, options) : Promise.resolve()),
    [uid]
  );

  const refreshRadar = useCallback(
    () => (uid ? refreshOperacaoRadar(uid) : Promise.resolve()),
    [uid]
  );

  const value = useMemo(
    () => ({
      ...snapshot,
      ensureRadarBootstrap,
      refreshRadar,
    }),
    [snapshot, ensureRadarBootstrap, refreshRadar]
  );

  return (
    <OperacaoRadarContext.Provider value={value}>{children}</OperacaoRadarContext.Provider>
  );
}

export function useOperacaoRadar() {
  const context = useContext(OperacaoRadarContext);
  if (!context) {
    throw new Error('useOperacaoRadar deve ser usado dentro de OperacaoRadarProvider');
  }
  return context;
}
