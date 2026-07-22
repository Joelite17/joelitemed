import { useState, useEffect } from "react";
import { useParams, useNavigate } from "react-router-dom";
import axios from "axios";
import { getUserToken } from "../../context/AccountsContext";
import { BASE_URL } from "../../apis/base_url";
import { MCQAPI } from "../../apis/mcqs";
import Spinner from "../../components/Spinner";
import { ArrowLeftIcon, FlagIcon } from "@heroicons/react/24/outline";

export default function SingleMCQPage() {
  const { id } = useParams();
  const navigate = useNavigate();
  const [mcq, setMcq] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  // Report states
  const [showReportModal, setShowReportModal] = useState(false);
  const [reportComment, setReportComment] = useState("");
  const [reportLoading, setReportLoading] = useState(false);
  const [reportError, setReportError] = useState(null);
  const [reportSuccess, setReportSuccess] = useState(false);

  useEffect(() => {
    const fetchMCQ = async () => {
      try {
        const token = getUserToken();
        const res = await axios.get(`${BASE_URL}/mcqsets/question/${id}/`, {
          headers: token ? { Authorization: `Bearer ${token}` } : {},
        });
        setMcq(res.data);
        console.log("API response:", res.data);
      } catch (err) {
        console.error("Failed to fetch MCQ:", err);
        setError(err.response?.status === 404 ? "Question not found." : "Error loading question.");
      } finally {
        setLoading(false);
      }
    };
    fetchMCQ();
  }, [id]);

  const handleReportSubmit = async () => {
    setReportLoading(true);
    setReportError(null);
    try {
      await MCQAPI.reportMCQ(mcq.id, reportComment);
      setReportSuccess(true);
      setReportComment("");
      setTimeout(() => {
        setShowReportModal(false);
        setReportSuccess(false);
      }, 2000);
    } catch (err) {
      setReportError(err.response?.data?.error || err.message || "Failed to submit report.");
    } finally {
      setReportLoading(false);
    }
  };

  if (loading) return <Spinner fullScreen text="Loading question..." />;
  if (error) return <div className="text-center py-10 text-red-500">{error}</div>;
  if (!mcq) return <div className="text-center py-10">No question found.</div>;

  const isTF = mcq.mcq_type === 'TF';

  return (
    <>
      {/* Main Container */}
      <div className="flex flex-col items-center w-full min-h-[400px] bg-gray-100 dark:bg-gray-900 text-gray-900 dark:text-gray-100 p-4">
        {/* Top Bar */}
        <div className="flex items-center justify-between w-full lg:w-4/6 mb-4">
          <button
            onClick={() => navigate(-1)}
            className="flex items-center text-gray-600 dark:text-gray-300 hover:text-gray-900 dark:hover:text-white transition-colors"
          >
            <ArrowLeftIcon className="w-5 h-5 mr-1" />
            Back
          </button>
          <p className="text-sm text-gray-500 dark:text-gray-400">Reviewed Question</p>
          <button
            onClick={() => setShowReportModal(true)}
            className="w-8 h-8 rounded-full border border-gray-300 dark:border-gray-600 flex items-center justify-center hover:bg-red-100 dark:hover:bg-red-900/30 hover:border-red-500 dark:hover:border-red-500 transition-all duration-200 hover:scale-105"
            aria-label="Report Issue"
          >
            <FlagIcon className="w-4 h-4 text-red-500 dark:text-red-400" />
          </button>
        </div>

        {/* Question Card */}
        <div className="w-full lg:w-4/6 bg-white dark:bg-gray-800 shadow-lg rounded-lg p-6 space-y-6">
          <p className="text-sm font-semibold mb-4">{mcq.question}</p>

          {isTF ? (
            // ----- True/False Layout -----
            mcq.options.map((opt) => {
              const isCorrect = opt.is_correct;
              return (
                <div key={opt.key} className="mb-4">
                  <div className="p-2 bg-gray-100 dark:bg-gray-700 rounded">
                    <span className="text-sm font-medium">{opt.key}. {opt.text}</span>
                  </div>
                  <div className="flex gap-4 mt-1 px-2">
                    {["T", "F"].map((val) => {
                      const isHighlighted = (val === "T" && isCorrect) || (val === "F" && !isCorrect);
                      return (
                        <div
                          key={val}
                          className={`flex items-center gap-2 px-2 py-1 border rounded ${
                            isHighlighted
                              ? "bg-green-100 dark:bg-green-800/40 border-green-600"
                              : "border-gray-200 dark:border-gray-700"
                          }`}
                        >
                          <input
                            type="checkbox"
                            disabled
                            checked={isHighlighted}
                            className="w-4 h-4 accent-blue-600 opacity-50"
                          />
                          <span className="text-sm">{val === "T" ? "True" : "False"}</span>
                        </div>
                      );
                    })}
                  </div>
                </div>
              );
            })
          ) : (
            // ----- Best Option (MCQ) Layout -----
            <div className="space-y-3">
              {mcq.options.map((opt) => {
                const isCorrect = opt.is_correct;
                return (
                  <div
                    key={opt.key}
                    className={`p-3 border rounded-lg transition-all ${
                      isCorrect
                        ? "bg-green-100 dark:bg-green-800/40 border-green-600 ring-2 ring-green-500"
                        : "border-gray-200 dark:border-gray-700"
                    }`}
                  >
                    <div className="flex items-center">
                      <input
                        type="radio"
                        name="single-mcq"
                        checked={isCorrect}
                        disabled
                        className="w-4 h-4 text-blue-600 focus:ring-blue-500 border-gray-300 opacity-50"
                      />
                      <span className="ml-3 text-sm font-medium">
                        {opt.key}. {opt.text}
                      </span>
                    </div>
                  </div>
                );
              })}
            </div>
          )}

          {/* Explanation */}
          {mcq.explanation && (
            <div className="mt-4">
              <button
                className="px-4 py-2 bg-gray-200 dark:bg-gray-700 text-gray-900 dark:text-gray-100 rounded-md hover:bg-gray-300 dark:hover:bg-gray-600 cursor-default"
                disabled
              >
                Show Explanation
              </button>
              <div className="mt-2 p-3 bg-gray-100 dark:bg-gray-800 rounded border border-gray-300 dark:border-gray-700 text-sm text-gray-900 dark:text-gray-100">
                {mcq.explanation}
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Report Modal */}
      {showReportModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
          <div className="bg-white dark:bg-gray-800 rounded-lg shadow-xl max-w-md w-full p-6">
            <h3 className="text-lg font-semibold mb-2 text-gray-900 dark:text-white">Report Question</h3>
            <p className="text-sm text-gray-600 dark:text-gray-300 mb-4">
              Help us improve by letting us know what's wrong with this question.
            </p>
            <textarea
              value={reportComment}
              onChange={(e) => setReportComment(e.target.value)}
              placeholder="Describe the issue (optional)"
              className="w-full p-2 border border-gray-300 dark:border-gray-600 rounded-md bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
              rows="3"
            />
            {reportError && <p className="text-red-500 text-sm mt-2">{reportError}</p>}
            {reportSuccess && <p className="text-green-500 text-sm mt-2">Thank you! Your report has been submitted.</p>}
            <div className="flex justify-end gap-3 mt-4">
              <button
                onClick={() => {
                  setShowReportModal(false);
                  setReportComment("");
                  setReportError(null);
                  setReportSuccess(false);
                }}
                className="px-4 py-2 bg-gray-200 dark:bg-gray-700 text-gray-800 dark:text-gray-200 rounded-md hover:bg-gray-300 dark:hover:bg-gray-600"
              >
                Cancel
              </button>
              <button
                onClick={handleReportSubmit}
                disabled={reportLoading || reportSuccess}
                className="px-4 py-2 bg-red-600 text-white rounded-md hover:bg-red-700 disabled:opacity-50"
              >
                {reportLoading ? "Submitting..." : reportSuccess ? "Submitted ✓" : "Submit Report"}
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}