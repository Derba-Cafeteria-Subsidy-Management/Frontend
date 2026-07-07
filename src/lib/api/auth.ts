import type {
  MessageResponse,
  RefreshTokenResponse,
} from '../auth/types';
import {
  clearTokens,
  getAccessToken,
  setStoredUser,
  setTokens,
} from '../auth/tokenStorage';
import type { User } from '../../db/db';
import { apiRequest } from './client';
import { normalizeAuthTokens } from './response';

export async function loginRequest(
  email: string,
  password: string,
  rememberMe = true,
): Promise<User> {
  try {
    console.log('Login request started for:', email);
    
    // Make the login request
    const loginBody = await apiRequest<unknown>('/api/auth/login', {
      method: 'POST',
      body: JSON.stringify({ email, password }),
      skipAuth: true,
      skipRefresh: true,
    });

    console.log('Login response received:', loginBody);

    // Check if loginBody is valid
    if (!loginBody) {
      console.error('Login response is null or undefined');
      throw new Error('No response received from login request');
    }

    // Extract tokens from the response
    let tokens;
    try {
      tokens = normalizeAuthTokens(loginBody);
      console.log('Tokens normalized successfully');
    } catch (normalizeError) {
      console.error('Failed to normalize tokens:', normalizeError);
      console.error('Login body was:', loginBody);
      throw new Error('Invalid authentication response format');
    }

    // Store tokens
    try {
      setTokens(tokens.accessToken, tokens.refreshToken, rememberMe);
      console.log('Tokens stored successfully');
    } catch (storeError) {
      console.error('Failed to store tokens:', storeError);
      throw new Error('Failed to store authentication tokens');
    }

    // Extract user data from the response
    let userData: any;
    try {
      const responseObj = loginBody as Record<string, any>;
      if (responseObj.data && responseObj.data.user) {
        userData = responseObj.data.user;
        console.log('User data extracted from nested response');
      } else if (responseObj.user) {
        userData = responseObj.user;
        console.log('User data extracted from root response');
      } else {
        console.error('No user data found in response:', loginBody);
        throw new Error('No user data in response');
      }
    } catch (extractError) {
      console.error('Failed to extract user data:', extractError);
      clearTokens();
      throw new Error('Invalid user data in response');
    }

    // Map API user to your User type
    const user: User = {
      id: userData.id || '',
      username: userData.email || '', // Use email as username since ApiUser doesn't have username
      email: userData.email || '',
      role: userData.role === 'ADMIN' ? 'Admin' : 
            userData.role === 'CASHIER' ? 'Cashier' : 
            userData.role === 'SUPER_ADMIN' ? 'Super Admin' : 
            'Cashier', // Default to Cashier if unknown
      status: userData.status === 'ACTIVE' ? 'Active' : 
              userData.status === 'PENDING' ? 'Pending' : 
              userData.status === 'INACTIVE' ? 'Inactive' : 'Active',
      createdAt: userData.createdAt || new Date().toISOString(),
      lastLogin: userData.lastLogin || new Date().toISOString(),
    };

    console.log('User mapped successfully:', user.email, 'Role:', user.role);

    // Store user data
    try {
      setStoredUser(JSON.stringify(user));
    } catch (storeUserError) {
      console.error('Failed to store user data:', storeUserError);
      // Don't throw here, user is still logged in
    }

    return user;
  } catch (error) {
    console.error('Login request failed:', error);
    // Clean up any partial state
    try {
      clearTokens();
    } catch (clearError) {
      console.error('Failed to clear tokens after error:', clearError);
    }
    throw error;
  }
}

export async function fetchCurrentUser(): Promise<User | null> {
  try {
    const token = getAccessToken();
    if (!token) {
      console.log('No token found, cannot fetch user');
      return null;
    }

    console.log('Fetching current user...');
    const response = await apiRequest<any>('/api/auth/me');
    
    if (!response) {
      console.error('No response received');
      clearTokens();
      return null;
    }

    // Extract user data from response
    let userData: any = response;
    const responseObj = response as Record<string, any>;
    
    // Check different response structures
    if (responseObj.data && responseObj.data.user) {
      userData = responseObj.data.user;
      console.log('User data extracted from nested response');
    } else if (responseObj.user) {
      userData = responseObj.user;
      console.log('User data extracted from root response');
    } else if (responseObj.id) {
      // If the response itself is the user object
      userData = responseObj;
      console.log('Response is the user object directly');
    }

    // Map to User type
    const user: User = {
      id: userData.id || '',
      username: userData.email || '', // Use email as username
      email: userData.email || '',
      role: userData.role === 'ADMIN' ? 'Admin' : 
            userData.role === 'CASHIER' ? 'Cashier' : 
            userData.role === 'SUPER_ADMIN' ? 'Super Admin' : 
            'Cashier',
      status: userData.status === 'ACTIVE' ? 'Active' : 
              userData.status === 'PENDING' ? 'Pending' : 
              userData.status === 'INACTIVE' ? 'Inactive' : 'Active',
      createdAt: userData.createdAt || new Date().toISOString(),
      lastLogin: userData.lastLogin || new Date().toISOString(),
    };
    
    console.log('User fetched successfully:', user.email);
    setStoredUser(JSON.stringify(user));
    return user;
  } catch (error) {
    console.error('Error fetching current user:', error);
    // If we get an auth error, clear tokens
    if (error instanceof Error && 
        (error.message.includes('401') || 
         error.message.includes('Unauthorized') ||
         error.message.includes('invalid token'))) {
      clearTokens();
    }
    return null;
  }
}

export async function logoutRequest(): Promise<void> {
  try {
    await apiRequest<MessageResponse>('/api/auth/logout', { method: 'POST' });
  } catch (error) {
    console.error('Error during logout:', error);
    // Continue with token cleanup even if API call fails
  } finally {
    try {
      clearTokens();
    } catch (clearError) {
      console.error('Error clearing tokens during logout:', clearError);
    }
  }
}

export async function logoutAllRequest(): Promise<void> {
  try {
    await apiRequest<MessageResponse>('/api/auth/logout-all', { method: 'POST' });
  } catch (error) {
    console.error('Error during logout all:', error);
    // Continue with token cleanup even if API call fails
  } finally {
    try {
      clearTokens();
    } catch (clearError) {
      console.error('Error clearing tokens during logout all:', clearError);
    }
  }
}

export async function inviteUserRequest(email: string, role: 'ADMIN' | 'CASHIER'): Promise<MessageResponse> {
  try {
    return await apiRequest<MessageResponse>('/api/auth/invite', {
      method: 'POST',
      body: JSON.stringify({ email, role }),
    });
  } catch (error) {
    console.error('Error inviting user:', error);
    throw error;
  }
}

export async function acceptInvitationRequest(token: string, password: string): Promise<MessageResponse> {
  try {
    if (!token || !password) {
      throw new Error('Token and password are required');
    }
    return await apiRequest<MessageResponse>('/api/auth/accept-invitation', {
      method: 'POST',
      body: JSON.stringify({ token, password }),
      skipAuth: true,
      skipRefresh: true,
    });
  } catch (error) {
    console.error('Error accepting invitation:', error);
    throw error;
  }
}

export async function forgotPasswordRequest(email: string): Promise<MessageResponse> {
  try {
    if (!email) {
      throw new Error('Email is required');
    }
    return await apiRequest<MessageResponse>('/api/auth/forgot-password', {
      method: 'POST',
      body: JSON.stringify({ email }),
      skipAuth: true,
      skipRefresh: true,
    });
  } catch (error) {
    console.error('Error requesting password reset:', error);
    throw error;
  }
}

export async function resetPasswordRequest(token: string, password: string): Promise<MessageResponse> {
  try {
    if (!token || !password) {
      throw new Error('Token and password are required');
    }
    return await apiRequest<MessageResponse>('/api/auth/reset-password', {
      method: 'POST',
      body: JSON.stringify({ token, password }),
      skipAuth: true,
      skipRefresh: true,
    });
  } catch (error) {
    console.error('Error resetting password:', error);
    throw error;
  }
}

export async function refreshTokenRequest(refreshToken: string): Promise<RefreshTokenResponse> {
  try {
    if (!refreshToken) {
      throw new Error('Refresh token is required');
    }
    return await apiRequest<RefreshTokenResponse>('/api/auth/refresh-token', {
      method: 'POST',
      body: JSON.stringify({ refreshToken }),
      skipAuth: true,
      skipRefresh: true,
    });
  } catch (error) {
    console.error('Error refreshing token:', error);
    throw error;
  }
}

export { clearTokens };