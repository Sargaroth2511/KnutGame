import type { SessionEvents } from '../systems/SessionEventsBuffer'

/**
 * Response from starting a new game session
 */
export interface StartSessionResponse {
  /** Unique identifier for the game session */
  sessionId: string;
  /** UTC timestamp when the session was issued by the server */
  issuedUtc: string;
}

/**
 * Request payload for submitting a completed game session
 */
export interface SubmitSessionRequest {
  /** Session identifier from the start session response */
  sessionId: string;
  /** Canvas width in pixels at the time of gameplay */
  canvasWidth: number;
  /** Canvas height in pixels at the time of gameplay */
  canvasHeight: number;
  /** UTC timestamp when the client started the session */
  clientStartUtc: string;
  /** UTC timestamp when the client ended the session */
  clientEndUtc: string;
  /** Game events that occurred during the session */
  events: SessionEvents;
}

/**
 * Response from submitting a completed game session
 */
export interface SubmitSessionResponse {
  /** Whether the session submission was accepted */
  accepted: boolean;
  /** Reason for rejection if the session was not accepted */
  rejectionReason?: string;
  /** Final score calculated for the session */
  score?: number;
  /** Global ranking of the player */
  rank?: number;
  /** Total number of players in the ranking system */
  totalPlayers?: number;
}

/**
 * Service for handling API communication with the game server.
 * Provides methods for starting and submitting game sessions.
 */
export class ApiService {
  private readonly baseUrl: string;

  /**
   * Creates a new ApiService instance
   * @param baseUrl - Base URL for the API endpoints (optional, defaults to empty string)
   */
  constructor(baseUrl: string = '') {
    this.baseUrl = baseUrl;
  }

  /**
   * Starts a new game session by requesting a session ID from the server
   * @returns Promise resolving to session start response with sessionId and timestamp
   * @throws Error if the server request fails
   */
  async startSession(): Promise<StartSessionResponse> {
    const response = await fetch(`${this.baseUrl}/api/session/start`, { method: 'POST' });
    if (!response.ok) throw new Error('Failed to start session');
    return response.json();
  }

  /**
   * Submits a completed game session with all game events and metadata
   * @param payload - Complete session data including events, timing, and canvas dimensions
   * @returns Promise resolving to submission response with score and ranking information
   * @throws Error if the server request fails
   */
  async submitSession(payload: SubmitSessionRequest): Promise<SubmitSessionResponse> {
    const response = await fetch(`${this.baseUrl}/api/session/submit`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    });
    if (!response.ok) throw new Error('Failed to submit session');
    return response.json();
  }
}

// For backward compatibility, export the functions using a default instance
const defaultApiService = new ApiService();

/**
 * Starts a new game session (legacy function for backward compatibility)
 * @deprecated Use ApiService.startSession() instead for better control
 * @returns Promise resolving to session start response
 */
export async function startSession(): Promise<StartSessionResponse> {
  return defaultApiService.startSession();
}

/**
 * Submits a completed game session (legacy function for backward compatibility)
 * @deprecated Use ApiService.submitSession() instead for better control
 * @param payload - Complete session data
 * @returns Promise resolving to submission response
 */
export async function submitSession(payload: SubmitSessionRequest): Promise<SubmitSessionResponse> {
  return defaultApiService.submitSession(payload);
}
