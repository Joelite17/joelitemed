import { useState, useEffect, useContext, useMemo } from "react";
import { AccountsContext } from "../context/AccountsContext";
import { ScoreAPI } from "../apis/mcqs";
import DataTable from "../components/DataTable";
import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  Legend,
} from "recharts";

export default function Dashboard() {
  const { user } = useContext(AccountsContext);
  const username = user?.username || "User";
  const courseMode = user?.course_mode || "";

  const [scores, setScores] = useState([]);
  const [loading, setLoading] = useState(true);
  const [currentPage, setCurrentPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [totalScores, setTotalScores] = useState(0);
  const [isDark, setIsDark] = useState(false);
  const pageSize = 10;

  // Monitor dark mode changes
  useEffect(() => {
    const htmlElement = document.documentElement;
    setIsDark(htmlElement.classList.contains("dark"));
    const observer = new MutationObserver(() => {
      setIsDark(htmlElement.classList.contains("dark"));
    });
    observer.observe(htmlElement, { attributes: true, attributeFilter: ['class'] });
    return () => observer.disconnect();
  }, []);

  // Reset to page 1 when course mode changes
  useEffect(() => {
    setCurrentPage(1);
  }, [courseMode]);

  // Fetch scores with pagination and course_mode filter
  useEffect(() => {
    const fetchScores = async () => {
      try {
        setLoading(true);
        const data = await ScoreAPI.fetchAllScores(currentPage, pageSize, courseMode);
        
        const scoreResults = data.results || [];
        const count = data.count || 0;
        
        const formatted = scoreResults.map((s) => ({
          id: s.id,
          mcq_set_title: s.mcq_set_title || `Test ${s.id}`,
          percentage: s.total_score > 0 ? ((s.score / s.total_score) * 100).toFixed(1) : 0,
          score: s.score,
          total_score: s.total_score,
          taken_at: new Date(s.taken_at).toLocaleDateString('en-US', {
            month: 'short',
            day: 'numeric',
            hour: '2-digit',
            minute: '2-digit'
          }),
          full_date: new Date(s.taken_at),
          raw_taken_at: s.taken_at,
        }));

        const sorted = formatted.sort((a, b) => a.full_date - b.full_date);
        setScores(sorted);
        setTotalScores(count);
        setTotalPages(Math.ceil(count / pageSize) || 1);
        
      } catch (err) {
        console.error("Error fetching scores:", err);
        setScores([]);
      } finally {
        setLoading(false);
      }
    };

    fetchScores();
  }, [currentPage, courseMode]); // 👈 refetch when courseMode changes

  // Calculate statistics
  const stats = useMemo(() => ({
    totalTests: totalScores,
    averageScore: scores.length > 0 
      ? (scores.reduce((sum, s) => sum + parseFloat(s.percentage), 0) / scores.length).toFixed(1)
      : 0,
    highestScore: scores.length > 0
      ? Math.max(...scores.map(s => parseFloat(s.percentage)))
      : 0,
    latestScore: scores.length > 0
      ? parseFloat(scores[scores.length - 1]?.percentage)
      : 0,
  }), [scores, totalScores]);

  // Memoize chart colors
  const chartColors = useMemo(() => ({
    gridColor: isDark ? "#374151" : "#e5e7eb",
    textColor: isDark ? "#f9fafb" : "#111827",
    axisColor: isDark ? "#9ca3af" : "#6b7280",
    bgColor: isDark ? "#1f2937" : "#ffffff",
    lineColor: "#4ade80",
  }), [isDark]);

  // Table columns
  const tableColumns = [
    {
      key: "mcq_set_title",
      header: "Test",
      minWidth: "200px",
      cellClassName: "min-w-[200px]",
    },
    {
      key: "score",
      header: "Score",
      minWidth: "120px",
      render: (value, row) => `${row.score}/${row.total_score}`,
    },
    {
      key: "percentage",
      header: "Percentage",
      minWidth: "120px",
      render: (value) => {
        const percentage = parseFloat(value);
        const colorClass = percentage < 50 
          ? "text-red-600 dark:text-red-400" 
          : "text-green-600 dark:text-green-400";
        return (
          <span className={`font-semibold ${colorClass}`}>
            {value}%
          </span>
        );
      },
    },
    {
      key: "taken_at",
      header: "Date",
      minWidth: "150px",
      cellClassName: "text-gray-500 dark:text-gray-400 min-w-[150px]",
      render: (value, row) => (
        <div>
          <div className="text-xs md:text-sm">{value}</div>
          <div className="text-xs text-gray-400 dark:text-gray-500">
            {new Date(row.raw_taken_at).toLocaleDateString('en-US', { weekday: 'short' })}
          </div>
        </div>
      ),
    },
  ];

  // Custom tooltip
  const CustomTooltip = ({ active, payload, label }) => {
    if (active && payload && payload.length) {
      return (
        <div className="bg-white dark:bg-gray-800 p-3 md:p-4 border border-gray-200 dark:border-gray-700 rounded-lg shadow-lg">
          <p className="font-semibold text-gray-900 dark:text-white text-sm md:text-base">{label}</p>
          <p className="text-green-600 dark:text-green-400 text-sm md:text-base">
            Score: {payload[0].value}%
          </p>
          <p className="text-gray-600 dark:text-gray-400 text-xs md:text-sm">
            {payload[0]?.payload?.score || 0}/{payload[0]?.payload?.total_score || 0} points
          </p>
          <p className="text-gray-500 dark:text-gray-500 text-xs">
            {payload[0]?.payload?.taken_at || ''}
          </p>
        </div>
      );
    }
    return null;
  };

  const handlePageChange = (page) => {
    if (page < 1 || page > totalPages) return;
    setCurrentPage(page);
  };

  const handleRowClick = (row) => {
    console.log("Row clicked:", row);
  };

  const formatXAxisTick = (value) => {
    if (typeof window !== 'undefined') {
      if (window.innerWidth < 640) {
        return value.split(',').length > 1 ? value.split(',')[0] : value.slice(0, 8) + '...';
      }
      if (window.innerWidth < 1024) {
        return value.length > 12 ? value.slice(0, 12) + '...' : value;
      }
    }
    return value;
  };

  return (
    <div className="flex-1 p-3 md:p-4 lg:p-6 bg-gray-100 dark:bg-gray-900 min-h-screen text-gray-900 dark:text-gray-100">
      {/* Header with course mode */}
      <div className="mb-6">
        <h1 className="text-xl md:text-2xl lg:text-3xl font-bold">Welcome {username}!</h1>
        <p className="text-gray-600 dark:text-gray-400 text-sm md:text-base mt-1">
          {courseMode
            ? `Showing progress for: ${courseMode}`
            : "Track your progress and performance"}
        </p>
      </div>
      
      {/* Stats Cards */}
      <div className="grid grid-cols-2 sm:grid-cols-2 md:grid-cols-4 gap-3 md:gap-4 mb-6 md:mb-8">
        <div className="bg-white dark:bg-gray-800 p-3 md:p-4 rounded-lg shadow">
          <p className="text-xs md:text-sm text-gray-600 dark:text-gray-400">Total Tests</p>
          <p className="text-xl md:text-2xl font-bold mt-1">{stats.totalTests}</p>
        </div>
        <div className="bg-white dark:bg-gray-800 p-3 md:p-4 rounded-lg shadow">
          <p className="text-xs md:text-sm text-gray-600 dark:text-gray-400">Average Score</p>
          <p className="text-xl md:text-2xl font-bold mt-1">{stats.averageScore}%</p>
        </div>
        <div className="bg-white dark:bg-gray-800 p-3 md:p-4 rounded-lg shadow">
          <p className="text-xs md:text-sm text-gray-600 dark:text-gray-400">Highest Score</p>
          <p className="text-xl md:text-2xl font-bold mt-1">{stats.highestScore}%</p>
        </div>
        <div className="bg-white dark:bg-gray-800 p-3 md:p-4 rounded-lg shadow">
          <p className="text-xs md:text-sm text-gray-600 dark:text-gray-400">Latest Score</p>
          <p className="text-xl md:text-2xl font-bold mt-1">{stats.latestScore}%</p>
        </div>
      </div>

      {/* Progress Chart */}
      <div className="bg-white dark:bg-gray-800 p-4 md:p-6 rounded-lg shadow mb-6 md:mb-8">
        <h2 className="text-lg md:text-xl font-semibold mb-4">Your Progress Over Time</h2>
        
        {loading ? (
          <div className="flex justify-center items-center h-48 md:h-64">
            <div className="animate-spin rounded-full h-10 w-10 md:h-12 md:w-12 border-t-2 border-b-2 border-green-500"></div>
          </div>
        ) : scores.length === 0 ? (
          <div className="text-center py-8 md:py-12">
            <div className="text-gray-400 mb-3 md:mb-4">
              <svg className="w-12 h-12 md:w-16 md:h-16 mx-auto" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1} d="M9.172 16.172a4 4 0 015.656 0M9 10h.01M15 10h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
            </div>
            <p className="text-gray-600 dark:text-gray-400 mb-3 md:mb-4 text-sm md:text-base">
              {courseMode
                ? `No test scores for ${courseMode} yet. Take some tests to see your progress!`
                : "No test scores yet. Take some tests to see your progress!"}
            </p>
          </div>
        ) : (
          <>
            <div className="h-64 md:h-72 lg:h-80">
              <ResponsiveContainer width="100%" height="100%">
                <LineChart
                  data={scores}
                  margin={{ 
                    top: 20, 
                    right: window.innerWidth < 640 ? 10 : 30, 
                    bottom: 60, 
                    left: window.innerWidth < 640 ? 0 : 10 
                  }}
                >
                  <CartesianGrid stroke={chartColors.gridColor} strokeDasharray="3 3" />
                  <XAxis
                    dataKey="taken_at"
                    stroke={chartColors.axisColor}
                    tick={{ fill: chartColors.axisColor, fontSize: window.innerWidth < 640 ? 10 : 12 }}
                    angle={window.innerWidth < 640 ? -90 : -45}
                    textAnchor="end"
                    height={window.innerWidth < 640 ? 80 : 60}
                    tickFormatter={formatXAxisTick}
                    interval="preserveStartEnd"
                  />
                  <YAxis
                    domain={[0, 100]}
                    stroke={chartColors.axisColor}
                    tick={{ fill: chartColors.axisColor, fontSize: window.innerWidth < 640 ? 10 : 12 }}
                    label={{
                      value: 'Score (%)',
                      angle: -90,
                      position: 'insideLeft',
                      fill: chartColors.axisColor,
                      fontSize: window.innerWidth < 640 ? 10 : 12,
                      offset: window.innerWidth < 640 ? 5 : 10
                    }}
                  />
                  <Tooltip content={<CustomTooltip />} wrapperStyle={{ zIndex: 100 }} />
                  <Legend wrapperStyle={{ paddingTop: window.innerWidth < 640 ? '10px' : '0' }} />
                  <Line
                    type="monotone"
                    dataKey="percentage"
                    name="Score %"
                    stroke={chartColors.lineColor}
                    strokeWidth={window.innerWidth < 640 ? 2 : 3}
                    dot={{ r: window.innerWidth < 640 ? 3 : 5, stroke: chartColors.lineColor, strokeWidth: 2, fill: chartColors.bgColor }}
                    activeDot={{ r: window.innerWidth < 640 ? 6 : 8, fill: chartColors.lineColor }}
                  />
                </LineChart>
              </ResponsiveContainer>
            </div>
          </>
        )}
      </div>

      {/* Test Results Table */}
      <div className="bg-white dark:bg-gray-800 p-4 md:p-6 rounded-lg shadow mb-6 md:mb-8">
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between mb-4">
          <h2 className="text-lg md:text-xl font-semibold mb-2 sm:mb-0">Test Results</h2>
          <div className="text-sm text-gray-600 dark:text-gray-400">
            Showing {Math.min(scores.length, pageSize)} of {totalScores} results
          </div>
        </div>

        <DataTable
          data={scores}
          columns={tableColumns}
          loading={loading}
          currentPage={currentPage}
          totalItems={totalScores}
          pageSize={pageSize}
          onPageChange={handlePageChange}
          onRowClick={handleRowClick}
          emptyMessage="No test results available. Take some tests to see your scores!"
        />
      </div>
    </div>
  );
}