import React, { useState, useEffect } from 'react';
import { FaChevronLeft, FaChevronRight } from 'react-icons/fa';

const Pagination = ({ currentPage, totalPages, onPageChange }) => {
  const [isMobile, setIsMobile] = useState(false);

  useEffect(() => {
    const checkMobile = () => setIsMobile(window.innerWidth < 640);
    checkMobile();
    window.addEventListener('resize', checkMobile);
    return () => window.removeEventListener('resize', checkMobile);
  }, []);

  if (totalPages <= 1) return null;

  const pageNumbers = Array.from({ length: totalPages }, (_, i) => i + 1);

  const buttonBaseClasses = `
    flex items-center justify-center
    min-w-[2.5rem] sm:min-w-[3rem]
    h-10 sm:h-12
    text-sm sm:text-base font-medium
    rounded-lg
    transition-all duration-200
    border border-transparent
    focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2
    px-2
    flex-shrink-0
  `;

  const pageButtonClasses = (isActive) => `
    ${buttonBaseClasses}
    ${isActive
      ? 'bg-blue-500 text-white shadow-md hover:bg-blue-600 border-blue-500'
      : 'bg-white dark:bg-gray-800 text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-700 border-gray-300 dark:border-gray-600'
    }
  `;

  const arrowButtonClasses = (isDisabled) => `
    ${buttonBaseClasses}
    ${isDisabled
      ? 'text-gray-400 dark:text-gray-600 cursor-not-allowed'
      : 'text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700 hover:border-gray-400 dark:hover:border-gray-500'
    }
  `;

  return (
    <div className="w-full px-2 py-4">
      <div className="flex items-center gap-1 sm:gap-2 max-w-full">
        {/* Previous button – fixed */}
        <button
          onClick={() => onPageChange(currentPage - 1)}
          disabled={currentPage === 1}
          className={arrowButtonClasses(currentPage === 1)}
          aria-label="Previous page"
        >
          <FaChevronLeft className="w-4 h-4" />
        </button>

        {/* Scrollable page numbers – with visible scrollbar */}
        <div className="flex-1 overflow-x-auto py-1">
          <div className="flex gap-1 sm:gap-2 whitespace-nowrap min-w-max">
            {pageNumbers.map((page) => {
              const isActive = page === currentPage;
              return (
                <button
                  key={page}
                  onClick={() => onPageChange(page)}
                  className={pageButtonClasses(isActive)}
                  aria-label={`Go to page ${page}`}
                  aria-current={isActive ? 'page' : undefined}
                >
                  {page}
                </button>
              );
            })}
          </div>
        </div>

        {/* Next button – fixed */}
        <button
          onClick={() => onPageChange(currentPage + 1)}
          disabled={currentPage === totalPages}
          className={arrowButtonClasses(currentPage === totalPages)}
          aria-label="Next page"
        >
          <FaChevronRight className="w-4 h-4" />
        </button>
      </div>
    </div>
  );
};

export default Pagination;