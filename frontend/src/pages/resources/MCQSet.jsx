import { useState, useEffect } from "react";
import { useSearchParams } from "react-router-dom";
import { MCQAPI } from "../../apis/mcqs";
import FeedItem from "../../components/FeedItem";
import Pagination from "../../components/Pagination";
import Spinner from "../../components/Spinner";

export default function MCQSet() {
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
      const mcqData = await MCQAPI.fetchMCQSets(page, pageSize);
      const transformedSets = (mcqData.results || []).map(item => ({
        id: item.id,
        type: "MCQ",
        title: item.title || 'No Title',
        total_likes: item.total_likes || 0,
        user_liked: item.user_liked || false,
        created_at: new Date().toISOString(),
      }));
      setPosts(transformedSets);
      const calculatedTotalPages = Math.max(1, Math.ceil((mcqData.count || 0) / pageSize));
      setTotalPages(calculatedTotalPages);
      setSearchParams({ page: page });
    } catch (err) {
      console.error("Failed to load MCQ sets:", err);
      setError("Failed to load MCQ sets. Please try again.");
      setPosts([]);
    } finally {
      setLoading(false);
    }
  };

  // Sync with URL
  useEffect(() => {
    const page = parseInt(searchParams.get('page')) || 1;
    if (page !== currentPage) {
      setCurrentPage(page);
    }
  }, [searchParams]);

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

  if (loading) return <Spinner fullScreen text="Loading MCQ sets..." />;

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
            <p className="text-gray-500 mb-4">No MCQ sets found.</p>
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