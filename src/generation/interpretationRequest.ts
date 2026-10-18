let active: AbortController | null = null;
export function cancelInterpretation() {
  active?.abort();
  active = null;
}
export function beginInterpretation() {
  cancelInterpretation();
  active = new AbortController();
  return active;
}
