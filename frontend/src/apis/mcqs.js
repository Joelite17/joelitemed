import axios from "axios";
import { getUserToken } from "../context/AccountsContext";
import { BASE_URL } from "./base_url";

const getAuthHeaders = () => {
  const token = getUserToken();
  return token ? { Authorization: `Bearer ${token}` } : {};
};

export const MCQAPI = {
  /**
   * Fetch paginated list of MCQ sets.
   * @param {number} page - Page number.
   * @param {number} pageSize - Items per page.
   * @returns {Promise<Object>} Normalized pagination object.
   */
  fetchMCQSets: async (page = 1, pageSize = 10) => {
    try {
      const res = await axios.get(`${BASE_URL}/mcqsets/`, {
        headers: getAuthHeaders(),
        params: {
          page: page,
          page_size: pageSize
        }
      });

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
        console.warn("Unexpected MCQ API response structure:", res.data);
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
        console.log(`MCQ page ${page} not found (no more data)`);
        return {
          results: [],
          count: 0,
          next: null,
          previous: null,
          currentPage: page,
          totalPages: Math.max(1, page - 1)
        };
      }

      console.error("Failed to fetch MCQ sets:", err);
      // Re‑throw other errors (e.g., 403) so the caller can handle them
      throw err;
    }
  },

  /**
   * Fetch a single MCQ set by ID, including progress.
   * @param {string|number} mcqSetId - ID of the MCQ set.
   * @returns {Promise<Object>} The MCQ set data with progress.
   */
  fetchMCQSet: async (mcqSetId) => {
    try {
      const res = await axios.get(`${BASE_URL}/mcqsets/${mcqSetId}/`, {
        headers: getAuthHeaders(),
      });

      // If progress is missing, fetch it separately
      if (!res.data.progress) {
        console.warn("No progress data in response, fetching progress separately");
        try {
          const progressRes = await axios.get(
            `${BASE_URL}/mcqsets/${mcqSetId}/get_progress/`,
            { headers: getAuthHeaders() }
          );
          res.data.progress = progressRes.data.progress;
        } catch (progressErr) {
          console.error("Failed to fetch progress:", progressErr);
          // If progress fetch fails, set a default fallback (non‑blocking)
          res.data.progress = {
            attempt_count: 0,
            current_batch: 1,
            total_batches: 1,
            progress_percentage: 0,
            has_completed: false,
          };
        }
      }

      return res.data;
    } catch (err) {
      console.error(`Failed to fetch MCQ set ${mcqSetId}:`, err);
      // Throw the error so the component can catch 403, 404, etc.
      throw err;
    }
  },

  /**
   * Toggle like status for an MCQ set.
   * @param {string|number} mcqSetId - ID of the MCQ set.
   * @returns {Promise<Object>} Response with liked status and new like count.
   */
  toggleLike: async (mcqSetId) => {
    try {
      const res = await axios.post(
        `${BASE_URL}/mcqsets/${mcqSetId}/toggle_like/`,
        {},
        { headers: getAuthHeaders() }
      );
      return res.data;
    } catch (err) {
      console.error(`Failed to toggle like for MCQSet ${mcqSetId}:`, err);
      throw err;
    }
  },

  /**
   * Increment attempt count (called when user completes a batch).
   * @param {string|number} mcqSetId - ID of the MCQ set.
   * @returns {Promise<Object>} Response with updated progress.
   */
  incrementAttempt: async (mcqSetId) => {
    try {
      const res = await axios.post(
        `${BASE_URL}/mcqsets/${mcqSetId}/increment_attempt/`,
        {},
        { headers: getAuthHeaders() }
      );
      return res.data;
    } catch (err) {
      console.error(`Failed to increment attempt for MCQSet ${mcqSetId}:`, err);
      throw err;
    }
  },

  /**
   * Get progress for a specific MCQ set.
   * @param {string|number} mcqSetId - ID of the MCQ set.
   * @returns {Promise<Object>} Progress object.
   */
  getProgress: async (mcqSetId) => {
    try {
      const res = await axios.get(
        `${BASE_URL}/mcqsets/${mcqSetId}/get_progress/`,
        { headers: getAuthHeaders() }
      );
      return res.data;
    } catch (err) {
      console.error(`Failed to get progress for MCQSet ${mcqSetId}:`, err);
      // Throw error so component can handle it (e.g., show a message)
      throw err;
    }
  },

  /**
   * Reset attempt count for an MCQ set.
   * @param {string|number} mcqSetId - ID of the MCQ set.
   * @returns {Promise<Object>} Response confirming reset.
   */
  resetAttempt: async (mcqSetId) => {
    try {
      const res = await axios.post(
        `${BASE_URL}/mcqsets/${mcqSetId}/reset_attempt/`,
        {},
        { headers: getAuthHeaders() }
      );
      return res.data;
    } catch (err) {
      console.error(`Failed to reset attempt for MCQSet ${mcqSetId}:`, err);
      throw err;
    }
  },
};

export const ScoreAPI = {
  /**
   * Post a user's score for an MCQ set.
   * @param {string|number} mcqSetId - ID of the MCQ set.
   * @param {number} score - Score achieved.
   * @param {number} total_score - Maximum possible score.
   * @returns {Promise<Object>} The created score record.
   */
  postScore: async (mcqSetId, score, total_score) => {
    try {
      const res = await axios.post(
        `${BASE_URL}/mcqs/scores/`,
        { mcq_set: mcqSetId, score, total_score },
        { headers: getAuthHeaders() }
      );
      return res.data;
    } catch (err) {
      console.error("Failed to post score:", err);
      throw err;
    }
  },

  /**
   * Fetch paginated scores, optionally filtered by course mode.
   * @param {number} page - Page number.
   * @param {number} pageSize - Items per page.
   * @param {string|null} courseMode - Course mode filter.
   * @returns {Promise<Object>} Normalized pagination object.
   */
  fetchAllScores: async (page = 1, pageSize = 10, courseMode = null) => {
    try {
      const params = {
        page: page,
        page_size: pageSize
      };
      if (courseMode) {
        params.course_mode = courseMode;
      }
      const res = await axios.get(`${BASE_URL}/mcqs/scores/`, {
        headers: getAuthHeaders(),
        params
      });

      let results, count;

      if (res.data.results !== undefined) {
        results = res.data.results;
        count = res.data.count;
      } else if (Array.isArray(res.data)) {
        results = res.data;
        count = res.data.length;
      } else {
        console.warn("Unexpected Scores API response structure:", res.data);
        results = [];
        count = 0;
      }

      return {
        results: results,
        count: count,
        currentPage: page,
        totalPages: Math.ceil(count / pageSize)
      };
    } catch (err) {
      if (err.response && err.response.status === 404) {
        console.log(`Scores page ${page} not found (no more data)`);
        return {
          results: [],
          count: 0,
          currentPage: page,
          totalPages: Math.max(1, page - 1)
        };
      }

      console.error("Failed to fetch scores:", err);
      throw err;
    }
  },
};