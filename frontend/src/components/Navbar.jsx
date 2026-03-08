// frontend/src/components/Navbar.jsx
import { FaBars, FaMoon, FaSun } from "react-icons/fa";

export default function Navbar({ toggleSidebar, sidebarOpen, darkMode, setDarkMode }) {
  return (
    <nav className="flex items-center justify-between bg-white dark:bg-gray-800 p-4 shadow-sm transition-colors duration-300">
      <div className="flex items-center space-x-3">
        <button
          className="lg:hidden text-gray-700 dark:text-gray-200"
          onClick={toggleSidebar}
          aria-label="Toggle sidebar"
        >
          <FaBars size={22} />
        </button>

        {/* Animated app name – only on mobile when sidebar closed */}
        {!sidebarOpen && (
          <span className="text-xl font-bold animate-joelitemed">
            JoeliteMed
          </span>
        )}
      </div>

      <button
        onClick={() => setDarkMode(!darkMode)}
        className="p-2 rounded bg-gray-200 dark:bg-gray-700 text-gray-900 dark:text-gray-100 
                   transition-colors duration-300"
        aria-label={darkMode ? "Switch to light mode" : "Switch to dark mode"}
      >
        {darkMode ? <FaSun /> : <FaMoon />}
      </button>
    </nav>
  );
}