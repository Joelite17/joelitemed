import axios from "axios";
import { getUserToken } from "../context/AccountsContext";
import { BASE_URL } from "./base_url";

const getAuthHeaders = () => {
  const token = getUserToken();
  return token ? { Authorization: `Bearer ${token}` } : {};
};

export const ContestAPI = {
  // Get contests by status (active, scheduled, ended, draft)
  getContests: async (status = 'active') => {
    try {
      const response = await axios.get(`${BASE_URL}/contests/?status=${status}`, {
        headers: getAuthHeaders(),
      });
      if (response.data && Array.isArray(response.data.results)) {
        return response.data.results;
      }
      if (Array.isArray(response.data)) {
        return response.data;
      }
      console.warn("Unexpected contests response format:", response.data);
      return [];
    } catch (err) {
      console.error(`Failed to fetch contests (status=${status}):`, err);
      return [];
    }
  },

  // Get a single contest by ID
  getContest: async (id) => {
    try {
      const response = await axios.get(`${BASE_URL}/contests/${id}/`, {
        headers: getAuthHeaders(),
      });
      return response.data;
    } catch (err) {
      console.error(`Failed to fetch contest ${id}:`, err);
      throw err;
    }
  },

  // Join a contest
  joinContest: async (contestId) => {
    try {
      const response = await axios.post(
        `${BASE_URL}/contests/${contestId}/join/`,
        {},
        { headers: getAuthHeaders() }
      );
      return response.data;
    } catch (err) {
      console.error(`Failed to join contest ${contestId}:`, err);
      throw err;
    }
  },

  // Get user's contest history (participations)
  getHistory: async () => {
    try {
      const response = await axios.get(`${BASE_URL}/contests/participations/`, {
        headers: getAuthHeaders(),
      });
      if (response.data && Array.isArray(response.data.results)) {
        return response.data.results;
      }
      if (Array.isArray(response.data)) {
        return response.data;
      }
      console.warn("Unexpected participations response format:", response.data);
      return [];
    } catch (err) {
      console.error("Failed to fetch contest history:", err);
      return [];
    }
  },

  // Get a specific participation (for resuming)
  getParticipation: async (participationId) => {
    try {
      const response = await axios.get(`${BASE_URL}/contests/participations/${participationId}/`, {
        headers: getAuthHeaders(),
      });
      return response.data;
    } catch (err) {
      console.error(`Failed to fetch participation ${participationId}:`, err);
      throw err;
    }
  },

  // Submit per‑option answers for a question
  submitAnswer: async (participationId, questionId, answerMap) => {
    try {
      const response = await axios.post(
        `${BASE_URL}/contests/participations/${participationId}/submit_answer/`,
        { question_id: questionId, answers: answerMap },
        { headers: getAuthHeaders() }
      );
      return response.data;
    } catch (err) {
      console.error(`Failed to submit answer for participation ${participationId}:`, err);
      throw err;
    }
  },

  // Finalize contest submission
  submitContest: async (participationId) => {
    try {
      const response = await axios.post(
        `${BASE_URL}/contests/participations/${participationId}/submit/`,
        {},
        { headers: getAuthHeaders() }
      );
      return response.data;
    } catch (err) {
      console.error(`Failed to submit contest ${participationId}:`, err);
      throw err;
    }
  },

  // Get answers for a completed contest
  getAnswers: async (participationId) => {
    try {
      const response = await axios.get(
        `${BASE_URL}/contests/participations/${participationId}/answers/`,
        { headers: getAuthHeaders() }
      );
      return response.data;
    } catch (err) {
      console.error(`Failed to fetch answers for participation ${participationId}:`, err);
      throw err;
    }
  },
};