import axios from "axios";
import { getUserToken } from "../context/AccountsContext";
import { BASE_URL } from "./base_url";

const getAuthHeaders = () => {
  const token = getUserToken();
  return token ? { Authorization: `Bearer ${token}` } : {};
};

export const MCQAPI = {
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
        results = res.data.results;
        count = res.data.count;
      } else if (Array.isArray(res.data)) {
        results = res.data;
        count = res.data.length;
      } else {
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
      return {
        results: [],
        count: 0,
        currentPage: 1,
        totalPages: 1
      };
    }
  },

  fetchMCQSet: async (mcqSetId) => {
    try {
      const res = await axios.get(`${BASE_URL}/mcqsets/${mcqSetId}/`, {
        headers: getAuthHeaders(),
      });
      
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
          res.data.progress = {
            attempt_count: 0,
            current_batch: 1,
            total_batches: 1,
            progress_percentage: 0
          };
        }
      }
      
      return res.data;
    } catch (err) {
      console.error(`Failed to fetch MCQ set ${mcqSetId}:`, err);
      return null;
    }
  },

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
  
  getProgress: async (mcqSetId) => {
    try {
      const res = await axios.get(
        `${BASE_URL}/mcqsets/${mcqSetId}/get_progress/`,
        { headers: getAuthHeaders() }
      );
      return res.data;
    } catch (err) {
      console.error(`Failed to get progress for MCQSet ${mcqSetId}:`, err);
      return {
        progress: {
          attempt_count: 0,
          current_batch: 1,
          total_batches: 1,
          progress_percentage: 0
        }
      };
    }
  },
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

  // Updated to accept courseMode parameter
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
      return {
        results: [],
        count: 0,
        currentPage: 1,
        totalPages: 1
      };
    }
  },
};