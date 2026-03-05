// components/FilterTabs.jsx
import React from 'react';

const FilterTabs = ({ activeTab, setActiveTab }) => {
  const tabs = [
    { id: 'all', label: 'All' },
    { id: 'flashcard', label: 'Flashcards' },
    { id: 'mcq', label: 'MCQs' },
    { id: 'osce', label: 'OSCE' },
    { id: 'note', label: 'Notes' }
  ];

  return (
    <div className="relative">
      {/* Horizontal scroll container */}
      <div className="flex overflow-x-auto pb-2 -mb-2 scrollbar-hide space-x-2 border-b border-gray-200 dark:border-gray-700">
        {tabs.map((tab) => (
          <button
            key={tab.id}
            onClick={() => setActiveTab(tab.id)}
            className={`px-4 py-2 text-sm font-medium transition-colors whitespace-nowrap flex-shrink-0 ${
              activeTab === tab.id
                ? 'text-green-600 border-b-2 border-green-600'
                : 'text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-300'
            }`}
          >
            {tab.label}
          </button>
        ))}
      </div>
      
      {/* Optional: Fade effect at edges to indicate scrollability */}
      <div className="absolute top-0 left-0 w-6 h-full bg-gradient-to-r from-white dark:from-gray-900 to-transparent pointer-events-none"></div>
      <div className="absolute top-0 right-0 w-6 h-full bg-gradient-to-l from-white dark:from-gray-900 to-transparent pointer-events-none"></div>
    </div>
  );
};

// Add custom scrollbar hiding CSS if not already in your project
// Add this to your global CSS file or component:
// .scrollbar-hide {
//   -ms-overflow-style: none;  /* IE and Edge */
//   scrollbar-width: none;      /* Firefox */
// }
// .scrollbar-hide::-webkit-scrollbar {
//   display: none; /* Chrome, Safari and Opera */
// }

export default FilterTabs;