import axios from "axios";
import { getUserToken } from "../context/AccountsContext";
import { BASE_URL } from "./base_url";

const getAuthHeaders = () => {
  const token = getUserToken();
  return token ? { Authorization: `Bearer ${token}` } : {};
};

export const SubscriptionAPI = {
  // Get all available plans
  getPlans: async () => {
    try {
      console.log("DEBUG: Fetching subscription plans...");
      const response = await axios.get(
        `${BASE_URL}/subscriptions/plans/`,
        { headers: getAuthHeaders() }
      );
      console.log("DEBUG: Plans response:", response.data);
      return response.data.results || response.data;
    } catch (err) {
      console.error("Failed to fetch plans:", err.response?.data || err.message);
      throw err;
    }
  },

  // Get current subscription status
  getMySubscription: async () => {
    try {
      console.log("DEBUG: Fetching user subscription...");
      const response = await axios.get(
        `${BASE_URL}/subscriptions/my-subscription/`,
        { headers: getAuthHeaders() }
      );
      console.log("DEBUG: Subscription response:", response.data);
      return response.data;
    } catch (err) {
      console.error("Failed to fetch subscription:", err.response?.data || err.message);
      throw err;
    }
  },

  // Initialize payment
  initializePayment: async (planId) => {
    try {
      console.log("DEBUG: Initializing payment for plan:", planId);
      const response = await axios.post(
        `${BASE_URL}/subscriptions/initialize-payment/`,
        { plan_id: planId },
        { headers: getAuthHeaders() }
      );
      console.log("DEBUG: Payment initialization response:", response.data);
      return response.data;
    } catch (err) {
      console.error("DEBUG: Failed to initialize payment:", err.response?.data || err.message);
      const error = new Error(err.response?.data?.error || "Failed to initialize payment");
      error.response = err.response;
      throw error;
    }
  },

  // Verify payment
  verifyPayment: async (reference) => {
    try {
      console.log("DEBUG: Verifying payment with reference:", reference);
      const response = await axios.get(
        `${BASE_URL}/subscriptions/verify-payment/${reference}/`,
        { headers: getAuthHeaders() }
      );
      console.log("DEBUG: Payment verification response:", response.data);
      return response.data;
    } catch (err) {
      console.error("DEBUG: Failed to verify payment:", err.response?.data || err.message);
      const error = new Error(err.response?.data?.error || "Payment verification failed");
      error.response = err.response;
      throw error;
    }
  },

  // Get payment history
  getPaymentHistory: async () => {
    try {
      console.log("DEBUG: Fetching payment history...");
      const response = await axios.get(
        `${BASE_URL}/subscriptions/payment-history/`,
        { headers: getAuthHeaders() }
      );
      console.log("DEBUG: Payment history response:", response.data);
      return response.data.results || response.data;
    } catch (err) {
      console.error("Failed to fetch payment history:", err.response?.data || err.message);
      throw err;
    }
  },
};