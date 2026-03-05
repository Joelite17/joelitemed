import axios from "axios";
import { getUserToken } from "../context/AccountsContext";
import { BASE_URL } from "./base_url";

const getAuthHeaders = () => {
  const token = getUserToken();
  return token ? { Authorization: `Bearer ${token}` } : {};
};

export const feedAPI = {
  getFeed: async (page = 1, filters = {}) => {
    try {
      const params = new URLSearchParams({
        page,
        page_size: 100,
        ...filters
      });
      
      const response = await axios.get(`${BASE_URL}/feed/?${params}`, {
        headers: getAuthHeaders(),
      });
      console.log({"Feeders": [response.data.count, response.data.results]})
      
      return {
        results: response.data.results || [],
        count: response.data.count || 0,
        next: response.data.next || null,
        previous: response.data.previous || null,
        currentPage: page,
        totalPages: Math.ceil((response.data.count || 0) / 10)
      };
      
    } catch (err) {
      if (err.response && err.response.status === 404) {
        console.log(`Feed page ${page} not found (no more data)`);
        return {
          results: [],
          count: 0,
          next: null,
          previous: null,
          currentPage: page,
          totalPages: Math.max(1, page - 1)
        };
      }
      
      console.error("Failed to fetch feed:", err);
      return {
        results: [],
        count: 0,
        currentPage: 1,
        totalPages: 1
      };
    }
  },
  
  getFeedByType: async (contentType, page = 1) => {
    try {
      const response = await axios.get(
        `${BASE_URL}/feed/?content_type=${contentType}&page=${page}`,
        {
          headers: getAuthHeaders(),
        }
      );
      
      return {
        results: response.data.results || [],
        count: response.data.count || 0,
        next: response.data.next || null,
        previous: response.data.previous || null,
        currentPage: page,
        totalPages: Math.ceil((response.data.count || 0) / 10)
      };
    } catch (err) {
      console.error(`Failed to fetch feed for ${contentType}:`, err);
      throw err;
    }
  },
  
  getFeedSorted: async (sortBy = 'newest', page = 1) => {
    try {
      let ordering = '-created_at';
      if (sortBy === 'popular') ordering = '-likes_count';
      if (sortBy === 'score') ordering = '-score';
      
      const response = await axios.get(
        `${BASE_URL}/feed/?ordering=${ordering}&page=${page}`,
        {
          headers: getAuthHeaders(),
        }
      );
      
      return {
        results: response.data.results || [],
        count: response.data.count || 0,
        next: response.data.next || null,
        previous: response.data.previous || null,
        currentPage: page,
        totalPages: Math.ceil((response.data.count || 0) / 10)
      };
    } catch (err) {
      console.error(`Failed to fetch sorted feed (${sortBy}):`, err);
      throw err;
    }
  },
  
  toggleLike: async (contentType, contentId) => {
    try {
      const res = await axios.post(
        `${BASE_URL}/feed/toggle-like/`,
        {
          content_type: contentType,
          content_id: contentId
        },
        { headers: getAuthHeaders() }
      );
      return res.data;
    } catch (err) {
      console.error(`Failed to toggle like for ${contentType} ${contentId}:`, err);
      throw err;
    }
  },
  userLikedPosts: async (page = 1, contentType = null) => {
  try {
    const params = new URLSearchParams({
      page,
      page_size: 10,
    });
    
    if (contentType) {
      params.append('content_type', contentType);
    }
    
    const response = await axios.get(
      `${BASE_URL}/feed/user-liked/?${params}`,
      { 
        headers: getAuthHeaders(),
        // Accept 404 as a valid response so we can handle it gracefully
        validateStatus: function (status) {
          return status === 200 || status === 404;
        }
      }
    );
    
    // If 404, return empty data
    if (response.status === 404) {
      console.warn(`Page ${page} not found for user liked posts (${contentType || 'all'})`);
      return {
        results: [],
        count: 0,
        next: null,
        previous: null,
        currentPage: page,
        totalPages: 0
      };
    }
    
    return {
      results: response.data.results || [],
      count: response.data.count || 0,
      next: response.data.next || null,
      previous: response.data.previous || null,
      currentPage: page,
      totalPages: response.data.total_pages || Math.ceil((response.data.count || 0) / 10)
    };
    
  } catch (err) {
    console.error("Failed to fetch user liked posts:", err);
    throw err; // Re-throw to handle in component
  }
}
}