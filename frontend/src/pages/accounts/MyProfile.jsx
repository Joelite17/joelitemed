import { useState, useEffect, useContext } from "react";
import { Link, useSearchParams } from "react-router-dom";
import FeedItem from "../../components/FeedItem";
import ProfileInfo from "../../components/ProfileInfo";
import Pagination from "../../components/Pagination";
import { AccountsContext } from "../../context/AccountsContext";
import { feedAPI } from "../../apis/feed";
import { AccountsAPI } from "../../apis/accounts";
import { MCQAPI } from "../../apis/mcqs";
import Spinner from "../../components/Spinner";
import { PencilIcon } from "@heroicons/react/24/outline";
import ReviewedReports from "./ReviewedReports";

export default function MyProfilePage() {
  const [searchParams, setSearchParams] = useSearchParams();
  const initialPage = parseInt(searchParams.get('page')) || 1;
  const initialTab = searchParams.get('tab') || 'all';

  const [activeTab, setActiveTab] = useState(initialTab);
  const [currentPage, setCurrentPage] = useState(initialPage);
  const [posts, setPosts] = useState([]);
  const [totalPages, setTotalPages] = useState(1);
  const [totalCount, setTotalCount] = useState(0);
  const [error, setError] = useState(null);
  const [feedLoading, setFeedLoading] = useState(false);
  const [updatingCourse, setUpdatingCourse] = useState(false);
  const { user, updateUser } = useContext(AccountsContext);

  const [courseMode, setCourseMode] = useState(user?.course_mode || "");
  const [reviewCount, setReviewCount] = useState(0);
  const [showReviewed, setShowReviewed] = useState(activeTab === 'reviewed');

  const userData = {
    name: `${user?.first_name || ""} ${user?.last_name || ""}`.trim() || user?.username,
    username: `@${user?.username}`,
    avatar: "https://i.pravatar.cc/100?img=3",
  };

  const courseOptions = [
    { value: "", label: "All Courses" },
    { value: "medicine", label: "Medicine" },
    { value: "surgery", label: "Surgery" },
    { value: "commed", label: "Community Medicine" },
  ];

  // Fetch review count
  useEffect(() => {
    if (user) {
      const fetchReviewCount = async () => {
        try {
          const reports = await MCQAPI.getMyReports();
          setReviewCount(reports.length);
        } catch (err) {
          console.error("Failed to fetch review count:", err);
          setReviewCount(0);
        }
      };
      fetchReviewCount();
    }
  }, [user]);

  const handleCourseChange = async (e) => {
    const newMode = e.target.value;
    setCourseMode(newMode);
    setUpdatingCourse(true);
    try {
      const updatedUser = await AccountsAPI.updateProfile({ course_mode: newMode });
      updateUser(updatedUser);
      setCurrentPage(1);
      setSearchParams({ page: 1, tab: activeTab });
    } catch (err) {
      console.error("Failed to update course mode:", err);
      setCourseMode(user?.course_mode || "");
    } finally {
      setUpdatingCourse(false);
    }
  };

  const getContentTypeFromTab = (tab) => {
    const tabMap = {
      "all": null,
      "mcq": "mcq_set",
      "flashcard": "flashcard_set",
      "osce": "osce_set",
      "note": "note"
    };
    return tabMap[tab.toLowerCase()] || null;
  };

  const handleTabChange = (tab) => {
    const isReviewed = tab === 'reviewed';
    setShowReviewed(isReviewed);
    setActiveTab(tab);
    setCurrentPage(1);
    setSearchParams({ page: 1, tab: tab });
  };

  // Sync with URL changes (browser back/forward)
  useEffect(() => {
    const page = parseInt(searchParams.get('page')) || 1;
    const tab = searchParams.get('tab') || 'all';
    if (page !== currentPage) setCurrentPage(page);
    if (tab !== activeTab) {
      setActiveTab(tab);
      setShowReviewed(tab === 'reviewed');
    }
  }, [searchParams]);

  // Fetch posts when tab/page changes
  useEffect(() => {
    if (showReviewed) return;
    const fetchLikedPosts = async () => {
      if (!user) return;
      setFeedLoading(true);
      setError(null);
      try {
        const contentType = getContentTypeFromTab(activeTab);
        const feedData = await feedAPI.userLikedPosts(currentPage, contentType);
        const transformed = feedData.results.map(item => {
          let type;
          switch (item.content_type) {
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
        setPosts(transformed);
        setTotalCount(feedData.count);
        setTotalPages(feedData.totalPages);
      } catch (err) {
        console.error("Failed to load user liked posts:", err);
        setError("Failed to load your liked posts. Please try again.");
        setPosts([]);
        setTotalCount(0);
        setTotalPages(1);
      } finally {
        setFeedLoading(false);
      }
    };
    if (!showReviewed) fetchLikedPosts();
  }, [user, activeTab, currentPage, user?.course_mode, showReviewed]);

  const handleLikeChange = (id, liked, likes_count, type) => {
    if (!liked) {
      setPosts(prev => prev.filter(p => !(p.id === id && p.type === type)));
      setTotalCount(prev => Math.max(0, prev - 1));
    } else {
      setPosts(prev => prev.map(p =>
        p.id === id && p.type === type
          ? { ...p, user_liked: liked, total_likes: likes_count }
          : p
      ));
    }
  };

  const handlePageChange = (page) => {
    if (page < 1 || page > totalPages) return;
    setCurrentPage(page);
    setSearchParams({ page: page, tab: activeTab });
    window.scrollTo(0, 0);
  };

  const getLoadingText = () => {
    if (activeTab === "all") return "Loading your liked posts...";
    else return `Loading your liked ${activeTab} posts...`;
  };

  const tabs = [
    { id: 'reviewed', label: 'Reviewed', badge: reviewCount > 0 ? reviewCount : null },
    { id: 'all', label: 'All' },
    { id: 'flashcard', label: 'Flashcards' },
    { id: 'mcq', label: 'MCQs' },
    { id: 'osce', label: 'OSCE' },
    { id: 'note', label: 'Notes' },
  ];

  return (
    <div className="flex flex-col items-center w-full min-h-screen text-gray-900 dark:text-gray-100">
      <div className="w-full lg:w-4/6 space-y-4 py-8 px-4">
        <div className="relative">
          <ProfileInfo user={userData} />
          <div className="mt-4 flex items-center gap-4 bg-white dark:bg-gray-800 p-4 rounded-lg shadow-sm border border-gray-200 dark:border-gray-700">
            <label htmlFor="courseMode" className="text-sm font-medium text-gray-700 dark:text-gray-300">
              Course Mode:
            </label>
            <select
              id="courseMode"
              value={courseMode}
              onChange={handleCourseChange}
              disabled={updatingCourse}
              className="block w-64 px-3 py-2 bg-white dark:bg-gray-700 border border-gray-300 dark:border-gray-600 rounded-md shadow-sm focus:outline-none focus:ring-green-500 focus:border-green-500 sm:text-sm text-gray-900 dark:text-white"
            >
              {courseOptions.map(opt => (
                <option key={opt.value} value={opt.value}>{opt.label}</option>
              ))}
            </select>
            {updatingCourse && <Spinner size="small" />}
          </div>
          <Link
            to="/edit-profile"
            className="absolute top-4 right-4 flex items-center gap-2 bg-white dark:bg-gray-800 text-green-600 hover:text-green-700 hover:bg-green-50 dark:hover:bg-green-900/20 px-4 py-2 rounded-lg shadow-sm border border-green-200 dark:border-green-800 transition-all duration-200 z-10"
          >
            <PencilIcon className="w-4 h-4" />
          </Link>
        </div>

        <div className="flex overflow-x-auto pb-2 -mb-2 scrollbar-hide space-x-2 border-b border-gray-200 dark:border-gray-700">
          {tabs.map((tab) => {
            const isActive = (showReviewed && tab.id === 'reviewed') || (!showReviewed && activeTab === tab.id);
            return (
              <button
                key={tab.id}
                onClick={() => handleTabChange(tab.id)}
                className={`px-4 py-2 text-sm font-medium transition-colors whitespace-nowrap flex-shrink-0 relative ${
                  isActive
                    ? 'text-green-600 border-b-2 border-green-600'
                    : 'text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-300'
                }`}
              >
                {tab.label}
                {tab.badge && (
                  <span className="ml-1 inline-flex items-center justify-center px-2 py-0.5 text-xs font-bold leading-none text-white bg-green-600 rounded-full">
                    {tab.badge}
                  </span>
                )}
              </button>
            );
          })}
        </div>

        {error && (
          <div className="bg-red-100 border border-red-400 text-red-700 px-4 py-3 rounded mb-4">
            {error}
          </div>
        )}

        <div className="min-h-[300px] relative">
          {showReviewed ? (
            <ReviewedReports />
          ) : feedLoading ? (
            <div className="min-h-[400px]">
              <Spinner fullContainer text={getLoadingText()} />
            </div>
          ) : posts.length > 0 ? (
            <>
              <div className="space-y-4">
                {posts.map((post) => (
                  <FeedItem
                    key={`${post.type}-${post.id}`}
                    post={post}
                    onLikeChange={handleLikeChange}
                    showProgress={true}
                  />
                ))}
              </div>
              {totalPages > 1 && (
                <div className="mt-8">
                  <Pagination
                    currentPage={currentPage}
                    totalPages={totalPages}
                    onPageChange={handlePageChange}
                  />
                </div>
              )}
            </>
          ) : (
            <div className="text-center py-12">
              <div className="text-gray-400 mb-4">
                <svg className="w-16 h-16 mx-auto" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1} d="M9.172 16.172a4 4 0 015.656 0M9 10h.01M15 10h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                </svg>
              </div>
              <p className="text-gray-600 dark:text-gray-400">
                {activeTab === "all"
                  ? "You haven't liked any posts yet."
                  : `You haven't liked any ${activeTab} posts yet.`}
              </p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}