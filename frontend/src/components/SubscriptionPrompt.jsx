import { useNavigate } from "react-router-dom";

export default function SubscriptionPrompt({ isOpen, onClose }) {
  const navigate = useNavigate();

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black bg-opacity-70 flex items-center justify-center z-50">
      <div className="bg-white dark:bg-gray-800 p-8 rounded-lg text-center max-w-md">
        <svg className="w-16 h-16 mx-auto text-gray-400 mb-4" fill="currentColor" viewBox="0 0 20 20">
          <path fillRule="evenodd" d="M5 9V7a5 5 0 0110 0v2a2 2 0 012 2v5a2 2 0 01-2 2H5a2 2 0 01-2-2v-5a2 2 0 012-2zm8-2v2H7V7a3 3 0 016 0z" clipRule="evenodd" />
        </svg>
        <h2 className="text-2xl font-bold mb-2">Free Trial Expired</h2>
        <p className="text-gray-600 dark:text-gray-300 mb-6">
          You've used your 20 minutes of free access today. Please wait 24 hours for your trial to reset, or subscribe now for unlimited access.
        </p>
        <button
          onClick={() => navigate('/subscription')}
          className="px-6 py-3 bg-green-600 hover:bg-green-700 text-white font-semibold rounded-lg"
        >
          View Subscription Plans
        </button>
        <button
          onClick={onClose}
          className="mt-4 text-sm text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-300"
        >
          Maybe Later
        </button>
      </div>
    </div>
  );
}