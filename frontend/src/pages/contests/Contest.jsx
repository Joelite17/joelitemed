import { useState, useEffect, useContext, useCallback } from "react";
import { useNavigate } from "react-router-dom";
import { AccountsContext } from "../../context/AccountsContext";
import { ContestAPI } from "../../apis/contests";
import {
  CalendarIcon,
  ClockIcon,
  TrophyIcon,
  ExclamationTriangleIcon,
  UserGroupIcon,
  QuestionMarkCircleIcon,
  AcademicCapIcon,
  LightBulbIcon,
  ShieldCheckIcon,
} from "@heroicons/react/24/outline";
import Spinner from "../../components/Spinner";
import DataTable from "../../components/DataTable";

export default function Contest() {
  const [contests, setContests] = useState([]);
  const [selectedContest, setSelectedContest] = useState(null);
  const [participation, setParticipation] = useState(null);
  const [contestHistory, setContestHistory] = useState([]);
  const [loading, setLoading] = useState(true);
  const [joining, setJoining] = useState(false);
  const [historyLoading, setHistoryLoading] = useState(false);
  const [error, setError] = useState("");
  const [timeLeft, setTimeLeft] = useState({ hours: 0, minutes: 0, seconds: 0 });
  const [isContestActive, setIsContestActive] = useState(false);
  const [hasCompleted, setHasCompleted] = useState(false);

  const navigate = useNavigate();
  const { user } = useContext(AccountsContext);

  useEffect(() => {
    fetchContests();
    fetchContestHistory();
  }, []);

  useEffect(() => {
    if (!selectedContest) return;
    const interval = setInterval(updateTimer, 1000);
    return () => clearInterval(interval);
  }, [selectedContest]);

  const fetchContests = async () => {
    setLoading(true);
    setError("");
    try {
      const active = await ContestAPI.getContests('active');
      const scheduled = await ContestAPI.getContests('scheduled');
      const all = [...active, ...scheduled];
      setContests(all);

      const now = new Date();
      const activeNow = all.filter(c => {
        const start = new Date(c.start_time);
        const end = new Date(c.end_time);
        return c.status === 'active' && now >= start && now <= end;
      });
      if (activeNow.length > 0) {
        activeNow.sort((a, b) => new Date(a.end_time) - new Date(b.end_time));
        setSelectedContest(activeNow[0]);
      } else {
        const upcoming = all.filter(c => c.status === 'scheduled');
        upcoming.sort((a, b) => new Date(a.start_time) - new Date(b.start_time));
        if (upcoming.length > 0) setSelectedContest(upcoming[0]);
        else setSelectedContest(null);
      }
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

  useEffect(() => {
    if (!selectedContest || !user) return;

    const checkParticipation = async () => {
      try {
        const history = await ContestAPI.getHistory();
        const found = history.find(p => String(p.contest) === String(selectedContest.id));
        if (found) {
          setParticipation(found);
          setHasCompleted(found.status === 'completed');
        } else {
          setParticipation(null);
          setHasCompleted(false);
        }
      } catch (err) {
        console.error("Failed to check participation:", err);
      }
    };
    checkParticipation();
  }, [selectedContest, user]);

  const updateTimer = () => {
    if (!selectedContest) return;
    const now = new Date();
    const start = new Date(selectedContest.start_time);
    const end = new Date(selectedContest.end_time);

    const activeNow = now >= start && now <= end && selectedContest.status === 'active';
    setIsContestActive(activeNow);

    let diff;
    if (now < start) {
      diff = start - now;
    } else if (now <= end) {
      diff = end - now;
    } else {
      diff = 0;
    }

    setTimeLeft({
      hours: Math.max(0, Math.floor(diff / 3600000)),
      minutes: Math.max(0, Math.floor((diff % 3600000) / 60000)),
      seconds: Math.max(0, Math.floor((diff % 60000) / 1000))
    });
  };

  const handleJoinOrResume = async () => {
    if (!user) return navigate("/login");
    if (!isContestActive) {
      setError("Contest is not active yet. Please wait for the start time.");
      return;
    }
    if (hasCompleted) {
      setError("You have already completed this contest.");
      return;
    }

    setJoining(true);
    setError("");
    try {
      let participationId;
      if (participation && participation.status === 'started') {
        participationId = participation.id;
        navigate(`/contest/take/${participationId}`);
      } else {
        const newParticipation = await ContestAPI.joinContest(selectedContest.id);
        if (!newParticipation?.id) {
          throw new Error("Server did not return a valid participation ID.");
        }
        navigate(`/contest/take/${newParticipation.id}`);
      }
    } catch (err) {
      console.error("Join contest error:", err);
      if (err.response?.data?.error) {
        setError(err.response.data.error);
      } else if (err.message) {
        setError(err.message);
      } else {
        setError("Failed to join contest. Please try again.");
      }
    } finally {
      setJoining(false);
    }
  };

  // Columns for contest history table
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

        {selectedContest ? (
          <>
            {/* Timer and Join/Resume Card */}
            <div className="bg-white dark:bg-gray-800 p-5 rounded-2xl shadow">
              <h2 className="text-xl sm:text-2xl font-bold mb-4">
                {selectedContest.title}
              </h2>

              <div className="bg-gradient-to-r from-green-50 to-emerald-50 dark:from-green-900/20 dark:to-emerald-900/20 p-6 rounded-2xl shadow-inner">
                <div className="flex flex-wrap justify-center gap-6">
                  {["hours", "minutes", "seconds"].map(unit => (
                    <div key={unit} className="text-center">
                      <div className="text-4xl sm:text-5xl font-bold bg-white dark:bg-gray-800 px-6 py-4 rounded-xl shadow-md border border-green-200 dark:border-green-700 min-w-[100px]">
                        {timeLeft[unit].toString().padStart(2, "0")}
                      </div>
                      <div className="text-sm uppercase tracking-wider mt-2 text-gray-600 dark:text-gray-400 font-medium">
                        {unit}
                      </div>
                    </div>
                  ))}
                </div>
                <div className="text-center mt-4 text-sm text-gray-500 dark:text-gray-400">
                  {isContestActive ? (
                    <span className="text-green-600 dark:text-green-400 font-semibold">
                      ⏳ Contest is active – time remaining
                    </span>
                  ) : new Date(selectedContest.start_time) > new Date() ? (
                    <span className="text-amber-600 dark:text-amber-400 font-semibold">
                      ⏰ Contest starts in
                    </span>
                  ) : (
                    <span className="text-red-600 dark:text-red-400 font-semibold">
                      Contest has ended
                    </span>
                  )}
                </div>
              </div>

              <button
                onClick={handleJoinOrResume}
                disabled={joining || !isContestActive || hasCompleted}
                className={`mt-6 w-full sm:w-auto px-6 py-3 font-bold rounded-xl transition disabled:opacity-50 ${
                  hasCompleted
                    ? 'bg-gray-400 cursor-not-allowed'
                    : !isContestActive
                    ? 'bg-gray-400 cursor-not-allowed'
                    : 'bg-green-600 hover:bg-green-700 text-white'
                }`}
              >
                {joining
                  ? "Please wait..."
                  : !isContestActive
                  ? new Date(selectedContest.start_time) > new Date()
                    ? "Not Started Yet"
                    : "Contest Ended"
                  : hasCompleted
                  ? "Already Participated"
                  : participation
                  ? "Resume Contest"
                  : "Join Contest"}
              </button>
            </div>

            {/* Stats */}
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
              <Stat
                label="Start Time"
                value={new Date(selectedContest.start_time).toLocaleString()}
                icon={CalendarIcon}
              />
              <Stat
                label="Duration"
                value={`${selectedContest.duration_minutes} mins`}
                icon={ClockIcon}
              />
              <Stat
                label="Questions"
                value={selectedContest.total_questions}
                icon={QuestionMarkCircleIcon}
              />
              <Stat
                label="Participants"
                value={selectedContest.participants_count || 0}
                icon={UserGroupIcon}
              />
            </div>
          </>
        ) : (
          <div className="bg-white dark:bg-gray-800 p-8 rounded-2xl shadow text-center">
            <p className="text-gray-600 dark:text-gray-300 text-lg">
              No active or upcoming contests at the moment. Check back later!
            </p>
          </div>
        )}

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

function Stat({ label, value, icon: Icon }) {
  return (
    <div className="bg-white dark:bg-gray-800 p-4 rounded-xl shadow">
      <div className="flex items-center text-sm text-gray-500 mb-1">
        <Icon className="w-4 h-4 mr-2" />
        {label}
      </div>
      <div className="font-bold text-lg">{value}</div>
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