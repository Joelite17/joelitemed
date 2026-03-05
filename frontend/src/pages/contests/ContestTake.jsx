import { useState, useEffect, useRef, useCallback } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { ContestAPI } from "../../apis/contests";
import Spinner from "../../components/Spinner";
import SuccessCheck from "../../components/SuccessCheck";

export default function ContestTake() {
  const { participationId } = useParams();
  const navigate = useNavigate();

  const [questions, setQuestions] = useState([]);
  const [current, setCurrent] = useState(0);
  const [mode, setMode] = useState("exam");
  const [selectedOptions, setSelectedOptions] = useState({}); // { questionIdx: { optKey: "T"/"F"/null } }
  const [score, setScore] = useState(0);
  const [totalPossibleScore, setTotalPossibleScore] = useState(0);
  const [showExplanation, setShowExplanation] = useState(false);
  const [loading, setLoading] = useState(true);
  const [timeLeft, setTimeLeft] = useState(null);
  const [endTime, setEndTime] = useState(null);
  const [error, setError] = useState("");

  const [showSuccess, setShowSuccess] = useState(false);
  const [successMessage, setSuccessMessage] = useState("");
  const [pendingCompletion, setPendingCompletion] = useState(false);

  const mounted = useRef(true);
  useEffect(() => {
    mounted.current = true;
    return () => { mounted.current = false; };
  }, []);

  // Loading timeout
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
    fetchParticipation();
  }, [participationId]);

  const fetchParticipation = async () => {
    if (!mounted.current) return;
    setLoading(true);
    try {
      const data = await ContestAPI.getParticipation(participationId);
      if (!mounted.current) return;

      if (data.status === "completed") {
        navigate(`/contest/answers/${participationId}`);
        return;
      }

      // Format questions from snapshot
      const formatted = (data.questions || []).map((q) => ({
        id: q.id,
        question: q.question,
        options: q.options.reduce((acc, opt) => {
          acc[opt.key] = opt.text;
          return acc;
        }, {}),
        explanation: q.explanation || "",
      }));
      setQuestions(formatted);

      // Load saved answers (per‑option)
      const savedAnswers = data.answers || {}; // { questionId: { optKey: "T"/"F"/null } }
      const initialSelected = {};
      formatted.forEach((q, idx) => {
        initialSelected[idx] = savedAnswers[q.id] || {};
      });
      setSelectedOptions(initialSelected);

      // Total possible = sum of options
      const totalPoints = formatted.reduce((sum, q) => sum + Object.keys(q.options).length, 0);
      setTotalPossibleScore(totalPoints);

      if (data.end_time) {
        setEndTime(data.end_time);
        const now = new Date();
        const end = new Date(data.end_time);
        const diff = end - now;
        if (diff > 0) {
          setTimeLeft({
            minutes: Math.floor(diff / 60000),
            seconds: Math.floor((diff % 60000) / 1000),
          });
        } else {
          setTimeLeft({ minutes: 0, seconds: 0 });
          handleTimeExpired();
        }
      }

      setMode("exam");
      setCurrent(0);
      setShowExplanation(false);
    } catch (err) {
      console.error("Error fetching participation:", err);
      setError("Failed to load contest. Please try again.");
    } finally {
      if (mounted.current) setLoading(false);
    }
  };

  // Timer
  useEffect(() => {
    if (!timeLeft || mode !== "exam" || !endTime) return;
    const interval = setInterval(() => {
      const now = new Date();
      const end = new Date(endTime);
      const diff = end - now;
      if (diff <= 0) {
        clearInterval(interval);
        setTimeLeft({ minutes: 0, seconds: 0 });
        handleTimeExpired();
      } else {
        setTimeLeft({
          minutes: Math.floor(diff / 60000),
          seconds: Math.floor((diff % 60000) / 1000),
        });
      }
    }, 1000);
    return () => clearInterval(interval);
  }, [timeLeft, mode, endTime]);

  const handleTimeExpired = () => {
    setSuccessMessage("⏰ Time's up! Submitting your answers...");
    setShowSuccess(true);
    setTimeout(() => handleSubmitContest(true), 1000);
  };

  // Save a single question's answers to backend
  const saveAnswer = useCallback(async (questionIdx) => {
    const q = questions[questionIdx];
    if (!q) return;
    const answerMap = selectedOptions[questionIdx] || {};
    console.log(`Saving answer for question ${q.id}:`, answerMap); // DEBUG
    try {
      await ContestAPI.submitAnswer(participationId, q.id, answerMap);
    } catch (err) {
      console.error("Failed to save answer:", err);
    }
  }, [participationId, selectedOptions, questions]);

  // Debounced auto‑save when user leaves a question
  useEffect(() => {
    if (mode !== "exam" || !questions[current]) return;
    const timeout = setTimeout(() => {
      saveAnswer(current);
    }, 500);
    return () => clearTimeout(timeout);
  }, [selectedOptions, current, mode, questions, saveAnswer]);

  const handleTFChange = (questionIdx, optKey, value) => {
    if (mode !== "exam") return;
    setSelectedOptions((prev) => {
      const currentQ = prev[questionIdx] || {};
      const newVal = currentQ[optKey] === value ? null : value;
      return {
        ...prev,
        [questionIdx]: {
          ...currentQ,
          [optKey]: newVal,
        },
      };
    });
  };

  const handleNext = () => {
    // Save current before moving
    if (mode === "exam") {
      saveAnswer(current);
    }
    if (current < questions.length - 1) {
      setCurrent(current + 1);
      setShowExplanation(false);
    } else {
      if (mode === "exam") {
        handleSubmitContest();
      } else if (mode === "review") {
        setMode("result");
      }
    }
  };

  const handleBack = () => {
    if (current > 0) {
      setCurrent(current - 1);
      setShowExplanation(false);
    }
  };

  const handleSubmitContest = async (isAuto = false) => {
    if (mode !== "exam") return;

    // Save all questions before final submission
    console.log("Submitting contest – saving all answers...");
    for (let i = 0; i < questions.length; i++) {
      await saveAnswer(i);
    }

    try {
      const result = await ContestAPI.submitContest(participationId);
      if (!mounted.current) return;
      setScore(result.score || 0);
      setTotalPossibleScore(result.total_score || totalPossibleScore);
      setMode("result");
      setPendingCompletion(true);
      setSuccessMessage(
        isAuto
          ? "⏰ Time expired! Contest submitted."
          : "✅ Contest submitted successfully!"
      );
      setShowSuccess(true);

      setTimeout(() => {
        navigate("/", { replace: true });
      }, 2000);
    } catch (err) {
      console.error("Error submitting contest:", err);
      setError("Failed to submit contest. Please try again.");
    }
  };

  const handleSuccessClose = () => {
    setShowSuccess(false);
    if (pendingCompletion) {
      setPendingCompletion(false);
    }
  };

  const handleReview = () => {
    setCurrent(0);
    setMode("review");
    setShowExplanation(false);
  };

  const handleBackToContests = () => {
    navigate("/contest");
  };

  const getCheckboxStyle = (questionIdx, optKey, value) => {
    if (mode !== "review") return "";
    const q = questions[questionIdx];
    if (!q) return "";
    const userAnswer = selectedOptions[questionIdx]?.[optKey];
    if (userAnswer === value) return "bg-blue-100 dark:bg-blue-800/40 border-blue-600";
    return "";
  };

  const getNextButtonText = () => {
    if (mode === "exam") {
      return current < questions.length - 1 ? "Next" : "Submit";
    } else if (mode === "review") {
      return current < questions.length - 1 ? "Next" : "Finish Review";
    }
    return "Next";
  };

  if (loading) {
    return <Spinner fullScreen text="Loading contest..." />;
  }

  if (error) {
    return (
      <div className="flex justify-center items-center min-h-screen bg-gray-100 dark:bg-gray-900 p-4">
        <div className="bg-white dark:bg-gray-800 p-8 rounded-lg shadow text-center max-w-md">
          <p className="text-red-600 dark:text-red-400 mb-4">{error}</p>
          <button
            onClick={() => navigate("/contest")}
            className="px-4 py-2 bg-green-600 text-white rounded hover:bg-green-700"
          >
            Back to Contests
          </button>
        </div>
      </div>
    );
  }

  if (!questions || questions.length === 0) {
    return (
      <div className="flex justify-center items-center min-h-screen bg-gray-100 dark:bg-gray-900 p-4">
        <div className="bg-white dark:bg-gray-800 p-8 rounded-lg shadow text-center">
          <p className="mb-4">No questions available for this contest.</p>
          <button
            onClick={() => navigate("/contest")}
            className="px-4 py-2 bg-green-600 text-white rounded hover:bg-green-700"
          >
            Back to Contests
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

      <div className="flex flex-col items-center w-full min-h-screen bg-gray-100 dark:bg-gray-900 text-gray-900 dark:text-gray-100 p-4">
        {mode !== "result" && (
          <div className="w-full lg:w-4/6 flex justify-between items-center mb-4">
            <p className="text-sm text-gray-500 dark:text-gray-400">
              Question {current + 1} of {questions.length}
            </p>
            {mode === "exam" && timeLeft && (
              <div
                className={`text-center text-lg font-mono px-4 py-2 rounded ${
                  timeLeft.minutes === 0 && timeLeft.seconds <= 30
                    ? "bg-red-100 dark:bg-red-900 text-red-800 dark:text-red-200 animate-pulse"
                    : "bg-gray-100 dark:bg-gray-700"
                }`}
              >
                {String(timeLeft.minutes).padStart(2, "0")}:
                {String(timeLeft.seconds).padStart(2, "0")}
              </div>
            )}
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
                  Review Answers
                </button>
                <button
                  onClick={handleBackToContests}
                  className="px-6 py-3 bg-green-500 text-white rounded-md hover:bg-green-600"
                >
                  Back to Contests
                </button>
              </div>
            </div>
          ) : (
            <>
              <p className="text-base font-medium mb-4">{q.question}</p>
              {Object.entries(q.options).map(([optKey, optText]) => (
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
                          mode === "review" ? getCheckboxStyle(current, optKey, val) : ""
                        } ${mode === "exam" ? "cursor-pointer" : ""}`}
                      >
                        <input
                          type="checkbox"
                          disabled={mode !== "exam"}
                          checked={selected[optKey] === val}
                          onChange={() => handleTFChange(current, optKey, val)}
                          className="w-4 h-4 accent-blue-600"
                        />
                        <span className="text-sm">{val === "T" ? "True" : "False"}</span>
                      </label>
                    ))}
                  </div>
                </div>
              ))}
              {mode === "review" && q.explanation && (
                <div className="mt-4">
                  <button
                    onClick={() => setShowExplanation((prev) => !prev)}
                    className="px-4 py-2 bg-gray-200 dark:bg-gray-700 text-gray-900 dark:text-gray-100 rounded-md hover:bg-gray-300 dark:hover:bg-gray-600"
                  >
                    {showExplanation ? "Hide Explanation" : "Show Explanation"}
                  </button>
                  {showExplanation && (
                    <div className="mt-2 p-3 bg-gray-100 dark:bg-gray-800 rounded border border-gray-300 dark:border-gray-700 text-sm">
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
                <button
                  onClick={handleNext}
                  className="px-4 py-2 bg-green-500 text-white rounded hover:bg-green-600"
                >
                  {getNextButtonText()}
                </button>
              </div>
            </>
          )}
        </div>
      </div>
    </>
  );
}