import React, { createContext, useContext, useCallback } from 'react';

export interface AuditLogEntry {
  at: string;
  userId: string;
  action: string;
  targetId?: string;
  result: 'success' | 'failure';
  failureCode?: string;
}

const STORAGE_KEY = 'lets_audit_log';
const MAX_ENTRIES = 5000;
const RETENTION_MS = 365 * 24 * 60 * 60 * 1000; // 1年

function loadLogs(): AuditLogEntry[] {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    const list: AuditLogEntry[] = raw ? JSON.parse(raw) : [];
    const cutoff = new Date(Date.now() - RETENTION_MS).toISOString();
    const trimmed = list.filter((e) => e.at >= cutoff);
    if (trimmed.length !== list.length) {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(trimmed.slice(-MAX_ENTRIES)));
      return trimmed;
    }
    return list.slice(-MAX_ENTRIES);
  } catch {
    return [];
  }
}

function saveLogs(list: AuditLogEntry[]) {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(list.slice(-MAX_ENTRIES)));
  } catch (_) {}
}

interface AuditContextValue {
  log: (params: { userId: string; action: string; targetId?: string; result: 'success' | 'failure'; failureCode?: string }) => void;
  getLogs: () => AuditLogEntry[];
}

const AuditContext = createContext<AuditContextValue | null>(null);

export function AuditProvider({ children }: { children: React.ReactNode }) {
  const log = useCallback((params: { userId: string; action: string; targetId?: string; result: 'success' | 'failure'; failureCode?: string }) => {
    const entry: AuditLogEntry = {
      at: new Date().toISOString(),
      userId: params.userId,
      action: params.action,
      targetId: params.targetId,
      result: params.result,
      failureCode: params.failureCode,
    };
    const list = loadLogs();
    list.push(entry);
    saveLogs(list);
  }, []);

  const getLogs = useCallback(() => loadLogs(), []);

  return (
    <AuditContext.Provider value={{ log, getLogs }}>
      {children}
    </AuditContext.Provider>
  );
}

export function useAudit() {
  const ctx = useContext(AuditContext);
  if (!ctx) throw new Error('useAudit must be used within AuditProvider');
  return ctx;
}
