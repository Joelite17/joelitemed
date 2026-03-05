import axios from "axios";
import { getUserToken } from "../context/AccountsContext";
import { BASE_URL } from "./base_url";

const getAuthHeaders = () => {
  const token = getUserToken();
  return token ? { Authorization: `Bearer ${token}` } : {};
};

export const FlashcardsAPI = {
  fetchFlashcardSets: async (page = 1, pageSize = 10) => {
    try {
      const res = await axios.get(`${BASE_URL}/flashcardsets/`, {
        headers: getAuthHeaders(),
        params: {
          page: page,
          page_size: pageSize
        }
      });
      return {
        results: res.data.results,
        count: res.data.count,
        next: res.data.next,
        previous: res.data.previous,
        currentPage: page,
        totalPages: Math.ceil(res.data.count / pageSize)
      };
    } catch (err) {
      console.error("Failed to fetch flashcard sets:", err);
      return {
        results: [],
        count: 0,
        currentPage: 1,
        totalPages: 1
      };
    }
  },

  fetchFlashcardSet: async (id) => {
    const res = await axios.get(`${BASE_URL}/flashcardsets/${id}/`, {
      headers: getAuthHeaders(),
    });
    return res.data;
  },

  toggleLike: async (id) => {
    const res = await axios.post(
      `${BASE_URL}/flashcardsets/${id}/toggle_like/`,
      {},
      { headers: getAuthHeaders() }
    );
    return res.data;
  },
  
  // New: Increment attempt count
  incrementAttempt: async (id) => {
    try {
      const res = await axios.post(
        `${BASE_URL}/flashcardsets/${id}/increment_attempt/`,
        {},
        { headers: getAuthHeaders() }
      );
      return res.data;
    } catch (err) {
      console.error(`Failed to increment attempt for Flashcard Set ${id}:`, err);
      throw err;
    }
  },
  
  // New: Get progress for a set
  getProgress: async (id) => {
    try {
      const res = await axios.get(
        `${BASE_URL}/flashcardsets/${id}/get_progress/`,
        { headers: getAuthHeaders() }
      );
      return res.data;
    } catch (err) {
      console.error(`Failed to get progress for Flashcard Set ${id}:`, err);
      throw err;
    }
  },
  resetAttempt: async (id) => {
    try {
      const res = await axios.post(
        `${BASE_URL}/flashcardsets/${id}/reset_attempt/`,
        {},
        { headers: getAuthHeaders() }
      );
      return res.data;
    } catch (err) {
      console.error(`Failed to reset attempt for Flashcard Set ${id}:`, err);
      throw err;
    }
  },
};