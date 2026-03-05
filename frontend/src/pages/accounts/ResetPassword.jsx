import { useState, useEffect } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { AccountsAPI } from "../../apis/accounts";
import { useNotification, NOTIFICATION_TYPES } from "../../context/NotificationContext";
import Spinner from "../../components/Spinner";

export default function ResetPassword() {
  const [formData, setFormData] = useState({ password1: "", password2: "" });
  const [loading, setLoading] = useState(false);
  const [validating, setValidating] = useState(true);
  const [isValidToken, setIsValidToken] = useState(true);
  const [passwordStrength, setPasswordStrength] = useState(0);
  const [passwordCriteria, setPasswordCriteria] = useState({
    length: false,
    uppercase: false,
    lowercase: false,
    number: false,
    special: false,
  });
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const { addNotification } = useNotification();

  const uid = searchParams.get("uid");
  const token = searchParams.get("token");

  // Validate token on component mount
  useEffect(() => {
    if (!uid || !token) {
      setIsValidToken(false);
      setValidating(false);
      addNotification({
        message: "Invalid or missing reset token",
        type: NOTIFICATION_TYPES.ERROR
      });
    } else {
      setValidating(false);
    }
  }, [uid, token, addNotification]);

  // Check password strength
  useEffect(() => {
    const password = formData.password1;
    
    const criteria = {
      length: password.length >= 8,
      uppercase: /[A-Z]/.test(password),
      lowercase: /[a-z]/.test(password),
      number: /\d/.test(password),
      special: /[!@#$%^&*(),.?":{}|<>]/.test(password),
    };
    
    setPasswordCriteria(criteria);
    
    // Calculate strength (0-100)
    const metCriteria = Object.values(criteria).filter(Boolean).length;
    const strength = (metCriteria / 5) * 100;
    setPasswordStrength(strength);
  }, [formData.password1]);

  const handleChange = (e) =>
    setFormData((s) => ({ ...s, [e.target.name]: e.target.value }));

  const getPasswordStrengthColor = () => {
    if (passwordStrength < 40) return "bg-red-500";
    if (passwordStrength < 70) return "bg-yellow-500";
    return "bg-green-500";
  };

  const getPasswordStrengthText = () => {
    if (passwordStrength < 40) return "Weak";
    if (passwordStrength < 70) return "Fair";
    return "Strong";
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    
    // Client-side validation
    if (formData.password1 !== formData.password2) {
      addNotification({
        message: "Passwords do not match",
        type: NOTIFICATION_TYPES.ERROR
      });
      return;
    }
    
    if (formData.password1.length < 8) {
      addNotification({
        message: "Password must be at least 8 characters long",
        type: NOTIFICATION_TYPES.ERROR
      });
      return;
    }

    if (passwordStrength < 40) {
      addNotification({
        message: "Please choose a stronger password",
        type: NOTIFICATION_TYPES.WARNING
      });
      return;
    }

    setLoading(true);
    try {
      await AccountsAPI.resetPassword(uid, token, {
        password: formData.password1,
        password2: formData.password2
      });
      
      addNotification({
        message: "Password has been reset successfully! Redirecting to login...",
        type: NOTIFICATION_TYPES.SUCCESS,
        duration: 3000
      });
      
      // Redirect after 3 seconds
      setTimeout(() => {
        navigate("/login");
      }, 3000);
    } catch (err) {
      addNotification({
        message: err.message || "Failed to reset password. The link may have expired.",
        type: NOTIFICATION_TYPES.ERROR
      });
      
      // Clear password fields on error
      setFormData({ password1: "", password2: "" });
    } finally {
      setLoading(false);
    }
  };

  if (validating) {
    return (
      <div className="relative min-h-screen flex items-center justify-center">
        <div
          aria-hidden
          className="fixed inset-0 bg-center bg-cover"
          style={{ backgroundImage: `url('/login-hero-bg.jpg')` }}
        />
        <div className="fixed inset-0 bg-black/50" aria-hidden />
        <Spinner fullScreen={true} transparent={true} text="Validating reset link..." />
      </div>
    );
  }

  if (!isValidToken) {
    return (
      <div className="relative min-h-screen flex items-center justify-center">
        <div
          aria-hidden
          className="fixed inset-0 bg-center bg-cover"
          style={{ backgroundImage: `url('/login-hero-bg.jpg')` }}
        />
        <div className="fixed inset-0 bg-black/50" aria-hidden />

        <div className="relative w-full max-w-md mx-4 py-16">
          <div className="bg-white/10 border border-white/20 rounded-2xl shadow-2xl p-8 text-white text-center">
            <div className="w-16 h-16 bg-red-500/20 rounded-full flex items-center justify-center mx-auto mb-6">
              <svg className="w-8 h-8 text-red-400" fill="currentColor" viewBox="0 0 20 20">
                <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zM8.707 7.293a1 1 0 00-1.414 1.414L8.586 10l-1.293 1.293a1 1 0 101.414 1.414L10 11.414l1.293 1.293a1 1 0 001.414-1.414L11.414 10l1.293-1.293a1 1 0 00-1.414-1.414L10 8.586 8.707 7.293z" clipRule="evenodd" />
              </svg>
            </div>
            <h2 className="text-2xl font-semibold mb-4">Invalid Reset Link</h2>
            <p className="text-gray-300 mb-6">
              This password reset link is invalid or has expired. Please request a new reset link.
            </p>
            <div className="space-y-4">
              <button
                onClick={() => navigate("/forgot-password")}
                className="w-full border border-white text-white py-3 rounded-md font-medium bg-transparent hover:bg-white hover:text-gray-900 transition duration-300"
              >
                Request New Reset Link
              </button>
              <button
                onClick={() => navigate("/login")}
                className="w-full border border-gray-400 text-gray-300 py-3 rounded-md font-medium hover:bg-gray-800 transition duration-300"
              >
                Back to Login
              </button>
            </div>
          </div>
        </div>
      </div>
    );
  }

  if (loading) {
    return (
      <div className="relative min-h-screen flex items-center justify-center">
        <div
          aria-hidden
          className="fixed inset-0 bg-center bg-cover"
          style={{ backgroundImage: `url('/login-hero-bg.jpg')` }}
        />
        <div className="fixed inset-0 bg-black/50" aria-hidden />
        <Spinner fullScreen={true} transparent={true} text="Resetting password..." />
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
          <h2 className="text-3xl font-semibold text-center mb-8">Reset Password</h2>

          <form onSubmit={handleSubmit} className="space-y-5">
            <div className="space-y-2">
              <div className="relative border-b border-white/40 pb-3">
                <input
                  name="password1"
                  type="password"
                  value={formData.password1}
                  onChange={handleChange}
                  placeholder=" "
                  required
                  className="peer w-full bg-transparent border-none outline-none text-white text-base pt-5 pb-2 placeholder-transparent"
                  autoComplete="new-password"
                  disabled={loading}
                />
                <label
                  className="absolute left-0 text-gray-200 transition-all pointer-events-none
                    peer-placeholder-shown:top-1/2 peer-placeholder-shown:-translate-y-1/2 peer-placeholder-shown:text-base
                    peer-focus:top-0 peer-focus:-translate-y-3 peer-focus:text-sm peer-focus:text-white
                    top-0 -translate-y-3 text-sm"
                >
                  New Password
                </label>
              </div>
              
              {/* Password Strength Meter */}
              {formData.password1 && (
                <div className="space-y-2">
                  <div className="flex justify-between text-xs">
                    <span>Password Strength:</span>
                    <span className={`font-semibold ${
                      passwordStrength < 40 ? 'text-red-400' :
                      passwordStrength < 70 ? 'text-yellow-400' : 'text-green-400'
                    }`}>
                      {getPasswordStrengthText()}
                    </span>
                  </div>
                  <div className="w-full bg-gray-700 rounded-full h-2">
                    <div 
                      className={`h-2 rounded-full transition-all duration-300 ${getPasswordStrengthColor()}`}
                      style={{ width: `${passwordStrength}%` }}
                    ></div>
                  </div>
                </div>
              )}
            </div>

            <div className="relative border-b border-white/40 pb-3">
              <input
                name="password2"
                type="password"
                value={formData.password2}
                onChange={handleChange}
                placeholder=" "
                required
                className="peer w-full bg-transparent border-none outline-none text-white text-base pt-5 pb-2 placeholder-transparent"
                autoComplete="new-password"
                disabled={loading}
              />
              <label
                className="absolute left-0 text-gray-200 transition-all pointer-events-none
                  peer-placeholder-shown:top-1/2 peer-placeholder-shown:-translate-y-1/2 peer-placeholder-shown:text-base
                  peer-focus:top-0 peer-focus:-translate-y-3 peer-focus:text-sm peer-focus:text-white
                  top-0 -translate-y-3 text-sm"
              >
                Confirm New Password
              </label>
            </div>

            {/* Password Criteria */}
            <div className="text-xs text-gray-300 space-y-1">
              <p className="font-semibold mb-2">Password must contain:</p>
              <div className="grid grid-cols-2 gap-1">
                <div className={`flex items-center ${passwordCriteria.length ? 'text-green-400' : 'text-gray-400'}`}>
                  <svg className={`w-3 h-3 mr-1 ${passwordCriteria.length ? 'text-green-400' : 'text-gray-500'}`} fill="currentColor" viewBox="0 0 20 20">
                    {passwordCriteria.length ? (
                      <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" />
                    ) : (
                      <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zM7 9a1 1 0 000 2h6a1 1 0 100-2H7z" clipRule="evenodd" />
                    )}
                  </svg>
                  8+ characters
                </div>
                <div className={`flex items-center ${passwordCriteria.uppercase ? 'text-green-400' : 'text-gray-400'}`}>
                  <svg className={`w-3 h-3 mr-1 ${passwordCriteria.uppercase ? 'text-green-400' : 'text-gray-500'}`} fill="currentColor" viewBox="0 0 20 20">
                    {passwordCriteria.uppercase ? (
                      <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" />
                    ) : (
                      <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zM7 9a1 1 0 000 2h6a1 1 0 100-2H7z" clipRule="evenodd" />
                    )}
                  </svg>
                  Uppercase letter
                </div>
                <div className={`flex items-center ${passwordCriteria.lowercase ? 'text-green-400' : 'text-gray-400'}`}>
                  <svg className={`w-3 h-3 mr-1 ${passwordCriteria.lowercase ? 'text-green-400' : 'text-gray-500'}`} fill="currentColor" viewBox="0 0 20 20">
                    {passwordCriteria.lowercase ? (
                      <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" />
                    ) : (
                      <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zM7 9a1 1 0 000 2h6a1 1 0 100-2H7z" clipRule="evenodd" />
                    )}
                  </svg>
                  Lowercase letter
                </div>
                <div className={`flex items-center ${passwordCriteria.number ? 'text-green-400' : 'text-gray-400'}`}>
                  <svg className={`w-3 h-3 mr-1 ${passwordCriteria.number ? 'text-green-400' : 'text-gray-500'}`} fill="currentColor" viewBox="0 0 20 20">
                    {passwordCriteria.number ? (
                      <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" />
                    ) : (
                      <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zM7 9a1 1 0 000 2h6a1 1 0 100-2H7z" clipRule="evenodd" />
                    )}
                  </svg>
                  Number
                </div>
              </div>
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
                  Resetting Password...
                </span>
              ) : "Reset Password"}
            </button>
          </form>
        </div>
      </div>
    </div>
  );
}