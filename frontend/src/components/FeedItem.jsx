import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { feedAPI } from "../apis/feed";
import { MCQAPI } from "../apis/mcqs";
import { OSCEAPI } from "../apis/osces";
import { FlashcardsAPI } from "../apis/flashcards";

export default function FeedItem({ post, onLikeChange, showProgress = false }) {
  const [likesCount, setLikesCount] = useState(post.total_likes || 0);
  const [liked, setLiked] = useState(post.user_liked || false);
  const [loading, setLoading] = useState(false);
  const [progress, setProgress] = useState(null);
  const [progressLoading, setProgressLoading] = useState(false);
  const navigate = useNavigate();

  // Fetch progress for this set - ONLY if showProgress is true
  useEffect(() => {
    const fetchProgress = async () => {
      if (!showProgress || !post.id || !post.type || post.type === "Note") return;
      
      try {
        setProgressLoading(true);
        let progressData = null;
        
        switch(post.type) {
          case "MCQ":
            try {
              const mcqProgress = await MCQAPI.getProgress(post.id);
              progressData = mcqProgress.progress;
            } catch (err) {
              console.warn("Could not fetch MCQ progress:", err);
            }
            break;
          case "OSCE":
            try {
              const osceProgress = await OSCEAPI.getProgress(post.id);
              progressData = osceProgress.progress;
            } catch (err) {
              console.warn("Could not fetch OSCE progress:", err);
            }
            break;
          case "Flashcard":
            try {
              const flashcardProgress = await FlashcardsAPI.getProgress(post.id);
              progressData = flashcardProgress.progress;
            } catch (err) {
              console.warn("Could not fetch Flashcard progress:", err);
            }
            break;
          default:
            break;
        }
        
        setProgress(progressData);
      } catch (err) {
        console.error("Error fetching progress:", err);
      } finally {
        setProgressLoading(false);
      }
    };
    
    fetchProgress();
  }, [post.id, post.type, showProgress]);

  const handleLike = async (e) => {
    e.preventDefault();
    e.stopPropagation();
    
    try {
      setLoading(true);
      
      // Map post type to feed content_type
      const typeMap = {
        "MCQ": "mcq_set",
        "Flashcard": "flashcard_set",
        "OSCE": "osce_set",
        "Note": "note"
      };
      
      const contentType = typeMap[post.type];
      
      if (!contentType) {
        console.error("Unknown content type:", post.type);
        return;
      }
      
      // Use unified feed API for all likes
      const data = await feedAPI.toggleLike(contentType, post.id);
      
      setLiked(data.liked);
      setLikesCount(data.likes_count);
      
      if (onLikeChange) {
        onLikeChange(post.id, data.liked, data.likes_count, post.type);
      }
        
    } catch (err) {
      console.error("Error toggling like:", err);
      if (err.response?.status === 401) {
        console.error("Unauthorized - redirecting to login");
        navigate('/login');
      }
    } finally {
      setLoading(false);
    }
  };

  const handleCardClick = (e) => {
    // Only navigate if not clicking the like button
    if (!e.target.closest('button')) {
      const link = {
        Note: `/notes/${post.id}`,
        MCQ: `/mcqsets/${post.id}`,
        Flashcard: `/flashcardsets/${post.id}`,
        OSCE: `/oscesets/${post.id}`,
      }[post.type] || "#";
      navigate(link);
    }
  };

  const getProgressText = () => {
    if (!progress || progressLoading) return "";
    
    if (progress.attempt_count === 0) {
      return "Not started";
    }
    
    // Show COMPLETED batches, not current batch
    return `Completed ${progress.completed_batches}/${progress.total_batches} batches`;
  };

  const getProgressPercentage = () => {
    if (!progress || progressLoading) return 0;
    return progress.progress_percentage || 0;
  };

  return (
    <div
      onClick={handleCardClick}
      className="block bg-white dark:bg-gray-800 shadow-sm rounded-lg p-4 border border-green-100 dark:border-green-700 hover:shadow-md hover:bg-gray-50 dark:hover:bg-gray-750 transition-all duration-200 relative cursor-pointer"
    >
      <p className="text-gray-900 dark:text-gray-100 font-medium text-sm leading-snug break-words">
        {post.title}
      </p>

      

      <div className="flex justify-between items-center mt-3">
        <span className="text-xs font-semibold text-green-700 dark:text-green-400 bg-green-100 dark:bg-green-900 px-2 py-0.5 rounded-md">
          {post.type?.toUpperCase()}
        </span>

        <button
          onClick={handleLike}
          disabled={loading}
          className={`flex items-center gap-1 text-xs font-medium px-2 py-1 rounded-md transition-all ${
            liked
              ? "bg-green-100 text-green-700 dark:bg-green-900 dark:text-green-300 hover:bg-green-200 dark:hover:bg-green-800"
              : "bg-gray-100 text-gray-700 dark:bg-gray-700 dark:text-gray-300 hover:bg-gray-200 dark:hover:bg-gray-600"
          }`}
        >
          <svg
            xmlns="http://www.w3.org/2000/svg"
            className={`h-4 w-4 ${liked ? "fill-green-600" : "fill-gray-400"}`}
            viewBox="0 0 24 24"
          >
            <path d="M12 21.35l-1.45-1.32C5.4 15.36 2 12.28 2 8.5 2 6 3.99 4 6.5 4c1.74 0 3.41 1 4.13 2.44h.74C13.09 5 14.76 4 16.5 4 19.01 4 21 6 21 8.5c-10 10.5-10 10.5-10 10.5z"/>
          </svg>
          {likesCount}
        </button>
      </div>

      {/* Progress Bar - Only show if showProgress is true AND post is not Note */}
      {showProgress && post.type !== "Note" && (
        <div className="mt-2">
          {progressLoading ? (
            <div className="flex items-center gap-2">
              <div className="animate-spin h-4 w-4 border-2 border-green-600 border-t-transparent rounded-full"></div>
              <span className="text-xs text-gray-500">Loading progress...</span>
            </div>
          ) : progress ? (
            <>
              <div className="flex justify-between text-xs text-gray-500 dark:text-gray-400 mb-1">
                <span>{getProgressText()}</span>
                {getProgressPercentage() > 0 && (
                  <span>{Math.round(getProgressPercentage())}%</span>
                )}
              </div>
              <div className="w-full bg-gray-200 dark:bg-gray-700 rounded-full h-2">
                <div 
                  className="bg-green-600 h-2 rounded-full transition-all duration-300"
                  style={{ width: `${getProgressPercentage()}%` }}
                ></div>
              </div>
            </>
          ) : (
            <div className="text-xs text-gray-500 dark:text-gray-400">
              No progress data available
            </div>
          )}
        </div>
      )}
    </div>
  );
}