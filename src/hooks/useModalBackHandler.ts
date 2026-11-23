import { useEffect, useId, useRef } from 'react';

const MODAL_STATE_KEY = '__suiviModalOpen';

interface ModalEntry {
  id: string;
  close: () => void;
}

const modalStack: ModalEntry[] = [];
let syncScheduled = false;
let pendingBack = false;
let listenerAttached = false;

function hasModalHistoryState(): boolean {
  const st = window.history.state as Record<string, unknown> | null;
  return Boolean(st && st[MODAL_STATE_KEY] === true);
}

function pushModalHistoryState(): void {
  const prev =
    window.history.state && typeof window.history.state === 'object'
      ? (window.history.state as Record<string, unknown>)
      : {};
  window.history.pushState({ ...prev, [MODAL_STATE_KEY]: true }, '');
}

function runSync(): void {
  syncScheduled = false;
  if (typeof window === 'undefined') return;

  if (modalStack.length > 0) {
    if (!pendingBack && !hasModalHistoryState()) {
      pushModalHistoryState();
    }
  } else if (!pendingBack && hasModalHistoryState()) {
    pendingBack = true;
    window.history.back();
  }
}

function scheduleSync(): void {
  if (syncScheduled) return;
  syncScheduled = true;
  queueMicrotask(runSync);
}

function handlePopState(): void {
  if (pendingBack) {
    pendingBack = false;
    if (modalStack.length > 0) {
      scheduleSync();
    }
    return;
  }

  if (modalStack.length > 0) {
    const top = modalStack.pop();
    if (top) {
      top.close();
    }
    if (modalStack.length > 0) {
      scheduleSync();
    }
  }
}

function ensureListener(): void {
  if (listenerAttached || typeof window === 'undefined') return;
  window.addEventListener('popstate', handlePopState);
  listenerAttached = true;
}

export function useModalBackHandler(isOpen: boolean, onClose: () => void): void {
  const id = useId();
  const onCloseRef = useRef(onClose);
  onCloseRef.current = onClose;

  useEffect(() => {
    if (!isOpen) return;
    ensureListener();

    const entry: ModalEntry = {
      id,
      close: () => onCloseRef.current(),
    };
    modalStack.push(entry);
    scheduleSync();

    return () => {
      const idx = modalStack.findIndex((item) => item.id === id);
      if (idx !== -1) {
        modalStack.splice(idx, 1);
      }
      scheduleSync();
    };
  }, [isOpen, id]);
}
