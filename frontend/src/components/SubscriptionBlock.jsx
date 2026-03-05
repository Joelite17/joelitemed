import { useNavigate } from "react-router-dom";

export default function SubscriptionBlock({ message }) {
  const navigate = useNavigate();
  return (
    <div className="bg-white dark:bg-gray-800 shadow-md rounded-lg p-8 text-center">
      <svg className="w-20 h-20 mx-auto text-gray-400 mb-4" fill="currentColor" viewBox="0 0 20 20">
        <path fillRule="evenodd" d="M5 9V7a5 5 0 0110 0v2a2 2 0 012 2v5a2 2 0 01-2 2H5a2 2 0 01-2-2v-5a2 2 0 012-2zm8-2v2H7V7a3 3 0 016 0z" clipRule="evenodd" />
      </svg>
      <h2 className="text-2xl font-bold mb-2">Free Trial Expired</h2>
      <p className="text-gray-600 dark:text-gray-300 mb-6">
        {message || "You've used your 20 minutes of free access today. Please wait 24 hours for your trial to reset, or subscribe now for unlimited access."}
      </p>
      <button
        onClick={() => navigate('/subscription')}
        className="px-6 py-3 bg-green-600 hover:bg-green-700 text-white font-semibold rounded-lg"
      >
        View Subscription Plans
      </button>
    </div>
  );
}