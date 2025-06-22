const FLASK_API_URL = 'http://localhost:5000';

export class ApiClient {
  private static instance: ApiClient;

  private constructor() {}

  public static getInstance(): ApiClient {
    if (!ApiClient.instance) {
      ApiClient.instance = new ApiClient();
    }
    return ApiClient.instance;
  }

  async makeRequest(endpoint: string, options: RequestInit = {}) {
    const url = endpoint.startsWith('http') ? endpoint : `${FLASK_API_URL}${endpoint}`;
    
    const defaultOptions: RequestInit = {
      credentials: 'include',
      headers: {
        'Content-Type': 'application/json',
        ...options.headers,
      },
    };

    try {
      const response = await fetch(url, { ...defaultOptions, ...options });
      
      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }

      const contentType = response.headers.get('content-type');
      if (contentType && contentType.includes('application/json')) {
        return await response.json();
      }
      
      return await response.text();
    } catch (error) {
      console.error('API request failed:', error);
      throw error;
    }
  }

  // Convenience methods
  async get(endpoint: string) {
    return this.makeRequest(endpoint, { method: 'GET' });
  }

  async post(endpoint: string, data?: any) {
    return this.makeRequest(endpoint, {
      method: 'POST',
      body: data ? JSON.stringify(data) : undefined,
    });
  }

  async put(endpoint: string, data?: any) {
    return this.makeRequest(endpoint, {
      method: 'PUT',
      body: data ? JSON.stringify(data) : undefined,
    });
  }

  async delete(endpoint: string) {
    return this.makeRequest(endpoint, { method: 'DELETE' });
  }

  // Email-specific methods
  async getEmails(maxResults: number = 100, query: string = '') {
    const params = new URLSearchParams();
    params.set('max_results', maxResults.toString());
    if (query) params.set('q', query);
    
    return this.get(`/api/emails?${params.toString()}`);
  }

  async getEmailDetails(emailId: string) {
    return this.get(`/api/email/${emailId}`);
  }

  async markEmailAsRead(emailId: string) {
    return this.post(`/api/email/${emailId}/mark-read`);
  }

  async deleteEmail(emailId: string) {
    return this.delete(`/api/email/${emailId}`);
  }

  async loadInbox() {
    return this.get('/api/load-inbox');
  }

  async startCategorization(query?: string) {
    const params = query ? `?query=${encodeURIComponent(query)}` : '';
    return this.get(`/categorize${params}`);
  }

  async checkAuthStatus() {
    return this.get('/');
  }

  async logout() {
    return this.get('/logout');
  }
}

export const apiClient = ApiClient.getInstance(); 