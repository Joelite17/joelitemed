import { useState, useEffect } from "react";
import { useSearchParams } from "react-router-dom";
import { feedAPI } from "../apis/feed";
import FeedItem from "../components/FeedItem";
import Pagination from "../components/Pagination";
import Spinner from "../components/Spinner";

export default function Feeds() {
  const [searchParams, setSearchParams] = useSearchParams();
  const initialPage = parseInt(searchParams.get('page')) || 1;

  const [posts, setPosts] = useState([]);
  const [loading, setLoading] = useState(true);
  const [currentPage, setCurrentPage] = useState(initialPage);
  const [totalPages, setTotalPages] = useState(1);
  const [error, setError] = useState(null);
  const pageSize = 10;

  const loadPosts = async (page = 1) => {
    setLoading(true);
    setError(null);
    try {
      const feedData = await feedAPI.getFeed(page, { page_size: pageSize });
      const allPosts = (feedData.results || []).map(item => {
        let type;
        switch(item.content_type) {
          case 'flashcard_set': type = "Flashcard"; break;
          case 'mcq_set': type = "MCQ"; break;
          case 'osce_set': type = "OSCE"; break;
          case 'note': type = "Note"; break;
          default: type = "Unknown";
        }
        return {
          id: item.content_id,
          type: type,
          title: item.content_data?.title || 'No Title',
          total_likes: item.likes_count || 0,
          user_liked: item.user_liked || false,
          created_at: item.created_at || new Date().toISOString(),
        };
      });
      allPosts.sort((a, b) => new Date(b.created_at) - new Date(a.created_at));
      setPosts(allPosts);
      const calculatedTotalPages = Math.max(1, Math.ceil(feedData.count / pageSize));
      setTotalPages(calculatedTotalPages);
      setSearchParams({ page: page });
    } catch (err) {
      console.error("Failed to load feed:", err);
      setError("Failed to load posts. Please try again.");
      setPosts([]);
    } finally {
      setLoading(false);
    }
  };

  // Sync with URL changes (browser back/forward)
  useEffect(() => {
    const page = parseInt(searchParams.get('page')) || 1;
    if (page !== currentPage) {
      setCurrentPage(page);
    }
  }, [searchParams]);

  // Load posts when currentPage changes
  useEffect(() => {
    loadPosts(currentPage);
  }, [currentPage]);

  const handlePageChange = (page) => {
    if (page < 1 || page > totalPages) return;
    setCurrentPage(page);
    setSearchParams({ page: page });
    window.scrollTo(0, 0);
  };

  const handleLikeChange = (postId, liked, likesCount, postType) => {
    setPosts(prevPosts => 
      prevPosts.map(post => {
        if (post.id === postId && post.type === postType) {
          return { ...post, total_likes: likesCount, user_liked: liked };
        }
        return post;
      })
    );
  };

  if (loading) return <Spinner fullScreen text="Loading Feeds..." />;

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
            <p className="text-gray-500 mb-4">No posts found.</p>
          </div>
        )}

        {totalPages > 1 && (
          <div className="mt-4">
            <Pagination
              currentPage={currentPage}
              totalPages={totalPages}
              onPageChange={handlePageChange}
            />
          </div>
        )}
      </div>
    </div>
  );
}