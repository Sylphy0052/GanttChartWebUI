/**
 * T034 AC1: External Integration - Webhook Event Types
 */

export interface WebhookEvent {
  source: 'gitlab' | 'github' | 'generic';
  event_type: 'issue.created' | 'issue.updated' | 'issue.closed' | 'ping';
  timestamp: string;
  signature?: string;
  payload: {
    issue?: {
      id: string;
      title: string;
      description: string;
      status: string;
      assignee?: string;
      labels?: string[];
      created_at: string;
      updated_at: string;
    };
    user?: {
      id: string;
      name: string;
      email: string;
    };
    repository?: {
      id: string;
      name: string;
      url: string;
    };
  };
}

export interface WebhookValidationResult {
  isValid: boolean;
  error?: string;
  parsedEvent?: WebhookEvent;
}

export interface WebhookProcessResult {
  success: boolean;
  message: string;
  processedAt: string;
  eventId?: string;
}