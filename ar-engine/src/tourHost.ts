/** Same-origin tour integration. Preview/Quick Look/closing do not complete a mission. */
export function notifyTourHost(experience: 'starseed' | 'black-uniform', mode: 'world' | 'webxr' | 'image'): void {
  const params = new URLSearchParams(location.search);
  const token = params.get('hostToken');
  if (window.parent === window || params.get('tourHost') !== '1' || !token) return;
  window.parent.postMessage({ source: 'byeol-ar', event: 'completed', token, experience, mode }, location.origin);
}

export function closeTourHost(experience: 'black-uniform'): boolean {
  const params = new URLSearchParams(location.search), token = params.get('hostToken');
  if (window.parent === window || params.get('tourHost') !== '1' || !token) return false;
  window.parent.postMessage({ source: 'byeol-ar', event: 'closed', token, experience }, location.origin);
  return true;
}
