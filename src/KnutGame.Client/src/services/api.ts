export interface StartSessionResponse {
  sessionId: string;
  issuedUtc: string;
}

export interface SubmitSessionRequest {
  sessionId: string;
  canvasWidth: number;
  canvasHeight: number;
  clientStartUtc: string;
  clientEndUtc: string;
  events: {
    moves: { t: number; x: number }[];
    hits: { t: number }[];
    items: { t: number; id: string; type: 'POINTS' | 'LIFE' | 'SLOWMO' | 'MULTI' | 'ANGEL'; x: number; y: number }[];
  };
}

export interface SubmitSessionResponse {
  accepted: boolean;
  rejectionReason?: string;
  score?: number;
  rank?: number;
  totalPlayers?: number;
}

export async function startSession(): Promise<StartSessionResponse> {
  const response = await fetch('/api/session/start', { method: 'POST' });
  if (!response.ok) throw new Error('Failed to start session');
  return response.json();
}

export async function submitSession(payload: SubmitSessionRequest): Promise<SubmitSessionResponse> {
  const response = await fetch('/api/session/submit', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload),
  });
  if (!response.ok) throw new Error('Failed to submit session');
  return response.json();
}
