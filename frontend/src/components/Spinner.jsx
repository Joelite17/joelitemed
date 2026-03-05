// frontend/src/components/Spinner.jsx
import React from 'react';

const Spinner = ({ 
  size = 48, 
  color = 'green-600', 
  text = null, 
  fullScreen = false,
  fullContainer = false, // New prop
  className = '',
  inline = false
}) => {
  // If fullContainer (spinner fills its container)
  if (fullContainer) {
    return (
      <div className="flex flex-col items-center justify-center w-full h-full">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-green-600 mx-auto"></div>
          {text && (
            <p className="mt-4 text-gray-600 dark:text-gray-300">{text}</p>
          )}
        </div>
      </div>
    );
  }

  // If fullScreen (original full-screen spinner)
  if (fullScreen) {
    return (
      <div className="flex flex-col items-center justify-center w-full min-h-[400px] bg-gray-100 dark:bg-gray-900">
        <div className="text-center -mt-8">
          <div className="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-green-600 mx-auto"></div>
          {text && (
            <p className="mt-4 text-gray-600 dark:text-gray-300">{text}</p>
          )}
        </div>
      </div>
    );
  }

  // Inline spinner (default)
  const spinner = (
    <div className={`${inline ? 'inline-flex' : 'flex flex-col'} items-center justify-center ${className}`}>
      <div className="relative">
        <div className={`animate-spin rounded-full border-2 border-t-transparent border-${color}`}
             style={{ width: `${size}px`, height: `${size}px` }}>
        </div>
        {size > 40 && (
          <div className="absolute inset-0 flex items-center justify-center">
            <div className={`animate-ping w-1/2 h-1/2 rounded-full bg-${color} opacity-20`}></div>
          </div>
        )}
      </div>
      {text && (
        <p className="mt-4 text-sm text-gray-600 dark:text-gray-300 font-medium">
          {text}
        </p>
      )}
    </div>
  );

  return spinner;
};

export default Spinner;