// components/DataTable.jsx
import { useState, useEffect } from "react";
import Pagination from "./Pagination";
import Spinner from "./Spinner";
const DataTable = ({
  data,
  columns,
  pageSize = 10,
  onPageChange,
  currentPage: externalPage,
  totalItems,
  loading = false,
  className = "",
  showPagination = true,
  onRowClick,
}) => {
  const [internalPage, setInternalPage] = useState(1);
  const [isDark, setIsDark] = useState(false);

  const currentPage = externalPage || internalPage;
  const totalPages = Math.ceil(totalItems / pageSize) || 1;

  // Monitor dark mode changes
  useEffect(() => {
    const htmlElement = document.documentElement;
    
    // Set initial value
    setIsDark(htmlElement.classList.contains("dark"));
    
    // Create observer to watch for class changes
    const observer = new MutationObserver(() => {
      setIsDark(htmlElement.classList.contains("dark"));
    });
    
    observer.observe(htmlElement, { 
      attributes: true, 
      attributeFilter: ['class'] 
    });
    
    return () => observer.disconnect();
  }, []);

  const handlePageChange = (page) => {
    if (page < 1 || page > totalPages) return;
    
    if (onPageChange) {
      onPageChange(page);
    } else {
      setInternalPage(page);
    }
  };

  if (loading) {
    return <Spinner fullScreen/>;
  }

  if (!data || data.length === 0) {
    return (
      <div className="text-center py-8">
        <div className="text-gray-400 mb-4">
          <svg className="w-12 h-12 mx-auto" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1} d="M9.172 16.172a4 4 0 015.656 0M9 10h.01M15 10h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
          </svg>
        </div>
        <p className="text-gray-600 dark:text-gray-400">
          No data available.
        </p>
      </div>
    );
  }

  return (
    <div className={`${className}`}>
      {/* Table */}
      <div className="overflow-x-auto">
        <table className="min-w-full divide-y divide-gray-200 dark:divide-gray-700">
          <thead>
            <tr>
              {columns.map((column) => (
                <th
                  key={column.key}
                  className={`px-3 py-2 md:px-4 md:py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider ${column.className || ''}`}
                  style={{ minWidth: column.minWidth }}
                >
                  {column.header}
                </th>
              ))}
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-200 dark:divide-gray-700">
            {data.map((row, rowIndex) => (
              <tr 
                key={row.id || rowIndex}
                className={onRowClick ? "cursor-pointer hover:bg-gray-50 dark:hover:bg-gray-800" : ""}
                onClick={() => onRowClick && onRowClick(row)}
              >
                {columns.map((column) => (
                  <td
                    key={`${column.key}-${rowIndex}`}
                    className={`px-3 py-2 md:px-4 md:py-3 whitespace-nowrap text-xs md:text-sm ${column.cellClassName || ''}`}
                  >
                    {column.render 
                      ? column.render(row[column.key], row)
                      : row[column.key]}
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* Pagination */}
      {showPagination && totalPages > 1 && (
        <div className="mt-6 md:mt-8 flex justify-center">
          <Pagination
            currentPage={currentPage}
            totalPages={totalPages}
            onPageChange={handlePageChange}
            isDark={isDark}
          />
        </div>
      )}
    </div>
  );
};

export default DataTable;