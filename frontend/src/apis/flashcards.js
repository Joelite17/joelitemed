import axios from "axios";
import { getUserToken } from "../context/AccountsContext";
import { BASE_URL } from "./base_url";

const getAuthHeaders = () => {
  const token = getUserToken();
  return token ? { Authorization: `Bearer ${token}` } : {};
};

export const FlashcardsAPI = {
  /**
   * Fetch paginated list of flashcard sets.
   * @param {number} page - Page number.
   * @param {number} pageSize - Items per page.
   * @returns {Promise<Object>} Normalized pagination object.
   */
  fetchFlashcardSets: async (page = 1, pageSize = 10) => {
    try {
      const res = await axios.get(`${BASE_URL}/flashcardsets/`, {
        headers: getAuthHeaders(),
        params: {
          page: page,
          page_size: pageSize
        }
      });

      // Handle both paginated and non-paginated responses
      let results, count;

      if (res.data.results !== undefined) {
        results = res.data.results;
        count = res.data.count;
      } else if (Array.isArray(res.data)) {
        results = res.data;
        count = res.data.length;
      } else {
        console.warn("Unexpected Flashcard API response structure:", res.data);
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
      // Handle 404 specifically – no data for this page
      if (err.response && err.response.status === 404) {
        console.log(`Flashcard page ${page} not found (no more data)`);
        return {
          results: [],
          count: 0,
          next: null,
          previous: null,
          currentPage: page,
          totalPages: Math.max(1, page - 1)
        };
      }

      console.error("Failed to fetch flashcard sets:", err);
      // Re‑throw other errors (e.g., 403) so the caller can handle them
      throw err;
    }
  },

  /**
   * Fetch a single flashcard set by ID.
   * @param {string|number} id - ID of the flashcard set.
   * @returns {Promise<Object>} The flashcard set data.
   */
  fetchFlashcardSet: async (id) => {
    try {
      const res = await axios.get(`${BASE_URL}/flashcardsets/${id}/`, {
        headers: getAuthHeaders(),
      });
      return res.data;
    } catch (err) {
      console.error(`Failed to fetch flashcard set ${id}:`, err);
      // Throw the error so the component can catch 403, 404, etc.
      throw err;
    }
  },

  /**
   * Toggle like status for a flashcard set.
   * @param {string|number} id - ID of the flashcard set.
   * @returns {Promise<Object>} Response with liked status and new like count.
   */
  toggleLike: async (id) => {
    try {
      const res = await axios.post(
        `${BASE_URL}/flashcardsets/${id}/toggle_like/`,
        {},
        { headers: getAuthHeaders() }
      );
      return res.data;
    } catch (err) {
      console.error(`Failed to toggle like for Flashcard Set ${id}:`, err);
      throw err;
    }
  },

  /**
   * Increment attempt count (called when user completes a batch).
   * @param {string|number} id - ID of the flashcard set.
   * @returns {Promise<Object>} Response with updated progress.
   */
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

  /**
   * Get progress for a specific flashcard set.
   * @param {string|number} id - ID of the flashcard set.
   * @returns {Promise<Object>} Progress object.
   */
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

  /**
   * Reset attempt count for a flashcard set.
   * @param {string|number} id - ID of the flashcard set.
   * @returns {Promise<Object>} Response confirming reset.
   */
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