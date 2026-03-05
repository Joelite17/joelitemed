there is my folder structure.
public
src
    >assets
    >components
    >pages
    -App.css
    -App.jsx
    -index.css
    -main.jsx
.gitignore
eslint.config.js
index.html
package-lock.json
package.json
page structure
postcss.config.js
README.md
tailwind.config.js
vite.config.js

this page should only be accessed if the user is authenticated. else direct to login(i am trying to use django as backend but wanted t finish frontend first.), after login he/she should be redirected to dashboard.

this is how the app.jsx look like:
import { useState, useEffect } from "react";
import { BrowserRouter as Router, Routes, Route } from "react-router-dom";
import Sidebar from "./components/Sidebar";
import Navbar from "./components/Navbar";
import Feeds from "./pages/Feeds";
import UserProfilePage from "./pages/UserProfile";
import MyProfilePage from "./pages/MyProfile";
import MyNotesPage from "./pages/MyNotes"; // renamed from NotePage
import NoteDetailPage from "./pages/NoteDetail"; // new page
import MCQDetailPage from "./pages/MCQDetail";
import FlashcardDetailPage from "./pages/FlashcardDetail";
import Dashboard from "./pages/Dashboard";
import CreateNotePage from "./pages/CreateNote";
import EditNotePage from "./pages/EditNote";
import CreateFlashcardPage from "./pages/CreateFlashcard";
import EditFlashcardPage from "./pages/EditFlashcard";
import MyMCQsPage from "./pages/MyMCQs";
import MyFlashcardPage from "./pages/MyFlashCard";
import CreateMCQPage from "./pages/CreateMCQ";
import EditMCQPage from "./pages/EditMCQ";
export default function App() {
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [darkMode, setDarkMode] = useState(false);

  // toggle dark mode on <html>
  useEffect(() => {
    document.documentElement.classList.toggle("dark", darkMode);
  }, [darkMode]);

  return (
    <Router>
      <div className="flex h-screen bg-gray-100 dark:bg-gray-900 text-gray-900 dark:text-gray-100 transition-colors duration-300">
        {/* Sidebar */}
        <Sidebar
          isOpen={sidebarOpen}
          setIsOpen={setSidebarOpen}
          darkMode={darkMode}
          setDarkMode={setDarkMode}
        />

        {/* Main Content */}
        <div className="flex-1 flex flex-col relative">
          <Navbar
            toggleSidebar={() => setSidebarOpen(!sidebarOpen)}
            darkMode={darkMode}
            setDarkMode={setDarkMode}
          />

          {/* Blur overlay when sidebar is open */}
          {sidebarOpen && (
            <div
              className="fixed inset-0 bg-black bg-opacity-30 backdrop-blur-sm z-20 lg:hidden"
              onClick={() => setSidebarOpen(false)}
            />
          )}

          {/* Page Content */}
          <main
            className={`p-4 overflow-y-auto transition-all duration-300 ${
              sidebarOpen
                ? "opacity-50 pointer-events-none lg:opacity-100 lg:pointer-events-auto"
                : "opacity-100"
            }`}
          >
            <Routes>
              <Route path="/" element={<Dashboard darkMode={darkMode} />} />
              <Route path="/feeds" element={<Feeds darkMode={darkMode} />} />
              <Route path="/profiles/:username" element={<UserProfilePage darkMode={darkMode} />} />
              <Route path="/profile" element={<MyProfilePage darkMode={darkMode} />} />

              {/* Notes */}
              <Route path="/notes" element={<MyNotesPage darkMode={darkMode} />} />
              <Route path="/notes/:id" element={<NoteDetailPage darkMode={darkMode} />} />
              <Route path="/notes/:id/edit" element={<EditNotePage />} />
              <Route path="/notes/create" element={<CreateNotePage />} />


              {/* MCQs */}
              <Route path="/mcqs" element={<MyMCQsPage />} />
              <Route path="/mcqs/:id" element={<MCQDetailPage />} />
              <Route path="/mcqs/create" element={<CreateMCQPage />} />
              <Route path="/mcqs/:id/edit" element={<EditMCQPage />} />


              {/* Flashcards */}
              <Route path="/flashcards/" element={<MyFlashcardPage />} />
              <Route path="/flashcards/:id" element={<FlashcardDetailPage />} />
              <Route path="/flashcards/create" element={<CreateFlashcardPage />} />
              <Route path="/flashcards/:id/edit" element={<EditFlashcardPage />} />
            </Routes>
          </main>
        </div>
      </div>
    </Router>
  );
}







