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

  const maxMiddlePages = isMobile ? 1 : 3;
  
  let start = Math.max(2, currentPage - Math.floor(maxMiddlePages / 2));
  let end = Math.min(totalPages - 1, start + maxMiddlePages - 1);

  if (end - start + 1 < maxMiddlePages) {
    start = Math.max(2, end - maxMiddlePages + 1);
  }

  const middlePages = [];
  for (let i = start; i <= end; i++) {
    middlePages.push(i);
  }

  const hasLeftEllipsis = start > 2;
  const hasRightEllipsis = end < totalPages - 1;

  const buttonBaseClasses = `
    flex items-center justify-center
    min-w-[2rem] sm:min-w-[2.5rem]
    h-8 sm:h-9
    text-sm font-medium
    rounded-lg
    transition-all duration-200
    border border-transparent
    focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2
  `;

  const pageButtonClasses = (isActive) => `
    ${buttonBaseClasses}
    ${isActive
      ? 'bg-blue-500 text-white shadow-sm hover:bg-blue-600 border-blue-500'
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
      <div className="flex items-center justify-center gap-1.5 sm:gap-2 max-w-full">
        {/* Previous button */}
        <button
          onClick={() => onPageChange(currentPage - 1)}
          disabled={currentPage === 1}
          className={arrowButtonClasses(currentPage === 1)}
          aria-label="Previous page"
        >
          <FaChevronLeft className="w-3.5 h-3.5" />
        </button>

        {/* First page */}
        <button
          onClick={() => onPageChange(1)}
          className={pageButtonClasses(currentPage === 1)}
          aria-label="Go to page 1"
        >
          1
        </button>

        {/* Left ellipsis */}
        {hasLeftEllipsis && (
          <span className="flex items-center justify-center min-w-[2rem] sm:min-w-[2.5rem] h-8 sm:h-9 text-gray-500 dark:text-gray-400 px-2">
            …
          </span>
        )}

        {/* Middle pages */}
        {middlePages.map((page) => (
          <button
            key={page}
            onClick={() => onPageChange(page)}
            className={pageButtonClasses(page === currentPage)}
            aria-label={`Go to page ${page}`}
          >
            {page}
          </button>
        ))}

        {/* Right ellipsis */}
        {hasRightEllipsis && (
          <span className="flex items-center justify-center min-w-[2rem] sm:min-w-[2.5rem] h-8 sm:h-9 text-gray-500 dark:text-gray-400 px-2">
            …
          </span>
        )}

        {/* Last page (if not page 1) */}
        {totalPages > 1 && (
          <button
            onClick={() => onPageChange(totalPages)}
            className={pageButtonClasses(currentPage === totalPages)}
            aria-label={`Go to page ${totalPages}`}
          >
            {totalPages}
          </button>
        )}

        {/* Next button */}
        <button
          onClick={() => onPageChange(currentPage + 1)}
          disabled={currentPage === totalPages}
          className={arrowButtonClasses(currentPage === totalPages)}
          aria-label="Next page"
        >
          <FaChevronRight className="w-3.5 h-3.5" />
        </button>
      </div>
    </div>
  );
};

export default Pagination;