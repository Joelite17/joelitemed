
// frontend/src/App.jsx
import { useState, useEffect, useContext, useCallback } from "react";
import { BrowserRouter as Router, Routes, Route, useLocation } from "react-router-dom";
import { AccountsContext } from "./context/AccountsContext";
import { NotificationProvider } from "./context/NotificationContext";

// Layout & UI
import Sidebar from "./components/Sidebar";
import Navbar from "./components/Navbar";

// Pages
import Feeds from "./pages/Feeds";
import Dashboard from "./pages/Dashboard";
import MCQDetailPage from "./pages/resources/MCQDetail";
import FlashcardDetailPage from "./pages/resources/FlashcardDetail";
import OSCEDetailPage from "./pages/resources/OSCEDetail";
import NoteDetailPage from "./pages/resources/NoteDetail";
import MCQSet from "./pages/resources/MCQSet";
import FlashcardSet from "./pages/resources/FlashcardSet";
import OSCESet from "./pages/resources/OSCESet";
import NoteSet from "./pages/resources/NoteSet";

// Accounts
import Signup from "./pages/accounts/Signup";
import UserProfilePage from "./pages/accounts/UserProfile";
import MyProfilePage from "./pages/accounts/MyProfile";
import Login from "./pages/accounts/Login";
import ForgotPassword from "./pages/accounts/ForgotPassword";
import ResetPassword from "./pages/accounts/ResetPassword";
import EditProfile from "./pages/accounts/EditProfile";  // ADD THIS IMPORT


// Contest
import Contest from "./pages/contests/Contest";
import ContestTake from "./pages/contests/ContestTake";
import ContestAnswers from "./pages/contests/ContestAnswers";

// Subscription, Contest
import Subscription from "./pages/Subscription";
// import Contest from "./pages/Contest";

// Context & Protection
import { AccountsProvider } from "./context/AccountsContext";
import ProtectedRoute from "./components/ProtectedRoute";

// Layout wrapper
function Layout({ children, sidebarOpen, setSidebarOpen, darkMode, setDarkMode }) {
  const location = useLocation();

  const hideLayout = [
    "/login",
    "/signup",
    "/forgot-password",
    "/reset-password",
    "/verify-email",
  ].includes(location.pathname);

  if (hideLayout) return <>{children}</>;

  return (
    <div className="flex min-h-screen w-full overflow-x-hidden bg-gray-100 dark:bg-gray-900 text-gray-900 dark:text-gray-100 transition-colors duration-300">
      <Sidebar
        isOpen={sidebarOpen}
        setIsOpen={setSidebarOpen}
        darkMode={darkMode}
        setDarkMode={setDarkMode}
      />

      {/* MAIN WRAPPER */}
      <div className="flex-1 flex flex-col relative w-full min-w-0 lg:pl-64">
        <Navbar
          toggleSidebar={() => setSidebarOpen(!sidebarOpen)}
          darkMode={darkMode}
          setDarkMode={setDarkMode}
        />

        {sidebarOpen && (
          <div
            className="fixed inset-0 bg-black bg-opacity-30 backdrop-blur-sm z-20 lg:hidden"
            onClick={() => setSidebarOpen(false)}
          />
        )}

        {/* MAIN CONTENT */}
        <main
          className={`
            flex-1
            w-full
            min-w-0
            p-4
            overflow-y-auto
            overflow-x-hidden
            transition-all
            duration-300
            ${sidebarOpen
              ? "opacity-50 pointer-events-none lg:opacity-100 lg:pointer-events-auto"
              : "opacity-100"}
          `}
        >
          {children}
        </main>
      </div>
    </div>
  );
}

function AppContent({ sidebarOpen, setSidebarOpen }) {
  const { user, updateDarkMode } = useContext(AccountsContext);
  
  // Initialize dark mode from localStorage, fallback to system preference
  const [darkMode, setDarkMode] = useState(() => {
    const saved = localStorage.getItem('darkMode');
    if (saved !== null) {
      return saved === 'true';
    }
    return window.matchMedia('(prefers-color-scheme: dark)').matches;
  });

  // Apply dark mode to HTML element
  useEffect(() => {
    document.documentElement.classList.toggle('dark', darkMode);
  }, [darkMode]);

  // Handle dark mode changes
  const handleDarkModeChange = useCallback(
    (newDarkMode) => {
      setDarkMode(newDarkMode);
      // Update server if user is logged in
      updateDarkMode(newDarkMode);
    },
    [updateDarkMode]
  );

  // Sync dark mode from user data when logged in
  useEffect(() => {
    if (user && user.dark_mode !== undefined) {
      const serverDarkMode = user.dark_mode;
      const localDarkMode = localStorage.getItem('darkMode') === 'true';
      
      // If they don't match, update local to match server
      if (serverDarkMode !== localDarkMode) {
        setDarkMode(serverDarkMode);
        localStorage.setItem('darkMode', serverDarkMode);
      }
    }
  }, [user]);

  return (
    <Layout
      sidebarOpen={sidebarOpen}
      setSidebarOpen={setSidebarOpen}
      darkMode={darkMode}
      setDarkMode={handleDarkModeChange}
    >
      <Routes>
        {/* Public */}
        <Route path="/login" element={<Login />} />
        <Route path="/signup" element={<Signup />} />
        <Route path="/forgot-password" element={<ForgotPassword />} />
        <Route path="/reset-password" element={<ResetPassword />} />

        {/* Protected */}
        <Route
          path="/*"
          element={
            <ProtectedRoute>
              <Routes>
                <Route path="/" element={<Dashboard />} />
                <Route path="/feeds" element={<Feeds />} />

                <Route path="/mcqsets" element={<MCQSet />} />
                <Route path="/flashcardsets" element={<FlashcardSet />} />
                <Route path="/oscesets" element={<OSCESet />} />
                <Route path="/notes" element={<NoteSet />} />

                <Route path="/profiles/:username" element={<UserProfilePage />} />
                <Route path="/profile" element={<MyProfilePage />} />
                <Route path="/edit-profile" element={<EditProfile />} /> {/* ADD THIS LINE */}

                <Route path="/mcqsets/:id" element={<MCQDetailPage />} />
                <Route path="/flashcardsets/:id" element={<FlashcardDetailPage />} />
                <Route path="/oscesets/:id" element={<OSCEDetailPage />} />
                <Route path="/notes/:id" element={<NoteDetailPage />} />

                <Route path="/subscription" element={<Subscription />} />

                
                <Route path="/contest" element={<Contest />} />
                <Route path="/contest/take/:participationId" element={<ContestTake />} />
                <Route path="/contest/answers/:participationId" element={<ContestAnswers />} />
              </Routes>
            </ProtectedRoute>
          }
        />
      </Routes>
    </Layout>
  );
}

export default function App() {
  const [sidebarOpen, setSidebarOpen] = useState(false);

  return (
    <NotificationProvider>
      <AccountsProvider>
        <Router>
          <AppContent
            sidebarOpen={sidebarOpen}
            setSidebarOpen={setSidebarOpen}
          />
        </Router>
      </AccountsProvider>
    </NotificationProvider>
  );
}