import { useState, useEffect, useContext } from "react";
import { useNavigate } from "react-router-dom";
import { AccountsContext } from "../../context/AccountsContext";
import { ContestAPI } from "../../apis/contests";
import {
  ExclamationTriangleIcon,
  AcademicCapIcon,
  LightBulbIcon,
  ShieldCheckIcon,
  TrophyIcon,
} from "@heroicons/react/24/outline";
import Spinner from "../../components/Spinner";
import DataTable from "../../components/DataTable";

export default function Contest() {
  const [contests, setContests] = useState([]);
  const [contestHistory, setContestHistory] = useState([]);
  const [loading, setLoading] = useState(true);
  const [joining, setJoining] = useState({});
  const [historyLoading, setHistoryLoading] = useState(false);
  const [error, setError] = useState("");
  const [timeLeft, setTimeLeft] = useState({}); // key: contestId, value: {hours, minutes, seconds, isActive, isScheduled}

  const navigate = useNavigate();
  const { user } = useContext(AccountsContext);

  useEffect(() => {
    fetchContests();
    fetchContestHistory();
  }, [user?.course_mode]);

  useEffect(() => {
    const interval = setInterval(() => {
      if (!contests.length) return;
      const now = new Date();
      const newTimeLeft = {};
      contests.forEach((contest) => {
        const start = new Date(contest.start_time);
        const end = new Date(contest.end_time);
        let diff = 0;
        if (now < start) {
          diff = start - now;
        } else if (now <= end) {
          diff = end - now;
        }
        newTimeLeft[contest.id] = {
          hours: Math.max(0, Math.floor(diff / 3600000)),
          minutes: Math.max(0, Math.floor((diff % 3600000) / 60000)),
          seconds: Math.max(0, Math.floor((diff % 60000) / 1000)),
          isActive: now >= start && now <= end,
          isScheduled: now < start,
        };
      });
      setTimeLeft(newTimeLeft);
    }, 1000);

    return () => clearInterval(interval);
  }, [contests]);

  const fetchContests = async () => {
    setLoading(true);
    setError("");
    try {
      const active = await ContestAPI.getContests('active');
      const scheduled = await ContestAPI.getContests('scheduled');
      const all = [...active, ...scheduled];
      
      // Filter out contests that have already ended (end_time in the past)
      const now = new Date();
      const upcoming = all.filter(contest => new Date(contest.end_time) > now);
      
      // Sort: active first (by end time), then scheduled (by start time)
      upcoming.sort((a, b) => {
        if (a.status === 'active' && b.status !== 'active') return -1;
        if (a.status !== 'active' && b.status === 'active') return 1;
        if (a.status === 'active' && b.status === 'active') {
          return new Date(a.end_time) - new Date(b.end_time);
        }
        return new Date(a.start_time) - new Date(b.start_time);
      });
      
      setContests(upcoming);
    } catch (err) {
      setError("Failed to load contest information.");
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  const fetchContestHistory = async () => {
    setHistoryLoading(true);
    try {
      const history = await ContestAPI.getHistory();
      setContestHistory(history);
    } catch (err) {
      console.error("Failed to load contest history:", err);
      setContestHistory([]);
    } finally {
      setHistoryLoading(false);
    }
  };

  const getParticipationForContest = (contestId) => {
    return contestHistory.find(p => String(p.contest) === String(contestId));
  };

  const handleJoin = async (contestId) => {
    if (!user) return navigate("/login");

    setJoining((prev) => ({ ...prev, [contestId]: true }));
    setError("");

    try {
      const existing = getParticipationForContest(contestId);

      if (existing) {
        if (existing.status === 'completed') {
          setError("You have already completed this contest.");
          setJoining((prev) => ({ ...prev, [contestId]: false }));
          return;
        }
        // started → resume
        navigate(`/contest/take/${existing.id}`);
      } else {
        const newParticipation = await ContestAPI.joinContest(contestId);
        if (!newParticipation?.id) {
          throw new Error("Server did not return a valid participation ID.");
        }
        navigate(`/contest/take/${newParticipation.id}`);
      }
    } catch (err) {
      console.error("Join contest error:", err);
      setError(err.response?.data?.error || err.message || "Failed to join contest.");
    } finally {
      setJoining((prev) => ({ ...prev, [contestId]: false }));
    }
  };

  const contestHistoryColumns = [
    {
      key: "started_at",
      header: "Date",
      minWidth: "120px",
      render: (value) => (value ? new Date(value).toLocaleDateString() : "N/A"),
    },
    {
      key: "contest_title",
      header: "Contest",
      minWidth: "200px",
    },
    {
      key: "status",
      header: "Status",
      minWidth: "100px",
      render: (value) => {
        let bgColor = "bg-gray-100 dark:bg-gray-700";
        let textColor = "text-gray-800 dark:text-gray-300";
        let displayText = value || "Unknown";

        if (value === "completed") {
          bgColor = "bg-green-100 dark:bg-green-900";
          textColor = "text-green-800 dark:text-green-300";
          displayText = "Completed";
        } else if (value === "started") {
          bgColor = "bg-yellow-100 dark:bg-yellow-900";
          textColor = "text-yellow-800 dark:text-yellow-300";
          displayText = "In Progress";
        }
        return (
          <span className={`inline-flex px-2 py-1 rounded-full text-xs font-medium ${bgColor} ${textColor}`}>
            {displayText}
          </span>
        );
      },
    },
    {
      key: "score",
      header: "Score",
      minWidth: "100px",
      render: (value, row) => `${value ?? 0} / ${row.total_score ?? 0}`,
    },
    {
      key: "rank",
      header: "Rank",
      minWidth: "80px",
      render: (value, row) => {
        if (row.status !== "completed") return "-";
        return value ? `${value}` : "-";
      },
    },
    {
      key: "participants_count",
      header: "Participants",
      minWidth: "100px",
      render: (value, row) => value || "-",
    },
    {
      key: "id",
      header: "Answers",
      minWidth: "100px",
      render: (value, row) => {
        const now = new Date();
        const contestEnded = row.contest_end_time ? new Date(row.contest_end_time) < now : false;
        if (row.status === "completed" && contestEnded) {
          return (
            <button
              onClick={() => navigate(`/contest/answers/${value}`)}
              className="text-blue-600 hover:text-blue-800 font-medium"
            >
              View
            </button>
          );
        }
        return <span className="text-gray-400">-</span>;
      },
    },
  ];

  if (loading) {
    return <Spinner fullScreen text="Loading Contest page..." />;
  }

  return (
    <div className="w-full flex justify-center px-3 sm:px-6">
      <div className="w-full lg:w-4/6 space-y-8 py-6">
        {error && (
          <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded flex items-center">
            <ExclamationTriangleIcon className="w-5 h-5 mr-2" />
            {error}
          </div>
        )}

        {/* Contest List */}
        <div className="bg-white dark:bg-gray-800 rounded-2xl shadow overflow-hidden">
          <div className="px-5 py-4 border-b border-gray-200 dark:border-gray-700">
            <h2 className="text-xl font-bold">Upcoming Contests</h2>
          </div>
          {contests.length === 0 ? (
            <div className="p-8 text-center text-gray-500 dark:text-gray-400">
              No upcoming contests at the moment.
            </div>
          ) : (
            <ul className="divide-y divide-gray-200 dark:divide-gray-700">
              {contests.map((contest) => {
                const timer = timeLeft[contest.id] || {
                  hours: 0,
                  minutes: 0,
                  seconds: 0,
                  isActive: false,
                  isScheduled: true,
                };

                const participation = getParticipationForContest(contest.id);
                const hasCompleted = participation?.status === 'completed';
                const hasStarted = participation?.status === 'started';

                let statusBadge = null;
                if (timer.isActive) {
                  statusBadge = (
                    <span className="bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-300 text-xs font-medium px-2.5 py-0.5 rounded-full ml-2">
                      Active
                    </span>
                  );
                } else if (timer.isScheduled) {
                  statusBadge = (
                    <span className="bg-yellow-100 text-yellow-800 dark:bg-yellow-900 dark:text-yellow-300 text-xs font-medium px-2.5 py-0.5 rounded-full ml-2">
                      Scheduled
                    </span>
                  );
                }

                // Determine button state and text
                const isJoining = joining[contest.id];
                let buttonDisabled = isJoining || !timer.isActive || hasCompleted;
                let buttonText = 'Join';
                if (isJoining) buttonText = 'Joining...';
                else if (hasCompleted) buttonText = 'Completed';
                else if (hasStarted) buttonText = 'Resume';
                else buttonText = 'Join';

                return (
                  <li key={contest.id} className="p-5">
                    <div className="flex items-center mb-2">
                      <h3 className="text-lg font-bold text-gray-900 dark:text-white">
                        {contest.title}
                      </h3>
                      {statusBadge}
                    </div>

                    {/* Timer + Join Button Row */}
                    <div className="flex flex-wrap items-center gap-6">
                      <div className="text-center">
                        <div className="text-4xl sm:text-5xl font-bold bg-white dark:bg-gray-800 px-6 py-4 rounded-xl shadow-md border border-green-200 dark:border-green-700 min-w-[100px]">
                          {timer.hours.toString().padStart(2, "0")}
                        </div>
                      </div>
                      <div className="text-center">
                        <div className="text-4xl sm:text-5xl font-bold bg-white dark:bg-gray-800 px-6 py-4 rounded-xl shadow-md border border-green-200 dark:border-green-700 min-w-[100px]">
                          {timer.minutes.toString().padStart(2, "0")}
                        </div>
                      </div>
                      <div className="text-center">
                        <div className="text-4xl sm:text-5xl font-bold bg-white dark:bg-gray-800 px-6 py-4 rounded-xl shadow-md border border-green-200 dark:border-green-700 min-w-[100px]">
                          {timer.seconds.toString().padStart(2, "0")}
                        </div>
                      </div>
                      <button
                        onClick={() => handleJoin(contest.id)}
                        disabled={buttonDisabled}
                        className={`px-6 py-3 text-lg font-bold rounded-xl transition ${
                          buttonDisabled && !hasCompleted
                            ? 'bg-gray-200 dark:bg-gray-700 text-gray-500 dark:text-gray-400 cursor-not-allowed'
                            : hasCompleted
                            ? 'bg-gray-400 cursor-not-allowed text-white'
                            : timer.isActive
                            ? 'bg-green-600 hover:bg-green-700 text-white'
                            : 'bg-gray-200 dark:bg-gray-700 text-gray-500 dark:text-gray-400 cursor-not-allowed'
                        }`}
                      >
                        {buttonText}
                      </button>
                    </div>
                  </li>
                );
              })}
            </ul>
          )}
        </div>

        {/* Instructions */}
        <div className="bg-white dark:bg-gray-800 p-5 rounded-2xl shadow">
          <h3 className="text-lg font-bold mb-4">Contest Instructions</h3>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <InstructionItem
              icon={AcademicCapIcon}
              iconBg="bg-blue-100 dark:bg-blue-900/30"
              iconColor="text-blue-600 dark:text-blue-400"
              title="Rules"
              text="Answer each option with True or False. +1 for correct, –0.5 for wrong, 0 for unanswered. Total score is sum of all options."
            />
            <InstructionItem
              icon={LightBulbIcon}
              iconBg="bg-yellow-100 dark:bg-yellow-900/30"
              iconColor="text-yellow-600 dark:text-yellow-400"
              title="Tips"
              text="Read each question carefully. Your answers are auto‑saved as you navigate. Submit only when finished."
            />
            <InstructionItem
              icon={ShieldCheckIcon}
              iconBg="bg-green-100 dark:bg-green-900/30"
              iconColor="text-green-600 dark:text-green-400"
              title="Fair Play"
              text="Do not refresh the page during the contest. Progress is automatically saved."
            />
            <InstructionItem
              icon={TrophyIcon}
              iconBg="bg-purple-100 dark:bg-purple-900/30"
              iconColor="text-purple-600 dark:text-purple-400"
              title="Winners"
              text="Top performers will be announced after the contest ends."
            />
          </div>
        </div>

        {/* Contest History */}
        <div className="bg-white dark:bg-gray-800 p-5 rounded-2xl shadow">
          <h3 className="text-lg font-bold mb-4">Contest History</h3>
          <DataTable
            data={contestHistory}
            columns={contestHistoryColumns}
            loading={historyLoading}
            totalItems={contestHistory.length}
            pageSize={10}
            showPagination={true}
            emptyMessage="No contest history to display yet."
          />
        </div>
      </div>
    </div>
  );
}

function InstructionItem({ icon: Icon, iconBg, iconColor, title, text }) {
  return (
    <div className="bg-gray-50 dark:bg-gray-700/50 p-4 rounded-xl">
      <div className="flex items-start">
        <div className={`flex-shrink-0 w-10 h-10 ${iconBg} rounded-lg flex items-center justify-center mr-3`}>
          <Icon className={`w-5 h-5 ${iconColor}`} />
        </div>
        <div>
          <h4 className="font-bold text-gray-900 dark:text-white mb-1">{title}</h4>
          <p className="text-sm text-gray-600 dark:text-gray-300">{text}</p>
        </div>
      </div>
    </div>
  );
}