// D2 - Requisition History. Past requisitions are kept on this device only
// (localStorage key "kf.requisitions") so a buyer can re-order quickly.
// Only order facts are kept - no phone number or email.
import { config } from '../config.js';

const MAX = 20;

export function readHistory() {
  try {
    const rows = JSON.parse(localStorage.getItem(config.historyKey) || '[]');
    return Array.isArray(rows) ? rows : [];
  } catch {
    return []; // storage blocked or corrupted - behave as if empty
  }
}

export function saveToHistory(entry) {
  try {
    const rows = [entry, ...readHistory().filter((r) => r.ref !== entry.ref)].slice(0, MAX);
    localStorage.setItem(config.historyKey, JSON.stringify(rows));
  } catch {
    /* private browsing or storage full: history is a convenience only */
  }
}

export function clearHistory() {
  try {
    localStorage.removeItem(config.historyKey);
  } catch {
    /* nothing to clear */
  }
}
