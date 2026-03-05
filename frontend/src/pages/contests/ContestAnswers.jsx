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
          setQuestions(data);
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

  const getCheckboxStyle = (optKey, val, correctAnswers, userAnswers) => {
    const correctTF = correctAnswers?.[optKey] || "F";
    const userTF = userAnswers?.[optKey];
    if (userTF === val && val === correctTF) {
      return "bg-green-100 dark:bg-green-800/40 border-green-600";
    }
    if (userTF === val && val !== correctTF) {
      return "bg-red-100 dark:bg-red-800/40 border-red-600";
    }
    if (val === correctTF) {
      return "bg-green-50 dark:bg-green-900/20 border-green-300";
    }
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

          <div className="space-y-4">
            {q.options?.map((opt) => {
              const optKey = opt.key;
              const optText = opt.text;
              return (
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
                          optKey,
                          val,
                          q.correct_answers,
                          q.user_answers
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
              );
            })}
          </div>

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