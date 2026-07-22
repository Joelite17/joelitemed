import { useState, useEffect, useContext } from "react";
import { useNavigate } from "react-router-dom";
import { AccountsContext } from "../../context/AccountsContext";
import { MCQAPI } from "../../apis/mcqs";
import { useNotification, NOTIFICATION_TYPES } from "../../context/NotificationContext";
import Spinner from "../../components/Spinner";

export default function ReviewedReports() {
  const { user } = useContext(AccountsContext);
  const { addNotification } = useNotification();
  const [reports, setReports] = useState([]);
  const [loading, setLoading] = useState(true);
  const navigate = useNavigate();

  useEffect(() => {
    fetchReports();
  }, []);

  const fetchReports = async () => {
    setLoading(true);
    try {
      const response = await MCQAPI.getMyReports();
      setReports(response);
    } catch (err) {
      console.error("Failed to fetch reports:", err);
      addNotification({
        message: "Failed to load reviewed questions.",
        type: NOTIFICATION_TYPES.ERROR,
      });
    } finally {
      setLoading(false);
    }
  };

  const handleCardClick = (mcqId) => {
    navigate(`/mcq-question/${mcqId}`);
  };

  if (loading) {
    return <Spinner fullContainer text="Loading reviewed questions..." />;
  }

  return (
    <div className="space-y-4">
      {reports.length === 0 ? (
        <div className="text-center py-12">
          <div className="text-gray-400 mb-4">
            <svg
              className="w-16 h-16 mx-auto"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={1}
                d="M9.172 16.172a4 4 0 015.656 0M9 10h.01M15 10h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"
              />
            </svg>
          </div>
          <p className="text-gray-600 dark:text-gray-400">
            No reviewed questions yet. Check back after your reports have been resolved.
          </p>
        </div>
      ) : (
        reports.map((report) => (
          <div
            key={report.id}
            className="bg-white dark:bg-gray-800 shadow-sm rounded-lg p-4 border border-green-100 dark:border-green-700 hover:shadow-md hover:bg-gray-50 dark:hover:bg-gray-750 transition-all duration-200 cursor-pointer"
            onClick={() => handleCardClick(report.mcq_id)}
          >
            <p className="text-gray-900 dark:text-gray-100 font-medium text-sm leading-snug break-words">
              {report.question}
            </p>

            <div className="flex justify-between items-center mt-3">
              <span className="text-xs font-semibold text-green-700 dark:text-green-400 bg-green-100 dark:bg-green-900 px-2 py-0.5 rounded-md">
                {report.course_mode?.toUpperCase() || "MCQ"}
              </span>
            </div>

            <div className="mt-2 text-xs text-gray-500 dark:text-gray-400">
              {report.set_title} · Resolved:{" "}
              {report.resolved_at
                ? new Date(report.resolved_at).toLocaleDateString()
                : "N/A"}
            </div>
          </div>
        ))
      )}
    </div>
  );
}