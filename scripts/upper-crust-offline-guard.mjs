// Enforced for the entire local concept process, including accidental API visits.
const originalFetch = globalThis.fetch;
globalThis.fetch = function (input, init) {
  const url = new URL(typeof input === 'string' || input instanceof URL ? input : input.url);
  if (!['127.0.0.1', 'localhost'].includes(url.hostname)) {
    return Promise.reject(new Error('Private concept prohibits remote service requests'));
  }
  return originalFetch(input, init);
};
