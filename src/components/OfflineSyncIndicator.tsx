import React, { useState, useEffect } from 'react';
import { Wifi, WifiOff, RefreshCw, CheckCircle2, CloudUpload } from 'lucide-react';
import { syncEngine, SyncEngineStatus } from '../lib/syncEngine';

export const OfflineSyncIndicator: React.FC = () => {
  const [status, setStatus] = useState<SyncEngineStatus>({
    isOnline: typeof navigator !== 'undefined' ? navigator.onLine : true,
    isSyncing: false,
    pendingCount: 0,
    lastSyncAt: null,
    lastError: null,
  });

  const [showSyncedToast, setShowSyncedToast] = useState(false);
  const [prevPending, setPrevPending] = useState(0);

  useEffect(() => {
    const unsubscribe = syncEngine.subscribe((newStatus) => {
      setStatus(newStatus);

      // Trigger celebratory toast when pending count goes from > 0 down to 0 while online
      if (prevPending > 0 && newStatus.pendingCount === 0 && newStatus.isOnline) {
        setShowSyncedToast(true);
        setTimeout(() => setShowSyncedToast(false), 3500);
      }
      setPrevPending(newStatus.pendingCount);
    });

    return () => unsubscribe();
  }, [prevPending]);

  const handleManualSync = async () => {
    if (!status.isOnline || status.isSyncing) return;
    await syncEngine.drainQueue();
  };

  // If online, not syncing, and no pending changes, keep the UI clean (show only brief toast if just synced)
  if (status.isOnline && status.pendingCount === 0 && !status.isSyncing && !showSyncedToast) {
    return null;
  }

  return (
    <aside aria-label="Connectivity and sync status" className="fixed bottom-16 md:bottom-5 right-4 z-40 flex flex-col items-end gap-2 animate-in fade-in slide-in-from-bottom-3 duration-200">
      {/* Toast when offline changes were successfully pushed to server */}
      {showSyncedToast && (
        <div className="flex items-center gap-2 px-3.5 py-2 rounded-xl bg-emerald-500/15 border border-emerald-500/40 text-emerald-300 text-xs font-semibold shadow-xl backdrop-blur-md">
          <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0" />
          <span>All local changes synced to cloud</span>
        </div>
      )}

      {/* Offline Banner or Syncing Pill */}
      {!status.isOnline ? (
        <div className="flex items-center gap-2.5 px-3.5 py-2 rounded-xl bg-amber-500/20 border border-amber-500/40 text-amber-200 text-xs font-medium shadow-2xl backdrop-blur-md">
          <WifiOff className="w-4 h-4 text-amber-400 shrink-0" />
          <div className="flex flex-col">
            <span className="font-semibold text-white">Offline Mode</span>
            <span className="text-[11px] text-amber-300/80">
              {status.pendingCount > 0
                ? `${status.pendingCount} change${status.pendingCount > 1 ? 's' : ''} queued for sync`
                : 'Working from local offline cache'}
            </span>
          </div>
        </div>
      ) : status.isSyncing ? (
        <div className="flex items-center gap-2 px-3.5 py-2 rounded-xl bg-[#00B4FF]/20 border border-[#00B4FF]/40 text-[#00B4FF] text-xs font-semibold shadow-xl backdrop-blur-md">
          <RefreshCw className="w-3.5 h-3.5 animate-spin shrink-0" />
          <span>Syncing {status.pendingCount} change{status.pendingCount > 1 ? 's' : ''} to server...</span>
        </div>
      ) : status.pendingCount > 0 ? (
        <div className="flex items-center gap-2 px-3.5 py-2 rounded-xl bg-sky-950/80 border border-sky-600/40 text-sky-200 text-xs shadow-xl backdrop-blur-md">
          <CloudUpload className="w-4 h-4 text-[#00B4FF] shrink-0" />
          <span>{status.pendingCount} change{status.pendingCount > 1 ? 's' : ''} pending</span>
          <button
            onClick={handleManualSync}
            className="ml-1.5 px-2 py-0.5 rounded-lg bg-[#00B4FF] hover:bg-[#009de0] text-[#0B1F44] text-[11px] font-bold transition-colors cursor-pointer"
          >
            Sync Now
          </button>
        </div>
      ) : null}
    </aside>
  );
};
