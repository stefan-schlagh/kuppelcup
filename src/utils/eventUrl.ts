// Shareable deep-link URL for an event. Events are reached by URL only
// (?event=<id>); the app reads this param on load to select the event.
export const eventUrl = (id: string): string =>
  `${window.location.origin}${window.location.pathname}?event=${encodeURIComponent(id)}`;
