import { FaBars, FaMoon, FaSun } from "react-icons/fa";
import logo from "../assets/joelite.png"; // import your logo

export default function Navbar({ toggleSidebar, darkMode, setDarkMode }) {
  return (
    <nav className="flex items-center justify-between bg-white dark:bg-gray-800 p-4 shadow-sm transition-colors duration-300">
      <div className="flex items-center space-x-3">
        <button
          className="lg:hidden text-gray-700 dark:text-gray-200"
          onClick={toggleSidebar}
        >
          <FaBars size={22} />
        </button>
        {/* <img src={logo} alt="Logo" className="h-8 w-auto" /> */}
        <span className="text-xl font-bold border-gray-200 dark:border-gray-700">
          MyApp2
        </span>
      </div>

      {/* Dark mode toggle */}
      <button
        onClick={() => setDarkMode(!darkMode)}
        className="p-2 rounded bg-gray-200 dark:bg-gray-700 text-gray-900 dark:text-gray-100 transition-colors duration-300"
      >
        {darkMode ? <FaSun /> : <FaMoon />}
      </button>
    </nav>
  );
}
