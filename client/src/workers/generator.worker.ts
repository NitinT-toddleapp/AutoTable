import { generateCandidates, type GeneratePayload } from '../scheduler-core';

type GenerateMessage = {
  type: 'generate';
  payload: GeneratePayload;
};

self.onmessage = (event: MessageEvent<GenerateMessage>) => {
  if (event.data.type !== 'generate') return;
  const candidates = generateCandidates(event.data.payload);
  self.postMessage({ type: 'result', candidates });
};
