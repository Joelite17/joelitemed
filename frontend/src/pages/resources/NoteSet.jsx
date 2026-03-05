import { useState, useEffect } from "react";
import { NotesAPI } from "../../apis/notes";
import { feedAPI } from "../../apis/feed";
import FeedItem from "../../components/FeedItem";
import Pagination from "../../components/Pagination";
import Spinner from "../../components/Spinner";

export default function NoteSet() {
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
      const noteData = await NotesAPI.fetchNotes(page, pageSize);

      console.log(`Note API Response for page ${page}:`, noteData);

      // Transform note data to match FeedItem structure
      // Only include public notes
      const transformedNotes = (noteData.results || []).filter(item => 
        item.visibility === 'public' // Only show public notes
      ).map(item => ({
        id: item.id,
        type: "Note",
        title: item.title || 'No Title',
        total_likes: item.total_likes || 0,
        user_liked: item.user_liked || false,
        created_at: item.created_at || new Date().toISOString(),
      }));

      console.log(`Transformed ${transformedNotes.length} notes for page ${page}`);

      // If we're on page 2+ and get no results, go back to page 1
      if (page > 1 && transformedNotes.length === 0) {
        console.log(`No notes found on page ${page}, returning to page 1`);
        setCurrentPage(1);
        return;
      }

      setPosts(transformedNotes);
      setTotalCount(transformedNotes.length);
      
      // Calculate total pages from count
      const calculatedTotalPages = Math.max(1, Math.ceil(transformedNotes.length / pageSize));
      setTotalPages(calculatedTotalPages);
      
      console.log(`Total pages calculated: ${calculatedTotalPages} (total count: ${transformedNotes.length})`);
    } catch (err) {
      console.error("Failed to load notes:", err);
      setError("Failed to load notes. Please try again.");
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
    return <Spinner fullScreen text="Loading Notes..." />;
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
            <p className="text-gray-500 mb-4">No public notes found.</p>
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