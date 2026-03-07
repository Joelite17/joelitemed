import { useState, useEffect, useContext } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { FlashcardsAPI } from "../../apis/flashcards";
import { AccountsContext } from "../../context/AccountsContext";
import Spinner from "../../components/Spinner";
import SuccessCheck from "../../components/SuccessCheck";
import SubscriptionBlock from "../../components/SubscriptionBlock";
import { ArrowLeftIcon } from "@heroicons/react/24/outline";

export default function FlashcardDetailPage() {
  const { id } = useParams();
  const navigate = useNavigate();
  const { user } = useContext(AccountsContext);

  const [flashcards, setFlashcards] = useState([]);
  const [current, setCurrent] = useState(0);
  const [flipped, setFlipped] = useState(false);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [progress, setProgress] = useState(null);
  
  // New states for completion flow
  const [showSuccess, setShowSuccess] = useState(false);
  const [successMessage, setSuccessMessage] = useState("");
  const [isCompleted, setIsCompleted] = useState(false);
  const [pendingCompletion, setPendingCompletion] = useState(false);

  // Trial expired state
  const [showTrialExpired, setShowTrialExpired] = useState(false);

  useEffect(() => {
    fetchSet();
  }, [id]);

  const fetchSet = async () => {
    setLoading(true);
    setError(null);
    
    try {
      const data = await FlashcardsAPI.fetchFlashcardSet(id);

      // ✅ Completed set – show congratulations screen
      if (!data.cards || data.cards.length === 0) {
        if (data.progress?.has_completed) {
          setIsCompleted(true);
          setProgress(data.progress);
          setFlashcards([]);
          setLoading(false);
          return;
        }
        setError("This flashcard set is empty.");
        setFlashcards([]);
        setLoading(false);
        return;
      }

      // ✅ NO SHUFFLE – keep backend order
      const formatted = data.cards.map((card) => ({
        id: card.id,
        question: card.question,
        answer: card.answer,
        type: card.type || "plain",
      }));
      
      setFlashcards(formatted);
      setCurrent(0);
      setFlipped(false);
      setIsCompleted(false);
      setPendingCompletion(false);

      // Progress (used only for completion detection)
      if (data.progress) {
        setProgress(data.progress);
        setIsCompleted(data.progress.has_completed || false);
      } else {
        try {
          const progressData = await FlashcardsAPI.getProgress(id);
          setProgress(progressData.progress);
          setIsCompleted(progressData.progress.has_completed || false);
        } catch (err) {
          console.warn("Could not fetch progress:", err);
          setProgress({
            attempt_count: 0,
            current_batch: 1,
            total_batches: 1,
            progress_percentage: 0,
            has_completed: false
          });
        }
      }
      
    } catch (err) {
      console.error("Error fetching flashcard set:", err);
      // 👇 Trial expired check
      if (err.response?.status === 403 && err.response?.data?.code === 'free_trial_expired') {
        setShowTrialExpired(true);
        setFlashcards([]);
        setLoading(false);
        return;
      }
      if (err.response?.status === 401) {
        setError("Please login to access this content.");
      } else if (err.response?.status === 403) {
        setError("You need an active subscription to access this content.");
      } else {
        setError("Failed to load flashcards. Please try again.");
      }
      setFlashcards([]);
    } finally {
      if (!showTrialExpired) setLoading(false);
    }
  };

  const nextCard = () => {
    setFlipped(false);
    
    if (current < flashcards.length - 1) {
      setCurrent(current + 1);
    } else {
      // End of batch
      handleBatchComplete();
    }
  };

  const prevCard = () => {
    setFlipped(false);
    if (current > 0) {
      setCurrent(current - 1);
    }
    // If current === 0, button is disabled – no action
  };

  const handleBatchComplete = async () => {
    if (!user) {
      setSuccessMessage("Login to track your progress!");
      setShowSuccess(true);
      setTimeout(() => setShowSuccess(false), 3000);
      return;
    }
    
    try {
      const result = await FlashcardsAPI.incrementAttempt(id);
      
      if (result.success && result.progress) {
        const updatedProgress = result.progress;

        if (updatedProgress.has_completed) {
          // 🎉 Final batch – show SuccessCheck, then congrats screen
          setPendingCompletion(true);
          setSuccessMessage("🎉 Full set completed! You've seen all flashcards.");
          setShowSuccess(true);
        } else {
          // Normal batch – load next batch
          setSuccessMessage("✅ Batch completed! Loading next batch...");
          setShowSuccess(true);
          
          const data = await FlashcardsAPI.fetchFlashcardSet(id);
          if (data.cards && data.cards.length > 0) {
            const formatted = data.cards.map((card) => ({
              id: card.id,
              question: card.question,
              answer: card.answer,
              type: card.type || "plain",
            }));
            
            // NO SHUFFLE – keep order
            setFlashcards(formatted);
            setCurrent(0);
          }
          setProgress(updatedProgress);
        }
      }
    } catch (err) {
      console.error("Failed to complete batch:", err);
      setSuccessMessage("Failed to save progress. Please try again.");
      setShowSuccess(true);
      setTimeout(() => setShowSuccess(false), 3000);
    }
  };

  const handleSuccessClose = () => {
    setShowSuccess(false);
    if (pendingCompletion) {
      // Move to congratulations screen
      setIsCompleted(true);
      setFlashcards([]);
      setPendingCompletion(false);
    }
  };

  const handleRestart = async () => {
    if (!user) {
      navigate("/login");
      return;
    }

    setLoading(true);
    try {
      await FlashcardsAPI.resetAttempt(id);
      await fetchSet();
      setSuccessMessage("🔄 Set restarted! Starting from batch 1.");
      setShowSuccess(true);
    } catch (err) {
      console.error("Failed to restart:", err);
      setSuccessMessage("Could not restart set. Please try again.");
      setShowSuccess(true);
      setLoading(false);
    }
  };

  // Helper to handle card flip, ignoring clicks on interactive elements
  const handleFlip = (e) => {
    // Ignore clicks on links, buttons, or elements with role="button"
    if (e.target.closest('a, button, [role="button"]')) return;
    setFlipped(!flipped);
  };

  if (loading) {
    return <Spinner fullScreen text="Loading flashcards..." />;
  }

  // Trial expired view – shown instead of the content
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

  // --- COMPLETED STATE (full set finished) ---
  if (isCompleted) {
    return (
      <div className="flex justify-center bg-gray-100 dark:bg-gray-900 text-gray-900 dark:text-gray-100 transition-colors duration-300 min-h-[calc(100vh-64px)] p-4">
        <div className="w-full lg:w-4/6">
          <div className="bg-white dark:bg-gray-800 rounded-2xl shadow-xl p-8 text-center max-w-md mx-auto">
            <div className="w-20 h-20 bg-green-100 dark:bg-green-900 rounded-full flex items-center justify-center mx-auto mb-4">
              <svg className="w-12 h-12 text-green-600 dark:text-green-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-5m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
            </div>
            <h2 className="text-2xl font-bold text-gray-900 dark:text-white mb-2">
              🎉 Congratulations!
            </h2>
            <p className="text-gray-600 dark:text-gray-300 mb-6">
              You have completed all flashcards in this set.
            </p>
            <div className="flex justify-center gap-4">
              <button
                onClick={handleRestart}
                className="px-6 py-2 bg-green-600 hover:bg-green-700 text-white font-medium rounded-lg transition-colors"
              >
                Restart Set
              </button>
              <button
                onClick={() => navigate(-1)}
                className="px-6 py-2 bg-gray-200 dark:bg-gray-700 hover:bg-gray-300 dark:hover:bg-gray-600 text-gray-800 dark:text-gray-200 font-medium rounded-lg transition-colors"
              >
                Go Back
              </button>
            </div>
          </div>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="flex justify-center bg-gray-100 dark:bg-gray-900 text-gray-900 dark:text-gray-100 transition-colors duration-300 min-h-[calc(100vh-64px)] p-4">
        <div className="w-full lg:w-4/6">
          <div className="bg-red-100 dark:bg-red-900/30 border border-red-400 dark:border-red-700 rounded-lg p-6 text-center max-w-md mx-auto">
            <div className="w-12 h-12 bg-red-500 text-white rounded-full flex items-center justify-center mx-auto mb-4">
              <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
            </div>
            <h3 className="text-lg font-semibold text-red-800 dark:text-red-300 mb-2">Error</h3>
            <p className="text-red-700 dark:text-red-400 mb-4">{error}</p>
            <button
              onClick={() => navigate(-1)}
              className="px-4 py-2 bg-gray-300 dark:bg-gray-700 text-gray-800 dark:text-gray-200 rounded-md hover:bg-gray-400 dark:hover:bg-gray-600"
            >
              Go Back
            </button>
          </div>
        </div>
      </div>
    );
  }

  if (flashcards.length === 0) {
    return (
      <div className="flex justify-center bg-gray-100 dark:bg-gray-900 text-gray-900 dark:text-gray-100 transition-colors duration-300 min-h-[calc(100vh-64px)] p-4">
        <div className="w-full lg:w-4/6">
          <div className="bg-white dark:bg-gray-800 rounded-lg p-8 text-center max-w-md mx-auto">
            <div className="w-16 h-16 bg-yellow-100 dark:bg-yellow-900/30 rounded-full flex items-center justify-center mx-auto mb-4">
              <svg className="w-8 h-8 text-yellow-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-2.5L13.732 4c-.77-.833-1.998-.833-2.732 0L4.732 16.5c-.77.833.192 2.5 1.732 2.5z" />
              </svg>
            </div>
            <h3 className="text-xl font-semibold mb-4">No Flashcards Available</h3>
            <p className="text-gray-600 dark:text-gray-400 mb-6">
              There are no flashcards in this set.
            </p>
            <button
              onClick={() => navigate(-1)}
              className="px-4 py-2 bg-gray-300 dark:bg-gray-700 text-gray-800 dark:text-gray-200 rounded-md hover:bg-gray-400 dark:hover:bg-gray-600"
            >
              Go Back
            </button>
          </div>
        </div>
      </div>
    );
  }

  const currentCard = flashcards[current];

  return (
    <>
      {/* Success Check Popup */}
      <SuccessCheck
        show={showSuccess}
        message={successMessage}
        onClose={handleSuccessClose}
      />

      <div className="flex justify-center bg-gray-100 dark:bg-gray-900 text-gray-900 dark:text-gray-100 transition-colors duration-300 min-h-[calc(100vh-64px)] p-4">
        <div className="w-full lg:w-4/6">
          {/* Header row with Back button and centered counter */}
          <div className="grid grid-cols-[1fr_auto_1fr] items-center mb-4">
            <button
              onClick={() => navigate(-1)}
              className="justify-self-start flex items-center text-gray-600 dark:text-gray-300 hover:text-gray-900 dark:hover:text-white transition-colors"
            >
              <ArrowLeftIcon className="w-5 h-5 mr-1" />
              Back
            </button>
            <p className="text-sm text-gray-500 dark:text-gray-400 text-center">
              Card {current + 1} of {flashcards.length}
            </p>
            <div></div> {/* empty third column for centering */}
          </div>

          {/* Flashcard Container - 3D Flip Effect */}
          <div className="w-full max-w-3xl h-80 lg:h-96 mx-auto [perspective:1000px]">
            <div
              className={`relative w-full h-full transition-all duration-700 ${
                flipped ? "[transform:rotateY(180deg)]" : ""
              }`}
              style={{
                transformStyle: "preserve-3d",
                WebkitTransformStyle: "preserve-3d",    // Safari support
                touchAction: "manipulation",            // prevent double-tap zoom interference
              }}
              onClick={handleFlip}
            >
              {/* Front Face */}
              <div
                className="absolute inset-0 bg-white dark:bg-gray-800 rounded-lg shadow-lg p-4 flex flex-col overflow-hidden"
                style={{
                  backfaceVisibility: "hidden",
                  WebkitBackfaceVisibility: "hidden",   // Safari support
                }}
              >
                <div className="flex-1 flex items-center justify-center overflow-y-auto p-2">
                  <p className="text-gray-900 dark:text-gray-100 text-lg whitespace-pre-line text-center">
                    {currentCard.question}
                  </p>
                </div>
              </div>

              {/* Back Face */}
              <div
                className="absolute inset-0 bg-green-100 dark:bg-green-800 rounded-lg shadow-lg p-4 flex flex-col overflow-hidden"
                style={{
                  transform: "rotateY(180deg)",
                  backfaceVisibility: "hidden",
                  WebkitBackfaceVisibility: "hidden",   // Safari support
                }}
              >
                <div
                  className={`flex-1 p-2 overflow-y-auto ${
                    currentCard.type === "plain"
                      ? "flex flex-col items-center justify-center"
                      : "flex flex-col items-start justify-start"
                  }`}
                >
                  {currentCard.type === "list" ? (
                    <div className="text-left">
                      <div 
                        className="prose dark:prose-invert max-w-none text-gray-900 dark:text-gray-100 rich-text-answer"
                        dangerouslySetInnerHTML={{ __html: currentCard.answer }}
                      />
                    </div>
                  ) : (
                    <p
                      className={`text-gray-900 dark:text-gray-100 text-lg ${
                        currentCard.type === "plain"
                          ? "text-center whitespace-pre-line"
                          : "text-left"
                      }`}
                      dangerouslySetInnerHTML={{ __html: currentCard.answer }}
                    />
                  )}
                </div>
              </div>
            </div>
          </div>

          {/* Navigation */}
          <div className="flex justify-between w-full mt-2">
            <button
              onClick={prevCard}
              disabled={current === 0}
              className={`px-4 py-2 rounded-md transition ${
                current === 0
                  ? "bg-gray-200 dark:bg-gray-700 text-gray-400 dark:text-gray-500 cursor-not-allowed"
                  : "bg-gray-300 dark:bg-gray-700 text-gray-700 dark:text-gray-100 hover:bg-gray-400 dark:hover:bg-gray-600"
              }`}
            >
              Back
            </button>
            <button
              onClick={nextCard}
              className="px-4 py-2 bg-green-500 text-white rounded-md hover:bg-green-600"
            >
              {current === flashcards.length - 1 ? "Complete Batch" : "Next"}
            </button>
          </div>
        </div>
      </div>
    </>
  );
}