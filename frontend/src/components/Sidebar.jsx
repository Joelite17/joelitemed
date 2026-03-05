import { MdDashboard } from "react-icons/md";
import { FaHome, FaUser, FaCreditCard, FaSignOutAlt } from "react-icons/fa";
import { IoDocumentText, IoFlash, IoMedical, IoAlbums, IoTrophy } from "react-icons/io5";
import { Link, useNavigate } from "react-router-dom";
import { useContext, useState } from "react";
import { AccountsContext } from "../context/AccountsContext";

export default function Sidebar({ isOpen, setIsOpen, darkMode, setDarkMode }) {
  const { logout, user } = useContext(AccountsContext);
  const navigate = useNavigate();
  const [showLogoutConfirm, setShowLogoutConfirm] = useState(false);

  const handleLogoutClick = () => {
    setShowLogoutConfirm(true);
  };

  const confirmLogout = () => {
    logout();
    setIsOpen(false);
    setShowLogoutConfirm(false);
    navigate("/login");
  };

  const cancelLogout = () => {
    setShowLogoutConfirm(false);
  };

  const toggleDarkMode = () => {
    setDarkMode(!darkMode);
  };

  const navigationItems = [
    { icon: <MdDashboard className="w-5 h-5" />, label: "Dashboard", path: "/" },
    { icon: <FaHome className="w-5 h-5" />, label: "Feeds", path: "/feeds" },
    { icon: <IoMedical className="w-5 h-5" />, label: "MCQs", path: "/mcqsets" },
    { icon: <IoFlash className="w-5 h-5" />, label: "Flashcards", path: "/flashcardsets" },
    { icon: <IoAlbums className="w-5 h-5" />, label: "OSCEs", path: "/oscesets" },
    { icon: <IoDocumentText className="w-5 h-5" />, label: "Notes", path: "/notes" },
    { icon: <IoTrophy className="w-5 h-5" />, label: "Contest", path: "/contest" }
  ];

  const accountItems = [
    { 
      icon: <FaCreditCard className="w-5 h-5" />, 
      label: "Subscription", 
      path: "/subscription",
      badge: user?.has_active_subscription ? "✓" : null,
      badgeColor: "bg-green-500"
    },
    { icon: <FaUser className="w-5 h-5" />, label: "My Profile", path: "/profile" },
    { 
      icon: <FaSignOutAlt className="w-5 h-5" />, 
      label: "Logout", 
      action: handleLogoutClick,
      isButton: true 
    },
  ];

  const handleLinkClick = () => {
    if (isOpen) setIsOpen(false);
  };

  return (
    <>
      {isOpen && (
        <div
          className="fixed inset-0 bg-black bg-opacity-50 lg:hidden z-20"
          onClick={() => setIsOpen(false)}
        />
      )}
      
      <aside
        className={`fixed top-0 left-0 bottom-0 z-30 bg-white dark:bg-gray-800 w-64 shadow-lg transform transition-transform duration-300 ease-in-out
        ${isOpen ? "translate-x-0" : "-translate-x-full lg:translate-x-0"} flex flex-col`}
      >
        {/* Logo/Header */}
        <div className="p-6 border-b border-gray-200 dark:border-gray-700 flex-shrink-0">
          <div className="flex items-center space-x-3">
            <div className="w-10 h-10 bg-gradient-to-r from-green-500 to-emerald-600 rounded-lg flex items-center justify-center">
              <span className="text-white font-bold text-lg">M</span>
            </div>
            <div>
              <h1 className="text-xl font-bold text-gray-900 dark:text-white">MediStudy</h1>
              <p className="text-xs text-gray-500 dark:text-gray-400">Premium Content</p>
            </div>
          </div>
        </div>

        {/* Navigation Menu */}
        <nav className="flex-1 p-4 overflow-y-auto">
          <div className="mb-6">
            <h3 className="text-xs uppercase tracking-wider text-gray-500 dark:text-gray-400 font-semibold mb-3 px-2">
              Navigation
            </h3>
            <ul className="space-y-1">
              {navigationItems.map((item, index) => (
                <li key={index}>
                  <Link
                    to={item.path}
                    onClick={handleLinkClick}
                    className="flex items-center justify-between px-3 py-3 rounded-lg text-gray-700 dark:text-gray-200 hover:bg-gray-100 dark:hover:bg-gray-700/50 hover:text-green-600 dark:hover:text-green-400 cursor-pointer transition-all duration-200 group"
                  >
                    <div className="flex items-center space-x-3">
                      <div className="text-gray-500 dark:text-gray-400 group-hover:text-green-600 dark:group-hover:text-green-400">
                        {item.icon}
                      </div>
                      <span className="font-medium">{item.label}</span>
                    </div>
                    {item.badge && (
                      <span className={`${item.badgeColor} text-white text-xs px-2 py-1 rounded-full`}>
                        {item.badge}
                      </span>
                    )}
                  </Link>
                </li>
              ))}
            </ul>
          </div>

          {/* Account Section */}
          <div className="mb-6">
            <h3 className="text-xs uppercase tracking-wider text-gray-500 dark:text-gray-400 font-semibold mb-3 px-2">
              Account
            </h3>
            <ul className="space-y-1">
              {accountItems.map((item, index) => (
                <li key={index}>
                  {item.isButton ? (
                    <button
                      onClick={item.action}
                      className="flex items-center justify-between w-full px-3 py-3 rounded-lg text-gray-700 dark:text-gray-200 hover:bg-gray-100 dark:hover:bg-gray-700/50 hover:text-red-600 dark:hover:text-red-400 cursor-pointer transition-all duration-200 group"
                    >
                      <div className="flex items-center space-x-3">
                        <div className="text-gray-500 dark:text-gray-400 group-hover:text-red-600 dark:group-hover:text-red-400">
                          {item.icon}
                        </div>
                        <span className="font-medium">{item.label}</span>
                      </div>
                    </button>
                  ) : (
                    <Link
                      to={item.path}
                      onClick={handleLinkClick}
                      className="flex items-center justify-between px-3 py-3 rounded-lg text-gray-700 dark:text-gray-200 hover:bg-gray-100 dark:hover:bg-gray-700/50 hover:text-green-600 dark:hover:text-green-400 cursor-pointer transition-all duration-200 group"
                    >
                      <div className="flex items-center space-x-3">
                        <div className="text-gray-500 dark:text-gray-400 group-hover:text-green-600 dark:group-hover:text-green-400">
                          {item.icon}
                        </div>
                        <span className="font-medium">{item.label}</span>
                      </div>
                      {item.badge && (
                        <span className={`${item.badgeColor} text-white text-xs px-2 py-1 rounded-full`}>
                          {item.badge}
                        </span>
                      )}
                    </Link>
                  )}
                </li>
              ))}
            </ul>
          </div>
        </nav>

        {/* Footer/Dark Mode Toggle */}
        <div className="p-4 border-t border-gray-200 dark:border-gray-700 flex-shrink-0">
          <div className="flex items-center justify-between">
            <div className="flex items-center space-x-2">
              <div className="w-8 h-8 rounded-full bg-gradient-to-r from-green-400 to-emerald-500 flex items-center justify-center">
                <span className="text-white font-bold text-sm">
                  {user?.username?.charAt(0).toUpperCase() || "U"}
                </span>
              </div>
              <div>
                <p className="text-sm font-medium text-gray-900 dark:text-white">
                  {user?.username || "User"}
                </p>
                <p className="text-xs text-gray-500 dark:text-gray-400">
                  {user?.has_active_subscription ? "Premium User" : "Free Account"}
                </p>
              </div>
            </div>
            
            <button
              onClick={toggleDarkMode}
              className="p-2 rounded-lg bg-gray-100 dark:bg-gray-700 hover:bg-gray-200 dark:hover:bg-gray-600 transition"
              aria-label={darkMode ? "Switch to light mode" : "Switch to dark mode"}
            >
              {darkMode ? (
                <svg className="w-5 h-5 text-yellow-500" fill="currentColor" viewBox="0 0 20 20">
                  <path fillRule="evenodd" d="M10 2a1 1 0 011 1v1a1 1 0 11-2 0V3a1 1 0 011-1zm4 8a4 4 0 11-8 0 4 4 0 018 0zm-.464 4.95l.707.707a1 1 0 001.414-1.414l-.707-.707a1 1 0 00-1.414 1.414zm2.12-10.607a1 1 0 010 1.414l-.706.707a1 1 0 11-1.414-1.414l.707-.707a1 1 0 011.414 0zM17 11a1 1 0 100-2h-1a1 1 0 100 2h1zm-7 4a1 1 0 011 1v1a1 1 0 11-2 0v-1a1 1 0 011-1zM5.05 6.464A1 1 0 106.465 5.05l-.708-.707a1 1 0 00-1.414 1.414l.707.707zm1.414 8.486l-.707.707a1 1 0 01-1.414-1.414l.707-.707a1 1 0 011.414 1.414zM4 11a1 1 0 100-2H3a1 1 0 000 2h1z" clipRule="evenodd" />
                </svg>
              ) : (
                <svg className="w-5 h-5 text-gray-700" fill="currentColor" viewBox="0 0 20 20">
                  <path d="M17.293 13.293A8 8 0 016.707 2.707a8.001 8.001 0 1010.586 10.586z" />
                </svg>
              )}
            </button>
          </div>
        </div>
      </aside>

      {/* Logout Confirmation Modal */}
      {showLogoutConfirm && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white dark:bg-gray-800 rounded-lg p-6 max-w-sm mx-4">
            <div className="flex items-center justify-center w-12 h-12 mx-auto mb-4 bg-red-100 dark:bg-red-900/30 rounded-full">
              <FaSignOutAlt className="w-6 h-6 text-red-600 dark:text-red-400" />
            </div>
            <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-2 text-center">
              Confirm Logout
            </h3>
            <p className="text-gray-600 dark:text-gray-300 mb-6 text-center">
              Are you sure you want to logout from your account?
            </p>
            <div className="flex justify-center space-x-3">
              <button
                onClick={cancelLogout}
                className="px-4 py-2 text-sm font-medium text-gray-700 dark:text-gray-300 bg-gray-100 dark:bg-gray-700 rounded-lg hover:bg-gray-200 dark:hover:bg-gray-600 transition-colors"
              >
                Cancel
              </button>
              <button
                onClick={confirmLogout}
                className="px-4 py-2 text-sm font-medium text-white bg-red-600 rounded-lg hover:bg-red-700 transition-colors"
              >
                Logout
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}