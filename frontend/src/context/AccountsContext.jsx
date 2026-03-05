import React, { createContext, useState, useEffect, useCallback } from 'react';
import { AccountsAPI } from '../apis/accounts';
import { jwtDecode } from 'jwt-decode';

export const AccountsContext = createContext();

// Helper function to get token outside of React components
export function getUserToken() {
  try {
    const token = localStorage.getItem('access_token');
    if (!token) return null;

    // Check if token is still valid
    try {
      const decoded = jwtDecode(token);
      const currentTime = Date.now() / 1000;
      
      if (decoded.exp > currentTime) {
        return token;
      } else {
        // Token expired, remove it
        localStorage.removeItem('access_token');
        localStorage.removeItem('refresh_token');
        localStorage.removeItem('user');
        return null;
      }
    } catch (decodeError) {
      console.error("Error decoding token:", decodeError);
      return null;
    }
  } catch (error) {
    console.error('Error getting user token:', error);
    return null;
  }
}

export function AccountsProvider({ children }) {
  const [user, setUser] = useState(() => {
    const storedUser = localStorage.getItem('user');
    return storedUser ? JSON.parse(storedUser) : null;
  });
  
  const [token, setToken] = useState(() => localStorage.getItem('access_token'));
  const [isAuthenticated, setIsAuthenticated] = useState(() => {
    const storedToken = localStorage.getItem('access_token');
    if (!storedToken) return false;
    
    try {
      const decoded = jwtDecode(storedToken);
      const currentTime = Date.now() / 1000;
      return decoded.exp > currentTime;
    } catch {
      return false;
    }
  });
  const [loading, setLoading] = useState(false);
  const [authLoading, setAuthLoading] = useState(true);

  // ========== LOGIN FUNCTION ==========
  const login = useCallback(async (identifier, password) => {
    setLoading(true);
    try {
      // 1. Call API to authenticate
      const response = await AccountsAPI.login(identifier, password);
      const { user: userData, tokens } = response;
      
      // 2. Store everything in localStorage
      localStorage.setItem('access_token', tokens.access);
      localStorage.setItem('refresh_token', tokens.refresh);
      localStorage.setItem('user', JSON.stringify(userData));
      
      // 3. Sync dark mode if exists
      if (userData.dark_mode !== undefined) {
        localStorage.setItem('darkMode', userData.dark_mode);
      }
      
      // 4. Update React state
      setUser(userData);
      setToken(tokens.access);
      setIsAuthenticated(true);
      
      return { user: userData, tokens };
    } catch (error) {
      // Return error without showing notification (let page handle it)
      throw error;
    } finally {
      setLoading(false);
    }
  }, []);

  // ========== LOGOUT FUNCTION ==========
  const logout = useCallback(async () => {
    setLoading(true);
    try {
      // 1. Try API logout (non-blocking)
      try {
        await AccountsAPI.logout();
      } catch (apiError) {
        console.warn('API logout failed, continuing with local cleanup');
      }
      
      // 2. Clear auth state from localStorage (but keep darkMode)
      localStorage.removeItem('access_token');
      localStorage.removeItem('refresh_token');
      localStorage.removeItem('user');
      
      // 3. Clear React state
      setUser(null);
      setToken(null);
      setIsAuthenticated(false);
      
      // 4. Redirect to login page
      if (window.location.pathname !== '/login') {
        window.location.href = '/login';
      }
    } catch (error) {
      console.error('Logout error:', error);
    } finally {
      setLoading(false);
    }
  }, []);

  // ========== UPDATE USER FUNCTION ==========
  const updateUser = useCallback((userData) => {
    try {
      // Update both React state and localStorage
      setUser(userData);
      localStorage.setItem('user', JSON.stringify(userData));
    } catch (error) {
      console.error('Update user error:', error);
    }
  }, []);

  // ========== UPDATE DARK MODE FUNCTION ==========
  const updateDarkMode = useCallback(async (darkMode) => {
    // Always update localStorage immediately for responsive UI
    localStorage.setItem('darkMode', darkMode);
    
    // If user is authenticated, also update server
    if (isAuthenticated && user) {
      // Only update if value changed
      if (user.dark_mode === darkMode) return;
      
      setLoading(true);
      try {
        await AccountsAPI.updateDarkMode(darkMode);
        // Update user in state
        const newUserData = { ...user, dark_mode: darkMode };
        setUser(newUserData);
        localStorage.setItem('user', JSON.stringify(newUserData));
      } catch (error) {
        console.error('Failed to update dark mode on server:', error);
        // Server update failed, but localStorage is already updated
      } finally {
        setLoading(false);
      }
    }
  }, [isAuthenticated, user]);

  // ========== TOKEN VALIDATION EFFECTS ==========
  useEffect(() => {
    const checkToken = () => {
      const token = localStorage.getItem('access_token');
      if (!token) {
        if (isAuthenticated) {
          setIsAuthenticated(false);
          setUser(null);
          setToken(null);
        }
        return;
      }
      
      try {
        const decoded = jwtDecode(token);
        const currentTime = Date.now() / 1000;
        const isValid = decoded.exp > currentTime;
        
        if (!isValid && isAuthenticated) {
          // Token expired, clear local state but don't redirect
          setIsAuthenticated(false);
          setUser(null);
          setToken(null);
        } else if (isValid && !isAuthenticated) {
          // Token is valid but state says not authenticated
          setIsAuthenticated(true);
        }
      } catch (error) {
        console.error('Token validation error:', error);
        if (isAuthenticated) {
          setIsAuthenticated(false);
          setUser(null);
          setToken(null);
        }
      }
    };

    // Check immediately on mount
    checkToken();
    setAuthLoading(false);

    // Check every 2 minutes
    const interval = setInterval(checkToken, 120000);

    return () => clearInterval(interval);
  }, [isAuthenticated]);

  // Clear expired tokens on app load
  useEffect(() => {
    const clearExpiredTokens = () => {
      const token = localStorage.getItem('access_token');
      if (!token) return;
      
      try {
        const decoded = jwtDecode(token);
        const currentTime = Date.now() / 1000;
        
        if (decoded.exp < currentTime) {
          // Token expired, clear auth state
          localStorage.removeItem('access_token');
          localStorage.removeItem('refresh_token');
          localStorage.removeItem('user');
          setUser(null);
          setToken(null);
          setIsAuthenticated(false);
        }
      } catch (error) {
        console.error('Token validation error on load:', error);
      }
    };
    
    clearExpiredTokens();
  }, []);

  // ========== CONTEXT VALUE ==========
  return (
    <AccountsContext.Provider value={{ 
      user, 
      token, 
      isAuthenticated,
      loading: authLoading,
      authLoading,
      login,
      logout,
      updateUser,
      updateDarkMode 
    }}>
      {children}
    </AccountsContext.Provider>
  );
}