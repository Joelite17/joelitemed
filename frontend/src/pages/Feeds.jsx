import { useState, useEffect } from "react";
import { feedAPI } from "../apis/feed";
import FeedItem from "../components/FeedItem";
import Pagination from "../components/Pagination";
import Spinner from "../components/Spinner";
export default function Feeds() {
  const [posts, setPosts] = useState([]);
  const [loading, setLoading] = useState(true);
  const [currentPage, setCurrentPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [error, setError] = useState(null);
  const [apiStatus, setApiStatus] = useState({});
  const pageSize = 10;

  const loadPosts = async (page = 1) => {
    setLoading(true);
    setError(null);
    setApiStatus({});
    
    try {
      // Use the new unified feed API
      const feedData = await feedAPI.getFeed(page, { page_size: pageSize });

      console.log(`Unified Feed API Response for page ${page}:`, feedData);

      // Store API status for debugging
      setApiStatus({
        feed: { count: feedData.count, totalPages: Math.ceil(feedData.count / pageSize) }
      });

      // Transform unified feed data to match your existing structure
      const allPosts = (feedData.results || []).map(item => {
        // Map content_type to your type system
        let type;
        switch(item.content_type) {
          case 'flashcard_set':
            type = "Flashcard";
            break;
          case 'mcq_set':
            type = "MCQ";
            break;
          case 'osce_set':
            type = "OSCE";
            break;
          case 'note':
            type = "Note";
            break;
          default:
            type = "Unknown";
        }

        // Build post object matching your existing structure
        // NOW using item.user_liked from FeedItemSerializer
        const post = {
          id: item.content_id,
          type: type,
          title: item.content_data?.title || 'No Title',
          total_likes: item.likes_count || 0,
          user_liked: item.user_liked || false, // CHANGED: Now using item.user_liked directly
          created_at: item.created_at || new Date().toISOString(),
        };

        // Add note-specific fields
        if (item.content_type === 'note' && item.content_data) {
          post.author_username = item.content_data.author_username;
          post.visibility = item.content_data.visibility;
          post.content = item.content_data.content;
        }

        return post;
      });

      console.log(`Transformed ${allPosts.length} posts for page ${page}`);

      // If we're on page 2+ and get no results, go back to page 1
      if (page > 1 && allPosts.length === 0) {
        console.log(`No posts found on page ${page}, returning to page 1`);
        setCurrentPage(1);
        return;
      }

      // Sort by creation date (newest first)
      allPosts.sort((a, b) => new Date(b.created_at) - new Date(a.created_at));

      setPosts(allPosts);

      // Calculate total pages from unified feed count
      const calculatedTotalPages = Math.max(1, Math.ceil(feedData.count / pageSize));
      setTotalPages(calculatedTotalPages);
      
      console.log(`Total pages calculated: ${calculatedTotalPages} (total count: ${feedData.count})`);
    } catch (err) {
      console.error("Failed to load feed:", err);
      setError("Failed to load posts. Please try again.");
      setPosts([]);
    } finally {
      setLoading(false);
    }
  };

  // Handle like changes in the feed
  const handleLikeChange = (postId, liked, likesCount, postType) => {
    console.log(`Like updated: ${postType} ${postId}, liked: ${liked}, count: ${likesCount}`);
    
    setPosts(prevPosts => 
      prevPosts.map(post => {
        if (post.id === postId && post.type === postType) {
          return {
            ...post,
            total_likes: likesCount,
            user_liked: liked
          };
        }
        return post;
      })
    );
  };

  useEffect(() => {
    loadPosts(currentPage);
  }, [currentPage]);

  const handlePageChange = (page) => {
    if (page < 1 || page > totalPages) return;
    setCurrentPage(page);
    window.scrollTo(0, 0);
  };

  if (loading) {
    return <Spinner fullScreen text="Loading Feeds..." />;
  }

  return (
    
    <div className="flex flex-col items-center w-full text-gray-900 dark:text-gray-100">      
      <div className="w-full lg:w-4/6 space-y-4 py-6 px-4">
        {error && (
          <div className="bg-red-100 border border-red-400 text-red-700 px-4 py-3 rounded mb-4">
            {error}
          </div>
        )}

        {posts.length > 0 ? (
          posts.map((post) => (
            <FeedItem 
              key={`${post.type}-${post.id}`} 
              post={post} 
              onLikeChange={handleLikeChange} // PASS onLikeChange prop
            />
          ))
        ) : (
          <div className="text-center py-6">
            <p className="text-gray-500 mb-4">No posts found.</p>
            {currentPage > 1 && (
              <button
                onClick={() => handlePageChange(1)}
                className="bg-blue-500 hover:bg-blue-700 text-white font-bold py-2 px-4 rounded"
              >
                Go to First Page
              </button>
            )}
          </div>
        )}

        {/* Pagination Component */}
        {totalPages > 1 && (
          <div className="mt-8">
            <Pagination
              currentPage={currentPage}
              totalPages={totalPages}
              onPageChange={handlePageChange}
              className="py-4"
            />
          </div>
        )}
      </div>
    </div>
  );
}