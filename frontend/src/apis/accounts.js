import axios from "axios";
import { getUserToken } from "../context/AccountsContext";
import { BASE_URL } from "./base_url";

const getAuthHeaders = () => {
  const token = getUserToken();
  return token ? { Authorization: `Bearer ${token}` } : {};
};

export const AccountsAPI = {
  register: async (data) => {
    console.log(BASE_URL);
    try {
      const res = await axios.post(`${BASE_URL}/accounts/register/`, data);
      return res.data;
    } catch (err) {
      throw new Error(
        err.response?.data?.detail ||
          JSON.stringify(err.response?.data) ||
          "Registration failed"
      );
    }
  },

  login: async (identifier, password) => {
    try {
      const res = await axios.post(`${BASE_URL}/accounts/login/`, {
        identifier,
        password,
      });
      return res.data;
    } catch (err) {
      throw new Error(err.response?.data?.detail || "Login failed");
    }
  },

  logout: async () => {
    try {
      const res = await axios.post(
        `${BASE_URL}/accounts/logout/`,
        {},
        { headers: getAuthHeaders() }
      );
      return res.data;
    } catch (err) {
      throw new Error(err.response?.data?.detail || "Logout failed");
    }
  },

  forgotPassword: async (email) => {
    try {
      const res = await axios.post(`${BASE_URL}/accounts/password-reset/`, {
        email,
      });
      return res.data;
    } catch (err) {
      throw new Error(
        err.response?.data?.detail || "Failed to send reset email"
      );
    }
  },

  resetPassword: async (uid, token, data) => {
    try {
      const res = await axios.post(
        `${BASE_URL}/accounts/password-reset-confirm/${uid}/${token}/`,
        data
      );
      return res.data;
    } catch (err) {
      throw new Error(
        err.response?.data?.detail || "Failed to reset password"
      );
    }
  },

  updateProfile: async (userData) => {
    try {
      const response = await axios.patch(
        `${BASE_URL}/accounts/profile/`,
        userData,
        { headers: getAuthHeaders() }
      );
      return response.data;
    } catch (err) {
      console.error("Failed to update profile:", err);
      throw err;
    }
  },

  updateDarkMode: async (darkMode) => {
    try {
      const response = await axios.patch(
        `${BASE_URL}/accounts/dark-mode/`,
        { dark_mode: darkMode },
        { headers: getAuthHeaders() }
      );
      return response.data;
    } catch (err) {
      throw new Error(err.response?.data?.detail || "Failed to update dark mode");
    }
  },

  // ✅ NEW METHOD – fetch current user profile
  getProfile: async () => {
    try {
      const res = await axios.get(`${BASE_URL}/accounts/profile/`, {
        headers: getAuthHeaders(),
      });
      return res.data;
    } catch (err) {
      console.error("Failed to fetch profile:", err);
      throw err;
    }
  },
};