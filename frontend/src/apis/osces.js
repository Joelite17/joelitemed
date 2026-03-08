import axios from "axios";
import { getUserToken } from "../context/AccountsContext";
import { BASE_URL } from "./base_url";

const getAuthHeaders = () => {
  const token = getUserToken();
  return token ? { Authorization: `Bearer ${token}` } : {};
};

export const OSCEAPI = {
  fetchOSCESets: async (page = 1, pageSize = 10) => {
    try {
      const res = await axios.get(`${BASE_URL}/oscesets/`, {
        headers: getAuthHeaders(),
        params: {
          page: page,
          page_size: pageSize
        }
      });
      
      // Handle both paginated and non-paginated responses
      let results, count;
      
      if (res.data.results !== undefined) {
        // Paginated response from Django REST Framework
        results = res.data.results;
        count = res.data.count;
      } else if (Array.isArray(res.data)) {
        // Non-paginated response (just an array)
        results = res.data;
        count = res.data.length;
      } else {
        // Unexpected response structure
        console.warn("Unexpected OSCE API response structure:", res.data);
        results = [];
        count = 0;
      }
      
      return {
        results: results,
        count: count,
        next: res.data.next || null,
        previous: res.data.previous || null,
        currentPage: page,
        totalPages: Math.ceil(count / pageSize)
      };
    } catch (err) {
      // Handle 404 specifically - it means there's no data for this page
      if (err.response && err.response.status === 404) {
        console.log(`OSCE page ${page} not found (no more data)`);
        return {
          results: [],
          count: 0,
          next: null,
          previous: null,
          currentPage: page,
          totalPages: Math.max(1, page - 1)
        };
      }
      
      console.error("Failed to fetch OSCE sets:", err);
      // Re-throw the error so the caller can handle it (e.g., for 403)
      throw err;
    }
  },

  fetchOSCESet: async (setId) => {
    try {
      const res = await axios.get(`${BASE_URL}/oscesets/${setId}/`, {
        headers: getAuthHeaders(),
      });
      return res.data;
    } catch (err) {
      console.error(`Failed to fetch OSCE set ${setId}:`, err);
      // Re-throw the error so the component can catch and inspect it
      throw err;
    }
  },

  toggleLike: async (setId) => {
    try {
      const res = await axios.post(
        `${BASE_URL}/oscesets/${setId}/toggle_like/`,
        {},
        { headers: getAuthHeaders() }
      );
      return res.data;
    } catch (err) {
      console.error(`Failed to toggle like for OSCE Set ${setId}:`, err);
      throw err;
    }
  },
  
  incrementAttempt: async (setId) => {
    try {
      const res = await axios.post(
        `${BASE_URL}/oscesets/${setId}/increment_attempt/`,
        {},
        { headers: getAuthHeaders() }
      );
      return res.data;
    } catch (err) {
      console.error(`Failed to increment attempt for OSCE Set ${setId}:`, err);
      throw err;
    }
  },
  
  getProgress: async (setId) => {
    try {
      const res = await axios.get(
        `${BASE_URL}/oscesets/${setId}/get_progress/`,
        { headers: getAuthHeaders() }
      );
      return res.data;
    } catch (err) {
      console.error(`Failed to get progress for OSCE Set ${setId}:`, err);
      throw err;
    }
  },
  
  resetAttempt: async (setId) => {
    try {
      const res = await axios.post(
        `${BASE_URL}/oscesets/${setId}/reset_attempt/`,
        {},
        { headers: getAuthHeaders() }
      );
      return res.data;
    } catch (err) {
      console.error(`Failed to reset attempt for OSCE Set ${setId}:`, err);
      throw err;
    }
  },
};