const API_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3000';

export interface User {
  id: string;
  name: string;
  email: string;
  createdAt: string;
}

export interface Incident {
  id: string;
  title: string;
  description: string;
  severity: 'P1' | 'P2' | 'P3';
  status: 'OPEN' | 'ACK' | 'RESOLVED';
  createdBy: string;
  createdAt: string;
  updatedAt: string;
  user?: User;
  events?: Event[];
}

export interface Event {
  id: string;
  incidentId: string;
  type: 'CREATED' | 'STATUS_CHANGED' | 'COMMENTED';
  payload: any;
  createdAt: string;
}

export interface ListResponse {
  data: Incident[];
  pagination: {
    page: number;
    limit: number;
    total: number;
    totalPages: number;
  };
}

async function fetchAPI(endpoint: string, options?: RequestInit) {
  const response = await fetch(`${API_URL}${endpoint}`, {
    ...options,
    headers: {
      'Content-Type': 'application/json',
      ...options?.headers,
    },
  });

  if (!response.ok) {
    const error = await response.json().catch(() => ({ message: 'Request failed' }));
    throw new Error(error.message || 'Request failed');
  }

  return response.json();
}

export async function getIncidents(params?: {
  status?: string;
  severity?: string;
  page?: number;
  limit?: number;
}): Promise<ListResponse> {
  const searchParams = new URLSearchParams();
  if (params?.status) searchParams.set('status', params.status);
  if (params?.severity) searchParams.set('severity', params.severity);
  if (params?.page) searchParams.set('page', params.page.toString());
  if (params?.limit) searchParams.set('limit', params.limit.toString());

  const query = searchParams.toString();
  return fetchAPI(`/v1/incidents${query ? `?${query}` : ''}`);
}

export async function getIncident(id: string): Promise<Incident> {
  return fetchAPI(`/v1/incidents/${id}`);
}

export async function createIncident(data: {
  title: string;
  description: string;
  severity: 'P1' | 'P2' | 'P3';
  createdBy: string;
}): Promise<Incident> {
  return fetchAPI('/v1/incidents', {
    method: 'POST',
    body: JSON.stringify(data),
  });
}

export async function updateIncidentStatus(
  id: string,
  status: 'OPEN' | 'ACK' | 'RESOLVED'
): Promise<Incident> {
  return fetchAPI(`/v1/incidents/${id}/status`, {
    method: 'PATCH',
    body: JSON.stringify({ status }),
  });
}

export async function addComment(
  id: string,
  comment: string,
  userId: string
): Promise<Event> {
  return fetchAPI(`/v1/incidents/${id}/comments`, {
    method: 'POST',
    body: JSON.stringify({ comment, userId }),
  });
}

export async function getUsers(): Promise<User[]> {
  // For simplicity, we'll handle this client-side
  // In a real app, you'd have a /v1/users GET endpoint
  return [];
}

export async function createUser(data: { name: string; email: string }): Promise<User> {
  return fetchAPI('/v1/users', {
    method: 'POST',
    body: JSON.stringify(data),
  });
}
