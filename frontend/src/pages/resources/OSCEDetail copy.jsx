import { useState, useEffect, useContext } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { OSCEAPI } from "../../apis/osces";
import { AccountsContext } from "../../context/AccountsContext";
import { EyeIcon, EyeSlashIcon } from "@heroicons/react/24/outline";
import Spinner from "../../components/Spinner";
import SuccessCheck from "../../components/SuccessCheck";
import SubscriptionBlock from "../../components/SubscriptionBlock";
import { ArrowLeftIcon } from "@heroicons/react/24/outline";

export default function OSCEDetailPage() {
  const { id } = useParams();
  const navigate = useNavigate();
  const { user } = useContext(AccountsContext);

  const [cards, setCards] = useState([]);
  const [current, setCurrent] = useState(0);
  const [showAnswer, setShowAnswer] = useState(false);
  const [modalOpen, setModalOpen] = useState(false);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [progress, setProgress] = useState(null);
  const [showSuccess, setShowSuccess] = useState(false);
  const [successMessage, setSuccessMessage] = useState("");
  const [isCompleted, setIsCompleted] = useState(false);
  const [pendingCompletion, setPendingCompletion] = useState(false);

  // Trial expired / limit reached state
  const [showTrialExpired, setShowTrialExpired] = useState(false);
  const [trialExpiredMessage, setTrialExpiredMessage] = useState("");

  useEffect(() => {
    fetchSet();
  }, [id]);

  const fetchSet = async () => {
    setLoading(true);
    setError(null);
    try {
      const data = await OSCEAPI.fetchOSCESet(id);

      if (!data.cards || data.cards.length === 0) {
        if (data.progress?.has_completed) {
          setIsCompleted(true);
          setProgress(data.progress);
          setCards([]);
          setLoading(false);
          return;
        }
        setError("This OSCE set is empty.");
        setCards([]);
        setLoading(false);
        return;
      }

      const formatted = data.cards.map((card) => {
        let answerHtml = "";

        if (card.questions && card.questions.length > 0) {
          answerHtml += card.questions
            .map((q, idx) => {
              const questionText = q.text || q;
              const answerPoints =
                (card.answers && card.answers[idx]) ||
                card.questions[idx]?.answers?.map((a) => a.text || a) ||
                [];

              const pointsHtml = answerPoints
                .map((point) => `<div class="ml-4 rich-text">${point}</div>`)
                .join('');

              return `<div><strong>${idx + 1}. ${questionText}</strong></div>${pointsHtml}`;
            })
            .join('<div class="mt-3"></div>');
        }

        if (card.explanation) {
          answerHtml += `
            <div class="mt-4 pt-2 border-t border-gray-300 dark:border-gray-600">
              <strong>Explanation:</strong>
              <div class="ml-4 mt-1 rich-text">${card.explanation}</div>
            </div>
          `;
        }

        const questionHtml = card.questions
          ?.map((q, idx) => `${idx + 1}. ${q.text || q}`)
          .join("<br/>") || "No question";

        return {
          id: card.id,
          image: card.image,
          question: questionHtml,
          answer: answerHtml || "No answer",
        };
      });

      setCards(formatted);
      setCurrent(0);
      setShowAnswer(false);
      setIsCompleted(false);
      setPendingCompletion(false);

      if (data.progress) {
        setProgress(data.progress);
        setIsCompleted(data.progress.has_completed || false);
      } else {
        const progressData = await OSCEAPI.getProgress(id);
        setProgress(progressData.progress);
        setIsCompleted(progressData.progress.has_completed || false);
      }
    } catch (err) {
      console.error("Error fetching OSCE set:", err);
      
      // Log detailed error information for debugging
      if (err.response) {
        console.log("Error status:", err.response.status);
        console.log("Error data:", err.response.data);
        console.log("Error headers:", err.response.headers);
      } else if (err.request) {
        console.log("No response received:", err.request);
      } else {
        console.log("Error message:", err.message);
      }

      // Handle permission errors (403)
      if (err.response?.status === 403) {
        const errorData = err.response.data || {};
        const errorCode = errorData.code;
        const errorDetail = errorData.detail || errorData.message || "";

        // Check for free trial expired
        if (errorCode === 'free_trial_expired' || errorDetail.includes('free trial')) {
          setTrialExpiredMessage(
            "You've used your 60 minutes of free access today. " +
            "Please wait 24 hours for your trial to reset, or subscribe now for unlimited access."
          );
          setShowTrialExpired(true);
          setCards([]);
          setLoading(false);
          return;
        }

        // Check for OSCE batch limit exceeded
        if (errorCode === 'osce_batch_limit_exceeded' || errorDetail.includes('one OSCE batch')) {
          setTrialExpiredMessage(
            "You have completed one OSCE batch. " +
            "Please subscribe to continue with more OSCE stations."
          );
          setShowTrialExpired(true);
          setCards([]);
          setLoading(false);
          return;
        }

        // If it's a 403 but not our specific codes, still show a generic subscription message
        setTrialExpiredMessage(
          "You've reached a limit for free access. " +
          "Please subscribe to continue."
        );
        setShowTrialExpired(true);
        setCards([]);
        setLoading(false);
        return;
      }

      // For other errors, show generic error message
      setError("Failed to load OSCE set. Please try again.");
    } finally {
      setLoading(false);
    }
  };

  const nextCard = () => {
    if (current < cards.length - 1) {
      setCurrent(current + 1);
      setShowAnswer(false);
    } else {
      handleBatchComplete();
    }
  };

  const prevCard = () => {
    if (current > 0) {
      setCurrent(current - 1);
      setShowAnswer(false);
    }
  };

  const handleBatchComplete = async () => {
    if (!user) {
      setSuccessMessage("Login to track your progress!");
      setShowSuccess(true);
      setTimeout(() => setShowSuccess(false), 3000);
      return;
    }

    try {
      const result = await OSCEAPI.incrementAttempt(id);

      if (result.success && result.progress) {
        const updatedProgress = result.progress;

        if (updatedProgress.has_completed) {
          setPendingCompletion(true);
          setSuccessMessage("🎉 Full set completed! You've seen all OSCE stations.");
          setShowSuccess(true);
        } else {
          setSuccessMessage("✅ Batch completed! Loading next batch...");
          setShowSuccess(true);
          await fetchSet();
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
      setIsCompleted(true);
      setCards([]);
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
      await OSCEAPI.resetAttempt(id);
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

  if (loading) {
    return <Spinner fullScreen text="Loading OSCE stations..." />;
  }

  // Trial expired / batch limit reached view
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
          <SubscriptionBlock message={trialExpiredMessage} />
        </div>
      </div>
    );
  }

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
              You have completed all OSCEs in this set.
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
      <div className="flex justify-center bg-gray-100 dark:bg-gray-900 min-h-[calc(100vh-64px)] p-4 text-gray-900 dark:text-gray-100">
        <div className="w-full max-w-2xl bg-white dark:bg-gray-800 rounded-lg p-8 text-center">
          <h3 className="text-xl font-semibold text-red-600 dark:text-red-400 mb-4">
            {error}
          </h3>
          <button
            onClick={() => navigate(-1)}
            className="px-4 py-2 bg-gray-300 dark:bg-gray-700 rounded-md hover:bg-gray-400 dark:hover:bg-gray-600"
          >
            Go Back
          </button>
        </div>
      </div>
    );
  }

  const currentCard = cards[current];

  return (
    <>
      <SuccessCheck
        show={showSuccess}
        message={successMessage}
        onClose={handleSuccessClose}
      />

      <div className="flex justify-center bg-gray-100 dark:bg-gray-900 min-h-[calc(100vh-64px)] p-4 text-gray-900 dark:text-gray-100">
        <div className="w-full max-w-2xl flex flex-col space-y-4">
          <div className="flex items-center justify-between w-full max-w-2xl mb-4">
            <button
              onClick={() => navigate(-1)}
              className="flex items-center text-gray-600 dark:text-gray-300 hover:text-gray-900 dark:hover:text-white transition-colors"
            >
              <ArrowLeftIcon className="w-5 h-5 mr-1" />
              Back
            </button>
            <p className="text-sm text-gray-500 dark:text-gray-400">
              OSCE {current + 1} of {cards.length}
            </p>
            <div className="w-20"></div>
          </div>

          <div className="bg-white dark:bg-gray-800 rounded-xl shadow-md border border-gray-300 dark:border-gray-600 overflow-hidden">
            <div className="relative flex flex-col h-[400px]">
              <div
                className={`absolute inset-0 flex flex-col transition-all duration-500 ${
                  showAnswer
                    ? "-translate-y-full opacity-0 pointer-events-none"
                    : "translate-y-0 opacity-100 pointer-events-auto"
                }`}
              >
                <div className="flex-shrink-0 h-48 w-48 mx-auto mt-16 mb-8">
                  {currentCard.image ? (
                    <img
                      src={currentCard.image}
                      alt="OSCE Visual"
                      className="h-full w-full object-cover rounded-lg shadow-sm border border-gray-300 dark:border-gray-600 cursor-pointer"
                      onClick={() => setModalOpen(true)}
                    />
                  ) : (
                    <div className="h-full w-full bg-gray-400 dark:bg-gray-600 rounded-lg flex items-center justify-center">
                      <span className="text-sm">No Image</span>
                    </div>
                  )}
                </div>
                <div className="flex-1 overflow-y-auto p-4">
                  <p
                    className="text-left text-base break-words whitespace-normal"
                    dangerouslySetInnerHTML={{ __html: currentCard.question }}
                  />
                </div>
              </div>

              <div
                className={`absolute inset-0 flex flex-col transition-all duration-500 ${
                  showAnswer
                    ? "translate-y-0 opacity-100 pointer-events-auto"
                    : "translate-y-full opacity-0 pointer-events-none"
                }`}
              >
                <div className="flex-1 overflow-y-auto p-4">
                  <div
                    className="text-left text-base break-words whitespace-normal rich-text-answer"
                    dangerouslySetInnerHTML={{ __html: currentCard.answer }}
                  />
                </div>
              </div>
            </div>
          </div>

          <div className="flex justify-between items-center mt-1">
            <button
              onClick={prevCard}
              disabled={current === 0}
              className={`px-4 py-2 rounded-md transition ${
                current === 0
                  ? "bg-gray-200 dark:bg-gray-700 text-gray-400 dark:text-gray-500 cursor-not-allowed"
                  : "bg-gray-300 dark:bg-gray-700 hover:bg-gray-400 dark:hover:bg-gray-600 text-gray-800 dark:text-gray-200"
              }`}
            >
              Back
            </button>

            <button
              onClick={() => setShowAnswer(!showAnswer)}
              className="flex items-center justify-center w-12 h-12 bg-green-500 text-white rounded-full hover:bg-green-600 transition active:scale-95"
              title={showAnswer ? "Hide Answer" : "Show Answer"}
            >
              {showAnswer ? (
                <EyeSlashIcon className="w-6 h-6" />
              ) : (
                <EyeIcon className="w-6 h-6" />
              )}
            </button>

            <button
              onClick={nextCard}
              className="px-4 py-2 bg-green-500 text-white rounded-md hover:bg-green-600"
            >
              {current === cards.length - 1 ? "Complete Batch" : "Next"}
            </button>
          </div>
        </div>
      </div>

      {modalOpen && currentCard.image && (
        <div
          className="fixed inset-0 bg-black bg-opacity-70 flex items-center justify-center z-50"
          onClick={() => setModalOpen(false)}
        >
          <img
            src={currentCard.image}
            alt="OSCE Full Visual"
            className="max-h-[90vh] max-w-[90vw] rounded-lg shadow-lg"
          />
        </div>
      )}
    </>
  );
}