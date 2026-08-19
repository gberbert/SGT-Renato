import React from 'react';
import { Navigate, useLocation } from 'react-router-dom';
import { getActiveModule, MODULES } from '../utils/moduleSession';

const ModuleGuard = ({ requiredModule, children }) => {
  const location = useLocation();
  const activeModule = getActiveModule();

  if (!activeModule) {
    return <Navigate to="/portal" replace state={{ from: location.pathname }} />;
  }

  if (activeModule !== requiredModule) {
    const fallback = activeModule === MODULES.OPERACAO ? '/operacao' : '/';
    return <Navigate to={fallback} replace />;
  }

  return children;
};

export default ModuleGuard;
