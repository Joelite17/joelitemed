import { useState, useEffect, useRef } from "react";
import { MCQAPI, ScoreAPI } from "../../apis/mcqs";
import { useParams, useNavigate } from "react-router-dom";
import Spinner from "../../components/Spinner";
import SuccessCheck from "../../components/SuccessCheck";
import SubscriptionBlock from "../../components/SubscriptionBlock";
import { ArrowLeftIcon } from "@heroicons/react/24/outline";

export default function MCQDetailPage() {
  const { id: mcqSetId } = useParams();
  const navigate = useNavigate();

  const [questions, setQuestions] = useState([]);
  const [current, setCurrent] = useState(0);
  const [mode, setMode] = useState("exam");
  const [selectedOptions, setSelectedOptions] = useState({});
  const [score, setScore] = useState(0);
  const [totalPossibleScore, setTotalPossibleScore] = useState(0);
  const [showExplanation, setShowExplanation] = useState(false);
  const [loading, setLoading] = useState(true);
  const [progress, setProgress] = useState(null);
  const [showCompletedPage, setShowCompletedPage] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const isSubmittingRef = useRef(false);

  // Trial expired state
  const [showTrialExpired, setShowTrialExpired] = useState(false);
  const [trialExpiredMessage, setTrialExpiredMessage] = useState("");

  // SuccessCheck states
  const [showSuccess, setShowSuccess] = useState(false);
  const [successMessage, setSuccessMessage] = useState("");
  const [pendingNextBatch, setPendingNextBatch] = useState(false);
  const [pendingRestart, setPendingRestart] = useState(false);

  const mounted = useRef(true);
  useEffect(() => {
    mounted.current = true;
    return () => { mounted.current = false; };
  }, []);

  useEffect(() => {
    let timer;
    if (loading) {
      timer = setTimeout(() => {
        if (mounted.current) {
          console.warn("Loading timeout – forcing loading false");
          setLoading(false);
        }
      }, 10000);
    }
    return () => clearTimeout(timer);
  }, [loading]);

  useEffect(() => {
    fetchSet();
  }, [mcqSetId]);

  const fetchSet = async () => {
    if (!mounted.current) return;
    setLoading(true);
    try {
      const data = await MCQAPI.fetchMCQSet(mcqSetId);
      if (!mounted.current) return;

      if ((!data || !data.mcqs || data.mcqs.length === 0) && data?.progress?.has_completed) {
        setShowCompletedPage(true);
        setProgress(data.progress);
        setQuestions([]);
        setLoading(false);
        return;
      }

      if (!data || !data.mcqs || data.mcqs.length === 0) {
        setQuestions([]);
        setLoading(false);
        return;
      }

      const formatted = data.mcqs.map((q) => ({
        id: q.id,
        question: q.question,
        mcq_type: q.mcq_type,
        options: q.options.reduce((acc, opt) => {
          acc[opt.key] = opt.text;
          return acc;
        }, {}),
        trueAnswers: q.options.filter((o) => o.is_correct).map((o) => o.key),
        explanation: q.explanation || "",
      }));
      setQuestions(formatted);
      setCurrent(0);
      setSelectedOptions({});
      setMode("exam");
      setShowExplanation(false);
      setShowCompletedPage(false);

      if (data.progress) {
        setProgress(data.progress);
      } else {
        try {
          const progressData = await MCQAPI.getProgress(mcqSetId);
          if (mounted.current) {
            setProgress(progressData.progress);
          }
        } catch (err) {
          console.warn("Could not fetch progress:", err);
          if (mounted.current) {
            setProgress({
              attempt_count: 0,
              current_batch: 1,
              total_batches: 1,
              progress_percentage: 0,
              has_completed: false,
            });
          }
        }
      }
    } catch (err) {
      console.error("Error fetching MCQ set:", err);

      // Log detailed error information for debugging
      if (err.response) {
        console.log("Error status:", err.response.status);
        console.log("Error data:", err.response.data);
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
        }
        // Check for daily batch limit
        else if (errorCode === 'daily_batch_limit' || errorDetail.includes('one batch')) {
          setTrialExpiredMessage(
            "You have already completed one batch of this MCQ set today. " +
            "Please subscribe to continue now, or wait 24 hours."
          );
        }
        // Generic subscription message for other 403 errors
        else {
          setTrialExpiredMessage(
            "You've reached a limit for free access. " +
            "Please subscribe to continue."
          );
        }
        setShowTrialExpired(true);
        setQuestions([]);
        setLoading(false);
        return; // Exit early – no further processing
      }

      // For other errors, just set empty questions
      if (mounted.current) setQuestions([]);
    } finally {
      if (mounted.current && !showTrialExpired) setLoading(false);
    }
  };

  const handleOptionChange = (questionIndex, optKey, value = null) => {
    if (mode !== "exam") return;
    const q = questions[questionIndex];
    if (!q) return;

    if (q.mcq_type === 'TF') {
      setSelectedOptions((prev) => ({
        ...prev,
        [questionIndex]: {
          ...prev[questionIndex],
          [optKey]: prev[questionIndex]?.[optKey] === value ? null : value,
        },
      }));
    } else {
      setSelectedOptions((prev) => ({
        ...prev,
        [questionIndex]: optKey,
      }));
    }
  };

  const handleNext = () => {
    if (current < questions.length - 1) {
      setCurrent(current + 1);
      setShowExplanation(false);
    } else {
      handleSubmit();
    }
  };

  const handleBack = () => {
    if (current > 0) {
      setCurrent(current - 1);
      setShowExplanation(false);
    }
  };

  const handleSubmit = async () => {
    if (isSubmittingRef.current || submitting) return;
    isSubmittingRef.current = true;
    setSubmitting(true);

    let totalScore = 0;
    let totalPossible = 0;

    questions.forEach((q, idx) => {
      if (q.mcq_type === 'TF') {
        const selected = selectedOptions[idx] || {};
        Object.keys(q.options).forEach((key) => {
          const isTrue = q.trueAnswers.includes(key);
          const ans = selected[key];
          totalPossible += 1;
          if ((ans === "T" && isTrue) || (ans === "F" && !isTrue)) totalScore += 1;
          else if (ans && ans !== (isTrue ? "T" : "F")) totalScore -= 0.5;
        });
      } else {
        const selectedKey = selectedOptions[idx];
        totalPossible += 1;
        if (selectedKey && q.trueAnswers.includes(selectedKey)) {
          totalScore += 1;
        }
      }
    });

    if (mode === "exam") {
      setScore(totalScore);
      setTotalPossibleScore(totalPossible);
      setMode("result");
      try {
        await ScoreAPI.postScore(mcqSetId, totalScore, totalPossible);
        const progressData = await MCQAPI.getProgress(mcqSetId);
        if (!mounted.current) return;

        if (progressData && progressData.progress) {
          const updatedProgress = progressData.progress;
          setProgress(updatedProgress);
          if (updatedProgress.has_completed) {
            setSuccessMessage("🎉 Full set completed! You've seen all questions.");
            setShowSuccess(true);
          }
        }
      } catch (err) {
        console.error("Error posting score or fetching progress:", err);
      } finally {
        isSubmittingRef.current = false;
        setSubmitting(false);
      }
    }
  };

  const handleSuccessClose = () => {
    setShowSuccess(false);
    if (pendingNextBatch) {
      fetchSet();
      setPendingNextBatch(false);
    } else if (pendingRestart) {
      fetchSet();
      setPendingRestart(false);
    }
  };

  const handleRetry = () => {
    if (progress?.has_completed) {
      handleRestart();
    } else {
      setPendingNextBatch(true);
      setSuccessMessage("✅ Batch completed! Loading next batch...");
      setShowSuccess(true);
    }
  };

  const handleRestart = async () => {
    setLoading(true);
    try {
      await MCQAPI.resetAttempt(mcqSetId);
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

  const handleReview = () => {
    setCurrent(0);
    setMode("review");
    setShowExplanation(false);
  };

  const getOptionStyle = (q, optKey) => {
    if (mode !== "review") return "";
    const selected = selectedOptions[current];
    const isCorrect = q.trueAnswers.includes(optKey);
    
    if (q.mcq_type === 'TF') {
      return "";
    } else {
      if (isCorrect) return "bg-green-100 dark:bg-green-800/40 border-green-600 ring-2 ring-green-500";
      if (selected === optKey && !isCorrect) return "bg-red-100 dark:bg-red-800/40 border-red-600 ring-2 ring-red-500";
      return "";
    }
  };

  const getCheckboxStyle = (optKey, value, isCorrect) => {
    if (mode !== "review") return "";
    const selected = selectedOptions[current] || {};
    const userAnswer = selected[optKey];
    const correctValue = isCorrect ? "T" : "F";
    
    if (value === correctValue) {
      return "bg-green-100 dark:bg-green-800/40 border-green-600";
    }
    if (userAnswer === value && value !== correctValue) {
      return "bg-red-100 dark:bg-red-800/40 border-red-600";
    }
    return "";
  };

  if (loading) {
    return <Spinner fullScreen text="Loading Questions..." />;
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
          <SubscriptionBlock message={trialExpiredMessage} />
        </div>
      </div>
    );
  }

  if (showCompletedPage) {
    return (
      <div className="flex justify-center bg-gray-100 dark:bg-gray-900 text-gray-900 dark:text-gray-100 transition-colors duration-300 min-h-[calc(100vh-64px)] p-4">
        <div className="w-full lg:w-4/6">
          <div className="bg-white dark:bg-gray-800 rounded-2xl shadow-xl p-8 text-center max-w-md mx-auto">
            <div className="w-20 h-20 bg-green-100 dark:bg-green-900 rounded-full flex items-center justify-center mx-auto mb-4">
              <svg
                className="w-12 h-12 text-green-600 dark:text-green-400"
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M9 12l2 2 4-5m6 2a9 9 0 11-18 0 9 9 0 0118 0z"
                />
              </svg>
            </div>
            <h2 className="text-2xl font-bold text-gray-900 dark:text-white mb-2">
              🎉 Congratulations!
            </h2>
            <p className="text-gray-600 dark:text-gray-300 mb-6">
              You have completed all MCQ questions in this set.
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

  if (questions.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center w-full min-h-[400px] bg-gray-100 dark:bg-gray-900 p-4">
        <div className="text-center">
          <p className="text-gray-600 dark:text-gray-300">No questions available for this set.</p>
          <button
            onClick={() => navigate(-1)}
            className="mt-4 px-4 py-2 bg-green-500 text-white rounded-md hover:bg-green-600"
          >
            Go Back
          </button>
        </div>
      </div>
    );
  }

  const q = questions[current] || {};
  const selected = selectedOptions[current] || {};

  return (
    <>
      <SuccessCheck
        show={showSuccess}
        message={successMessage}
        onClose={handleSuccessClose}
      />

      <div className="flex flex-col items-center w-full min-h-[400px] bg-gray-100 dark:bg-gray-900 text-gray-900 dark:text-gray-100 p-4">
        {mode !== "result" && (
          <div className="flex items-center justify-between w-full lg:w-4/6 mb-4">
            <button
              onClick={() => navigate(-1)}
              className="flex items-center text-gray-600 dark:text-gray-300 hover:text-gray-900 dark:hover:text-white transition-colors"
            >
              <ArrowLeftIcon className="w-5 h-5 mr-1" />
              Back
            </button>
            <p className="text-sm text-gray-500 dark:text-gray-400">
              Question {current + 1} of {questions.length}
            </p>
            <div className="w-20"></div>
          </div>
        )}

        <div className="w-full lg:w-4/6 bg-white dark:bg-gray-800 shadow-lg rounded-lg p-6 space-y-6">
          {mode === "result" ? (
            <div className="text-center space-y-6 py-12">
              <h2 className="text-2xl font-bold">
                Your Score: {score} / {totalPossibleScore}
              </h2>
              <div className="text-6xl animate-bounce">
                {score >= totalPossibleScore / 2 ? "🎉" : "😢"}
              </div>
              <div className="flex justify-center gap-4 mt-6">
                <button
                  onClick={handleReview}
                  className="px-6 py-3 bg-blue-500 text-white rounded-md hover:bg-blue-600"
                >
                  Review
                </button>
                <button
                  onClick={handleRetry}
                  disabled={submitting}
                  className="px-6 py-3 bg-green-500 text-white rounded-md hover:bg-green-600 disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  {progress?.has_completed ? "Restart Set" : "Next Batch"}
                </button>
              </div>
            </div>
          ) : (
            <>
              <p className="text-sm font-semibold mb-4">{q.question}</p>

              {q.mcq_type === 'TF' ? (
                Object.entries(q.options).map(([optKey, optText]) => (
                  <div key={optKey} className="mb-4">
                    <div className="p-2 bg-gray-100 dark:bg-gray-700 rounded">
                      <span className="text-sm font-medium">
                        {optKey}. {optText}
                      </span>
                    </div>

                    <div className="flex gap-4 mt-1 px-2">
                      {["T", "F"].map((val) => (
                        <label
                          key={val}
                          className={`flex items-center gap-2 px-2 py-1 border rounded ${
                            mode === "review"
                              ? getCheckboxStyle(optKey, val, q.trueAnswers.includes(optKey))
                              : ""
                          } ${mode === "exam" ? "cursor-pointer" : ""}`}
                        >
                          <input
                            type="checkbox"
                            disabled={mode !== "exam"}
                            checked={selected[optKey] === val}
                            onChange={() => handleOptionChange(current, optKey, val)}
                            className="w-4 h-4 accent-blue-600"
                          />
                          <span className="text-sm">
                            {val === "T" ? "True" : "False"}
                          </span>
                        </label>
                      ))}
                    </div>
                  </div>
                ))
              ) : (
                <div className="space-y-3">
                  {Object.entries(q.options).map(([optKey, optText]) => {
                    const isSelected = selected === optKey;
                    const isCorrect = q.trueAnswers.includes(optKey);
                    const reviewStyle = getOptionStyle(q, optKey);
                    return (
                      <div
                        key={optKey}
                        className={`p-3 border rounded-lg transition-all ${
                          mode === "exam"
                            ? isSelected
                              ? "border-blue-500 bg-blue-50 dark:bg-blue-900/20"
                              : "border-gray-200 dark:border-gray-700 hover:border-gray-300 dark:hover:border-gray-600 cursor-pointer"
                            : reviewStyle || "border-gray-200 dark:border-gray-700"
                        }`}
                        onClick={() => mode === "exam" && handleOptionChange(current, optKey)}
                      >
                        <div className="flex items-center">
                          <input
                            type="radio"
                            name={`q-${current}`}
                            value={optKey}
                            checked={isSelected}
                            onChange={() => mode === "exam" && handleOptionChange(current, optKey)}
                            disabled={mode !== "exam"}
                            className="w-4 h-4 text-blue-600 focus:ring-blue-500 border-gray-300"
                          />
                          <span className="ml-3 text-sm font-medium">
                            {optKey}. {optText}
                          </span>
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}

              {mode === "review" && q.explanation && (
                <div className="mt-4">
                  <button
                    onClick={() => setShowExplanation((prev) => !prev)}
                    className="px-4 py-2 bg-gray-200 dark:bg-gray-700 text-gray-900 dark:text-gray-100 rounded-md hover:bg-gray-300 dark:hover:bg-gray-600"
                  >
                    {showExplanation ? "Hide Explanation" : "Show Explanation"}
                  </button>
                  {showExplanation && (
                    <div className="mt-2 p-3 bg-gray-100 dark:bg-gray-800 rounded border border-gray-300 dark:border-gray-700 text-sm text-gray-900 dark:text-gray-100">
                      {q.explanation}
                    </div>
                  )}
                </div>
              )}

              <div className="flex justify-between mt-4">
                <button
                  onClick={handleBack}
                  disabled={current === 0}
                  className={`px-4 py-2 rounded ${
                    current === 0
                      ? "bg-gray-200 dark:bg-gray-700 text-gray-400 dark:text-gray-500 cursor-not-allowed"
                      : "bg-gray-300 dark:bg-gray-600 text-gray-900 dark:text-gray-100 hover:bg-gray-400 dark:hover:bg-gray-500"
                  }`}
                >
                  Back
                </button>

                {mode === "exam" ? (
                  <button
                    onClick={handleNext}
                    disabled={submitting}
                    className="px-4 py-2 bg-green-500 text-white rounded hover:bg-green-600 disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    {current < questions.length - 1 ? "Next" : "Submit"}
                  </button>
                ) : mode === "review" ? (
                  current < questions.length - 1 ? (
                    <button
                      onClick={handleNext}
                      className="px-4 py-2 bg-blue-500 text-white rounded hover:bg-blue-600"
                    >
                      Next
                    </button>
                  ) : (
                    <button
                      onClick={() => setMode("result")}
                      className="px-4 py-2 bg-green-500 text-white rounded hover:bg-green-600"
                    >
                      Finish Review
                    </button>
                  )
                ) : null}
              </div>
            </>
          )}
        </div>
      </div>
    </>
  );
}