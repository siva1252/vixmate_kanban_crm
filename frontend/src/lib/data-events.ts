/** Broadcast when lead/board/activity data changes so mounted views refetch. */

export const DATA_CHANGED_EVENT = "vix:data-changed";

export function notifyDataChanged() {
  if (typeof window === "undefined") return;
  window.dispatchEvent(new Event(DATA_CHANGED_EVENT));
}
