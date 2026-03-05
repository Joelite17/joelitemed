import axios from "axios";
import { getUserToken } from "../context/AccountsContext";
import { BASE_URL } from "./base_url";

const getAuthHeaders = () => {
  const token = getUserToken();
  return token ? { Authorization: `Bearer ${token}` } : {};
};

export const NotesAPI = {
  fetchNotes: async (page = 1, pageSize = 10) => {
    try {
      const res = await axios.get(`${BASE_URL}/notes/`, {
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
        console.warn("Unexpected Notes API response structure:", res.data);
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
        console.log(`Notes page ${page} not found (no more data)`);
        return {
          results: [],
          count: 0,
          next: null,
          previous: null,
          currentPage: page,
          totalPages: Math.max(1, page - 1) // Adjust total pages
        };
      }
      
      console.error("Failed to fetch notes:", err);
      return {
        results: [],
        count: 0,
        currentPage: 1,
        totalPages: 1
      };
    }
  },

  // ✅ ADD THIS: Get a single note by ID
  getNote: async (id) => {
    try {
      const res = await axios.get(`${BASE_URL}/notes/${id}/`, {
        headers: getAuthHeaders(),
      });
      return res.data;
    } catch (err) {
      console.error("Failed to fetch note:", err);
      throw err;
    }
  },

  // ✅ ADD THIS: Toggle like for a note
  toggleLike: async (noteId) => {
    try {
      const res = await axios.post(
        `${BASE_URL}/notes/${noteId}/toggle_like/`,
        {},
        { headers: getAuthHeaders() }
      );
      return res.data;
    } catch (err) {
      console.error("Failed to toggle note like:", err);
      throw err;
    }
  },
  
};