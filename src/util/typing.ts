/** True when a key event is aimed at a text field, so game keys leave it alone. */
export const isTyping = (e: Event): boolean =>
  e.target instanceof HTMLInputElement || e.target instanceof HTMLTextAreaElement || e.target instanceof HTMLSelectElement;
