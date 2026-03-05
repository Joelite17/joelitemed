import { useState } from "react";
import { Link } from "react-router-dom";
import { AccountsAPI } from "../../apis/accounts";
import { useNotification, NOTIFICATION_TYPES } from "../../context/NotificationContext";
import Spinner from "../../components/Spinner";

export default function ForgotPassword() {
  const [email, setEmail] = useState("");
  const [loading, setLoading] = useState(false);
  const [submitted, setSubmitted] = useState(false);
  const { addNotification } = useNotification();

  const handleSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);

    // Email validation
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(email)) {
      addNotification({
        message: "Please enter a valid email address",
        type: NOTIFICATION_TYPES.ERROR
      });
      setLoading(false);
      return;
    }

    try {
      await AccountsAPI.forgotPassword(email);
      
      // Show success message without revealing if email exists
      addNotification({
        message: "If this email is registered, you will receive a password reset link shortly.",
        type: NOTIFICATION_TYPES.SUCCESS,
        duration: 10000
      });
      
      setSubmitted(true);
      setEmail(""); // Clear the email field
    } catch (err) {
      // Show generic message (don't reveal if email exists or not)
      addNotification({
        message: "If this email is registered, you will receive a password reset link shortly.",
        type: NOTIFICATION_TYPES.INFO,
        duration: 8000
      });
      setSubmitted(true);
      setEmail(""); // Still clear the field for security
    } finally {
      setLoading(false);
    }
  };

  if (loading) {
    return (
      <div className="relative min-h-screen flex items-center justify-center">
        <div
          aria-hidden
          className="fixed inset-0 bg-center bg-cover"
          style={{ backgroundImage: `url('/login-hero-bg.jpg')` }}
        />
        <div className="fixed inset-0 bg-black/50" aria-hidden />
        <Spinner fullScreen={true} transparent={true} text="Sending reset link..." />
      </div>
    );
  }

  return (
    <div className="relative min-h-screen flex items-center justify-center">
      <div
        aria-hidden
        className="fixed inset-0 bg-center bg-cover"
        style={{ backgroundImage: `url('/login-hero-bg.jpg')` }}
      />
      <div className="fixed inset-0 bg-black/50" aria-hidden />

      <div className="relative w-full max-w-md mx-4 py-16">
        <div className="bg-white/10 border border-white/20 rounded-2xl shadow-2xl p-8 text-white">
          {submitted ? (
            <div className="text-center">
              <div className="w-16 h-16 bg-green-500/20 rounded-full flex items-center justify-center mx-auto mb-6">
                <svg className="w-8 h-8 text-green-400" fill="currentColor" viewBox="0 0 20 20">
                  <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" />
                </svg>
              </div>
              <h2 className="text-2xl font-semibold mb-4">Check Your Email</h2>
              <p className="text-gray-300 mb-6">
                If the email address <span className="font-semibold">{email || "you entered"}</span> is associated with an account, you will receive a password reset link shortly.
              </p>
              <div className="space-y-4">
                <p className="text-sm text-gray-400">
                  <span className="font-semibold">Note:</span> The email may take a few minutes to arrive. Please check your spam folder if you don't see it.
                </p>
                <div className="flex gap-4">
                  <button
                    onClick={() => setSubmitted(false)}
                    className="flex-1 border border-white text-white py-2 rounded-md font-medium bg-transparent hover:bg-white hover:text-gray-900 transition duration-300"
                  >
                    Request Another Link
                  </button>
                  <Link
                    to="/login"
                    className="flex-1 border border-white text-white py-2 rounded-md font-medium bg-transparent hover:bg-white hover:text-gray-900 transition duration-300 text-center"
                  >
                    Back to Login
                  </Link>
                </div>
              </div>
            </div>
          ) : (
            <>
              <h2 className="text-3xl font-semibold text-center mb-8">Forgot Password</h2>

              <p className="text-sm text-gray-300 mb-6 text-center">
                Enter your email address and we'll send you a link to reset your password.
              </p>

              <form onSubmit={handleSubmit} className="space-y-6">
                <div className="relative border-b border-white/40 pb-3">
                  <input
                    type="email"
                    name="email"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    placeholder=" "
                    required
                    className="peer w-full bg-transparent border-none outline-none text-white text-base pt-5 pb-2 placeholder-transparent"
                    autoComplete="email"
                    disabled={loading}
                  />
                  <label
                    className="absolute left-0 text-gray-200 transition-all pointer-events-none
                    peer-placeholder-shown:top-1/2 peer-placeholder-shown:-translate-y-1/2 peer-placeholder-shown:text-base
                    peer-focus:top-0 peer-focus:-translate-y-3 peer-focus:text-sm peer-focus:text-white
                    top-0 -translate-y-3 text-sm"
                  >
                    Email Address
                  </label>
                </div>

                <button
                  type="submit"
                  disabled={loading}
                  className="mt-6 w-full border border-white text-white py-3 rounded-md font-medium bg-transparent hover:bg-white hover:text-gray-900 transition duration-300 disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  {loading ? (
                    <span className="flex items-center justify-center">
                      <svg className="animate-spin -ml-1 mr-3 h-5 w-5 text-white" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                        <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                        <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                      </svg>
                      Sending...
                    </span>
                  ) : "Send Reset Link"}
                </button>

                <div className="text-center mt-4 text-sm text-gray-200">
                  <Link to="/login" className="text-white font-semibold hover:underline">
                    ← Back to Login
                  </Link>
                </div>
              </form>
            </>
          )}
        </div>
      </div>
    </div>
  );
}