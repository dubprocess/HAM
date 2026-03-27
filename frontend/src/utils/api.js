import axios from 'axios';

const API_BASE_URL = process.env.REACT_APP_API_URL || 'http://localhost:8000';
const LOCAL_AUTH = process.env.REACT_APP_LOCAL_AUTH === 'true';

const apiClient = axios.create({
  baseURL: API_BASE_URL,
  headers: { 'Content-Type': 'application/json' },
});

// Request interceptor — attach auth token
apiClient.interceptors.request.use(
  async (config) => {
    if (LOCAL_AUTH) {
      // Local auth: read token from ham-local-token
      const token = localStorage.getItem('ham-local-token');
      if (token) {
        config.headers.Authorization = `Bearer ${token}`;
      }
    } else {
      // OIDC: read token from Okta storage
      const token = localStorage.getItem('okta-token-storage');
      if (token) {
        const tokenData = JSON.parse(token);
        if (tokenData?.accessToken?.accessToken) {
          config.headers.Authorization = `Bearer ${tokenData.accessToken.accessToken}`;
        }
      }
    }
    return config;
  },
  (error) => Promise.reject(error)
);

// Response interceptor — handle 401
apiClient.interceptors.response.use(
  (response) => response.data,
  (error) => {
    if (error.response?.status === 401) {
      if (LOCAL_AUTH) {
        localStorage.removeItem('ham-local-token');
        localStorage.removeItem('ham-local-user');
      }
      window.location.href = '/login';
    }
    return Promise.reject(error);
  }
);

export { apiClient };
