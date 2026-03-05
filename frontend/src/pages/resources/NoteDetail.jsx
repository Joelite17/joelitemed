import { useParams } from "react-router-dom";
import { useEffect, useState, useContext } from "react";
import { NotesAPI } from "../../apis/notes";
import { feedAPI } from "../../apis/feed";
import { AccountsContext } from "../../context/AccountsContext";
import Spinner from "../../components/Spinner";
import SubscriptionBlock from "../../components/SubscriptionBlock";
import { useNavigate } from "react-router-dom";
import { ArrowLeftIcon } from "@heroicons/react/24/outline";

export default function NoteDetailPage() {
  const navigate = useNavigate();
  const { id } = useParams();
  const { user } = useContext(AccountsContext);
  const [note, setNote] = useState(null);
  const [loading, setLoading] = useState(true);
  const [likesCount, setLikesCount] = useState(0);
  const [liked, setLiked] = useState(false);
  const [isOwner, setIsOwner] = useState(false);
  const [showTrialExpired, setShowTrialExpired] = useState(false);

  useEffect(() => {
    const fetchNote = async () => {
      setLoading(true);
      try {
        const data = await NotesAPI.getNote(id);
        setNote(data);
        setLikesCount(data.total_likes || 0);
        setLiked(data.user_liked || false);
        if (user && data.author && user.id === data.author) {
          setIsOwner(true);
        }
      } catch (err) {
        console.error("Failed to fetch note:", err);
        if (err.response?.status === 403) {
          setShowTrialExpired(true);
          setNote(null);
          setLoading(false);
          return;
        }
      } finally {
        setLoading(false);
      }
    };
    fetchNote();
  }, [id, user]);

  const handleLike = async () => {
    if (!user || isOwner) return;
    try {
      const data = await feedAPI.toggleLike('note', id);
      setLiked(data.liked);
      setLikesCount(data.likes_count);
      setNote(prev => prev ? {
        ...prev,
        user_liked: data.liked,
        total_likes: data.likes_count
      } : null);
    } catch (err) {
      console.error("Error toggling like:", err);
    }
  };

  if (loading) {
    return <Spinner fullScreen text="Loading note..." />;
  }

  if (showTrialExpired) {
    return (
      <div className="flex justify-center w-full min-h-screen bg-gray-100 dark:bg-gray-900 text-gray-900 dark:text-gray-100 py-10 px-4">
        <div className="w-full lg:w-4/6">
          <div className="flex items-center justify-between w-full mb-4">
            <button
              onClick={() => navigate(-1)}
              className="flex items-center text-gray-600 dark:text-gray-300 hover:text-gray-900 dark:hover:text-white transition-colors"
            >
              <ArrowLeftIcon className="w-5 h-5 mr-1" />
              Back
            </button>
            <div className="w-20"></div>
            <div className="w-20"></div>
          </div>
          <SubscriptionBlock />
        </div>
      </div>
    );
  }

  if (!note) {
    return <p className="text-center mt-10">Note not found.</p>;
  }

  return (
    <div className="flex justify-center w-full min-h-screen bg-gray-100 dark:bg-gray-900 text-gray-900 dark:text-gray-100 py-10 px-4">
      <div className="w-full lg:w-4/6">
        <div className="flex items-center justify-between w-full mb-4">
          <button
            onClick={() => navigate(-1)}
            className="flex items-center text-gray-600 dark:text-gray-300 hover:text-gray-900 dark:hover:text-white transition-colors"
          >
            <ArrowLeftIcon className="w-5 h-5 mr-1" />
            Back
          </button>
          <div className="w-20"></div>
          {!isOwner && user && (
            <button
              onClick={handleLike}
              className={`flex items-center gap-1 px-3 py-1 rounded-full ${
                liked ? "bg-red-100 text-red-600" : "bg-gray-100 text-gray-600"
              }`}
            >
              <svg className="w-5 h-5" fill={liked ? "currentColor" : "none"} stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4.318 6.318a4.5 4.5 0 000 6.364L12 20.364l7.682-7.682a4.5 4.5 0 00-6.364-6.364L12 7.636l-1.318-1.318a4.5 4.5 0 00-6.364 0z" />
              </svg>
              <span>{likesCount}</span>
            </button>
          )}
          {(!user || isOwner) && <div className="w-20"></div>}
        </div>

        <div className="bg-white dark:bg-gray-800 shadow-md rounded-lg p-6 space-y-4 transition-colors duration-300">
          <h1 className="text-2xl font-bold mb-1">{note.title}</h1>
          <hr />
          <div
            className="prose dark:prose-invert max-w-full rich-text-answer"
            dangerouslySetInnerHTML={{ __html: note.content }}
          />
        </div>
      </div>
    </div>
  );
}