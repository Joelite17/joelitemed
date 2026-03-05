import { useState, useEffect } from "react";
import { OSCEAPI } from "../../apis/osces";
import { feedAPI } from "../../apis/feed";
import FeedItem from "../../components/FeedItem";
import Pagination from "../../components/Pagination";
import Spinner from "../../components/Spinner";

export default function OSCESet() {
  const [posts, setPosts] = useState([]);
  const [loading, setLoading] = useState(true);
  const [currentPage, setCurrentPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [error, setError] = useState(null);
  const [totalCount, setTotalCount] = useState(0);
  const pageSize = 10;

  const loadPosts = async (page = 1) => {
    setLoading(true);
    setError(null);
    
    try {
      const osceData = await OSCEAPI.fetchOSCESets(page, pageSize);

      console.log(`OSCE API Response for page ${page}:`, osceData);

      // Transform OSCE set data to match FeedItem structure
      const transformedSets = (osceData.results || []).map(item => ({
        id: item.id,
        type: "OSCE",
        title: item.title || 'No Title',
        total_likes: item.total_likes || 0,
        user_liked: item.user_liked || false,
        created_at: new Date().toISOString(),
      }));

      console.log(`Transformed ${transformedSets.length} OSCE sets for page ${page}`);

      // If we're on page 2+ and get no results, go back to page 1
      if (page > 1 && transformedSets.length === 0) {
        console.log(`No OSCE sets found on page ${page}, returning to page 1`);
        setCurrentPage(1);
        return;
      }

      setPosts(transformedSets);
      setTotalCount(osceData.count || 0);
      
      // Calculate total pages from count
      const calculatedTotalPages = Math.max(1, Math.ceil((osceData.count || 0) / pageSize));
      setTotalPages(calculatedTotalPages);
      
      console.log(`Total pages calculated: ${calculatedTotalPages} (total count: ${osceData.count})`);
    } catch (err) {
      console.error("Failed to load OSCE sets:", err);
      setError("Failed to load OSCE sets. Please try again.");
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
    return <Spinner fullScreen text="Loading Osce sets..." />;
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
              onLikeChange={handleLikeChange}
            />
          ))
        ) : (
          <div className="text-center py-6">
            <p className="text-gray-500 mb-4">No OSCE sets found.</p>
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