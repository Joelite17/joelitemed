import { useState, useEffect } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { ContestAPI } from "../../apis/contests";
import Spinner from "../../components/Spinner";

export default function ContestAnswers() {
  const { participationId } = useParams();
  const navigate = useNavigate();

  const [questions, setQuestions] = useState([]);
  const [current, setCurrent] = useState(0);
  const [showExplanation, setShowExplanation] = useState(false);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    if (!participationId) {
      setError("Invalid participation ID");
      setLoading(false);
      return;
    }

    const fetchAnswers = async () => {
      try {
        const data = await ContestAPI.getAnswers(participationId);
        if (data.missing_questions) {
          setError(data.detail || "The questions for this contest are no longer available.");
          setQuestions([]);
        } else {
          // Transform each question: convert options array to object { key: text }
          const transformed = data.map((q) => ({
            ...q,
            optionsMap: Array.isArray(q.options)
              ? q.options.reduce((acc, opt) => {
                  acc[opt.key] = opt.text;
                  return acc;
                }, {})
              : q.options,
          }));
          setQuestions(transformed);
        }
      } catch (err) {
        console.error("Error fetching answers:", err);
        setError(
          err.response?.data?.error ||
          err.message ||
          "Failed to load answers. Please try again."
        );
      } finally {
        setLoading(false);
      }
    };

    fetchAnswers();
  }, [participationId]);

  const handlePrevious = () => {
    if (current > 0) {
      setCurrent(current - 1);
      setShowExplanation(false);
    }
  };

  const handleNext = () => {
    if (current < questions.length - 1) {
      setCurrent(current + 1);
      setShowExplanation(false);
    }
  };

  // Styling for MC (radio) questions
  const getOptionStyle = (q, optKey) => {
    const isCorrect = q.correct_answers?.[optKey] === "T";
    const userSelected = q.user_answers?.[optKey] === "T";
    if (isCorrect) return "bg-green-100 dark:bg-green-800/40 border-green-600 ring-2 ring-green-500";
    if (userSelected && !isCorrect) return "bg-red-100 dark:bg-red-800/40 border-red-600 ring-2 ring-red-500";
    return "";
  };

  // Styling for TF (checkbox) questions
  const getCheckboxStyle = (q, optKey, value) => {
    const isCorrect = q.correct_answers?.[optKey] === value;
    const userChoice = q.user_answers?.[optKey];
    if (isCorrect) return "bg-green-100 dark:bg-green-800/40 border-green-600";
    if (userChoice === value && !isCorrect) return "bg-red-100 dark:bg-red-800/40 border-red-600";
    return "";
  };

  if (loading) {
    return <Spinner fullScreen text="Loading your answers..." />;
  }

  if (error) {
    return (
      <div className="flex justify-center items-center min-h-screen bg-gray-100 dark:bg-gray-900 p-4">
        <div className="bg-white dark:bg-gray-800 rounded-lg shadow-lg p-8 max-w-md text-center">
          <div className="text-yellow-500 text-5xl mb-4">⚠️</div>
          <p className="text-gray-600 dark:text-gray-300">{error}</p>
          <button
            onClick={() => navigate(-1)}
            className="mt-4 px-6 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700"
          >
            Go Back
          </button>
        </div>
      </div>
    );
  }

  if (!questions || questions.length === 0) {
    return (
      <div className="flex justify-center items-center min-h-screen bg-gray-100 dark:bg-gray-900 p-4">
        <div className="bg-white dark:bg-gray-800 rounded-lg shadow-lg p-8 max-w-md text-center">
          <p className="text-gray-600 dark:text-gray-300">No answers available for this contest.</p>
          <button
            onClick={() => navigate(-1)}
            className="mt-4 px-6 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700"
          >
            Go Back
          </button>
        </div>
      </div>
    );
  }

  const q = questions[current];
  if (!q) {
    setCurrent(0);
    return null;
  }

  return (
    <div className="flex flex-col items-center w-full min-h-screen bg-gray-100 dark:bg-gray-900 text-gray-900 dark:text-gray-100 p-4">
      <div className="w-full lg:w-4/6 space-y-6">
        <div className="flex justify-between items-center">
          <p className="text-sm text-gray-500 dark:text-gray-400">
            Question {current + 1} of {questions.length}
          </p>
          <button
            onClick={() => navigate("/contest")}
            className="px-3 py-1 bg-gray-200 dark:bg-gray-700 rounded text-sm hover:bg-gray-300 dark:hover:bg-gray-600"
          >
            ← Back to Contests
          </button>
        </div>

        <div className="bg-white dark:bg-gray-800 shadow-lg rounded-lg p-6 space-y-6">
          <p className="text-base font-medium">{q.question}</p>

          {q.mcq_type === "TF" ? (
            // True/False: per‑option checkboxes
            <div className="space-y-4">
              {Object.entries(q.optionsMap).map(([optKey, optText]) => (
                <div key={optKey}>
                  <div className="p-2 bg-gray-100 dark:bg-gray-700 rounded">
                    <span className="text-sm font-medium">
                      {optKey}. {optText}
                    </span>
                  </div>
                  <div className="flex gap-4 mt-1 px-2">
                    {["T", "F"].map((val) => (
                      <label
                        key={val}
                        className={`flex items-center gap-2 px-2 py-1 border rounded cursor-default ${getCheckboxStyle(
                          q,
                          optKey,
                          val
                        )}`}
                      >
                        <input
                          type="checkbox"
                          disabled
                          checked={q.user_answers?.[optKey] === val}
                          className="w-4 h-4 accent-blue-600"
                        />
                        <span className="text-sm">{val === "T" ? "True" : "False"}</span>
                      </label>
                    ))}
                  </div>
                </div>
              ))}
            </div>
          ) : (
            // Multiple Choice: radio buttons
            <div className="space-y-3">
              {Object.entries(q.optionsMap).map(([optKey, optText]) => {
                const isSelected = q.user_answers?.[optKey] === "T";
                const reviewStyle = getOptionStyle(q, optKey);
                return (
                  <div
                    key={optKey}
                    className={`p-3 border rounded-lg transition-all ${
                      reviewStyle || "border-gray-200 dark:border-gray-700"
                    }`}
                  >
                    <div className="flex items-center">
                      <input
                        type="radio"
                        name={`q-${current}`}
                        value={optKey}
                        checked={isSelected}
                        disabled
                        className="w-4 h-4 text-blue-600"
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

          {q.explanation && (
            <div className="mt-4">
              <button
                onClick={() => setShowExplanation(!showExplanation)}
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
        </div>

        <div className="flex justify-between">
          <button
            onClick={handlePrevious}
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
            disabled={current === questions.length - 1}
            className={`px-4 py-2 rounded ${
              current === questions.length - 1
                ? "bg-gray-200 dark:bg-gray-700 text-gray-400 dark:text-gray-500 cursor-not-allowed"
                : "bg-green-500 text-white hover:bg-green-600"
            }`}
          >
            Next
          </button>
        </div>
      </div>
    </div>
  );
}