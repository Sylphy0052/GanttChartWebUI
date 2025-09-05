import axios, { AxiosInstance, AxiosRequestConfig, AxiosResponse, AxiosError } from 'axios';

export interface ApiError {
  message: string;
  status: number;
  code?: string;
  details?: any;
}

export interface ApiResponse<T = any> {
  data: T;
  success: boolean;
  message?: string;
}

export interface RequestOptions extends AxiosRequestConfig {
  skipAuth?: boolean;
  etag?: string;
  ifMatch?: string;
}

class ApiClient {
  private instance: AxiosInstance;
  private baseURL: string;

  constructor() {
    this.baseURL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001/api';
    
    this.instance = axios.create({
      baseURL: this.baseURL,
      timeout: 10000,
      headers: {
        'Content-Type': 'application/json',
      },
    });

    this.setupInterceptors();
  }

  private setupInterceptors() {
    // Request interceptor
    this.instance.interceptors.request.use(
      (config) => {
        // Add authorization header if available
        const token = this.getAuthToken();
        if (token && !config.headers?.skipAuth) {
          config.headers.Authorization = `Bearer ${token}`;
        }

        return config;
      },
      (error) => {
        return Promise.reject(this.handleError(error));
      }
    );

    // Response interceptor
    this.instance.interceptors.response.use(
      (response) => response,
      (error) => {
        return Promise.reject(this.handleError(error));
      }
    );
  }

  private getAuthToken(): string | null {
    if (typeof window === 'undefined') return null;
    return localStorage.getItem('auth_token');
  }

  private handleError(error: AxiosError): ApiError {
    const apiError: ApiError = {
      message: 'An unexpected error occurred',
      status: error.response?.status || 500,
    };

    if (error.response?.data) {
      const data = error.response.data as any;
      apiError.message = data.message || data.error || apiError.message;
      apiError.code = data.code;
      apiError.details = data.details;
    } else if (error.message) {
      apiError.message = error.message;
    }

    return apiError;
  }

  async get<T = any>(
    url: string,
    options: RequestOptions = {}
  ): Promise<ApiResponse<T>> {
    try {
      const config: AxiosRequestConfig = { ...options };
      
      // Add ETag support for optimistic locking
      if (options.etag) {
        config.headers = {
          ...config.headers,
          'If-None-Match': options.etag,
        };
      }

      const response: AxiosResponse = await this.instance.get(url, config);
      
      return {
        data: response.data,
        success: true,
      };
    } catch (error) {
      throw error;
    }
  }

  async post<T = any>(
    url: string,
    data?: any,
    options: RequestOptions = {}
  ): Promise<ApiResponse<T>> {
    try {
      const config: AxiosRequestConfig = { ...options };
      
      // Add optimistic locking support
      if (options.ifMatch) {
        config.headers = {
          ...config.headers,
          'If-Match': options.ifMatch,
        };
      }

      const response: AxiosResponse = await this.instance.post(url, data, config);
      
      return {
        data: response.data,
        success: true,
      };
    } catch (error) {
      throw error;
    }
  }

  async put<T = any>(
    url: string,
    data?: any,
    options: RequestOptions = {}
  ): Promise<ApiResponse<T>> {
    try {
      const config: AxiosRequestConfig = { ...options };
      
      // Add optimistic locking support
      if (options.ifMatch) {
        config.headers = {
          ...config.headers,
          'If-Match': options.ifMatch,
        };
      }

      const response: AxiosResponse = await this.instance.put(url, data, config);
      
      return {
        data: response.data,
        success: true,
      };
    } catch (error) {
      throw error;
    }
  }

  async patch<T = any>(
    url: string,
    data?: any,
    options: RequestOptions = {}
  ): Promise<ApiResponse<T>> {
    try {
      const config: AxiosRequestConfig = { ...options };
      
      // Add optimistic locking support
      if (options.ifMatch) {
        config.headers = {
          ...config.headers,
          'If-Match': options.ifMatch,
        };
      }

      const response: AxiosResponse = await this.instance.patch(url, data, config);
      
      return {
        data: response.data,
        success: true,
      };
    } catch (error) {
      throw error;
    }
  }

  async delete<T = any>(
    url: string,
    options: RequestOptions = {}
  ): Promise<ApiResponse<T>> {
    try {
      const config: AxiosRequestConfig = { ...options };
      
      // Add optimistic locking support
      if (options.ifMatch) {
        config.headers = {
          ...config.headers,
          'If-Match': options.ifMatch,
        };
      }

      const response: AxiosResponse = await this.instance.delete(url, config);
      
      return {
        data: response.data,
        success: true,
      };
    } catch (error) {
      throw error;
    }
  }

  // Utility method to extract ETag from response headers
  getEtagFromResponse(response: AxiosResponse): string | null {
    return response.headers['etag'] || null;
  }

  // Method to check if request failed due to optimistic locking conflict
  isOptimisticLockingConflict(error: ApiError): boolean {
    return error.status === 409 || error.status === 412;
  }

  // Method to handle batch requests
  async batch<T = any>(
    requests: Array<{
      method: 'get' | 'post' | 'put' | 'patch' | 'delete';
      url: string;
      data?: any;
      options?: RequestOptions;
    }>
  ): Promise<ApiResponse<T>[]> {
    try {
      const promises = requests.map(({ method, url, data, options }) => {
        switch (method) {
          case 'get':
            return this.get(url, options);
          case 'post':
            return this.post(url, data, options);
          case 'put':
            return this.put(url, data, options);
          case 'patch':
            return this.patch(url, data, options);
          case 'delete':
            return this.delete(url, options);
          default:
            throw new Error(`Unsupported method: ${method}`);
        }
      });

      const results = await Promise.allSettled(promises);
      
      return results.map((result, index) => {
        if (result.status === 'fulfilled') {
          return result.value;
        } else {
          throw result.reason;
        }
      });
    } catch (error) {
      throw error;
    }
  }
}

// Create and export singleton instance
export const apiClient = new ApiClient();
export default apiClient;