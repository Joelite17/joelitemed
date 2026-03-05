import { useContext, useState } from "react";
import { AccountsContext } from "../../context/AccountsContext";
import { useNotification, NOTIFICATION_TYPES } from "../../context/NotificationContext";
import { Link, useNavigate, useLocation } from "react-router-dom";
import Spinner from "../../components/Spinner";

export default function Login() {
  const [formData, setFormData] = useState({ identifier: "", password: "" });
  const [loading, setLoading] = useState(false);
  const { login } = useContext(AccountsContext);
  const { addNotification } = useNotification();
  const navigate = useNavigate();
  const location = useLocation();

  const handleLogin = async (e) => {
    e.preventDefault();
    
    // Basic validation
    if (!formData.identifier.trim() || !formData.password.trim()) {
      addNotification({
        message: "Please enter both email/username and password",
        type: NOTIFICATION_TYPES.ERROR
      });
      return;
    }
    
    setLoading(true);
    try {
      await login(formData.identifier, formData.password);
      
      // Show success notification
      addNotification({
        message: "Successfully logged in!",
        type: NOTIFICATION_TYPES.SUCCESS
      });
      
      // Check if there's a redirect path in location state
      const from = location.state?.from || "/";
      navigate(from, { replace: true });
      
    } catch (err) {
      // Show error notification
      addNotification({
        message: err.message || "Login failed. Please check your credentials.",
        type: NOTIFICATION_TYPES.ERROR
      });
      
      // Clear password field on error
      setFormData(prev => ({ ...prev, password: "" }));
    } finally {
      setLoading(false);
    }
  };

  const handleChange = (e) =>
    setFormData((s) => ({ ...s, [e.target.name]: e.target.value }));

  if (loading) {
    return (
      <div className="relative min-h-screen flex items-center justify-center">
        <div
          aria-hidden
          className="fixed inset-0 bg-center bg-cover"
          style={{ backgroundImage: `url('/login-hero-bg.jpg')` }}
        />
        <div className="fixed inset-0 bg-black/50" aria-hidden />
        <Spinner fullScreen={true} transparent={true} text="Logging in..." />
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
          <h2 className="text-3xl font-semibold text-center mb-8">Login</h2>
          
          <form onSubmit={handleLogin} className="space-y-5">
            <div className="relative border-b border-white/40 pb-3">
              <input
                name="identifier"
                type="text"
                value={formData.identifier}
                onChange={handleChange}
                placeholder=" "
                required
                className="peer w-full bg-transparent border-none outline-none text-white text-base pt-5 pb-2 placeholder-transparent"
                autoComplete="username"
                disabled={loading}
              />
              <label className="absolute left-0 text-gray-200 transition-all pointer-events-none
                peer-placeholder-shown:top-1/2 peer-placeholder-shown:-translate-y-1/2 peer-placeholder-shown:text-base
                peer-focus:top-0 peer-focus:-translate-y-3 peer-focus:text-sm peer-focus:text-white
                top-0 -translate-y-3 text-sm">
                Email or Username
              </label>
            </div>

            <div className="relative border-b border-white/40 pb-3">
              <input
                name="password"
                type="password"
                value={formData.password}
                onChange={handleChange}
                placeholder=" "
                required
                className="peer w-full bg-transparent border-none outline-none text-white text-base pt-5 pb-2 placeholder-transparent"
                autoComplete="current-password"
                disabled={loading}
              />
              <label className="absolute left-0 text-gray-200 transition-all pointer-events-none
                peer-placeholder-shown:top-1/2 peer-placeholder-shown:-translate-y-1/2 peer-placeholder-shown:text-base
                peer-focus:top-0 peer-focus:-translate-y-3 peer-focus:text-sm peer-focus:text-white
                top-0 -translate-y-3 text-sm">
                Password
              </label>
            </div>

            <div className="flex items-center justify-between text-sm mt-2">
              <label className="flex items-center">
                <input
                  type="checkbox"
                  className="rounded border-gray-300 text-green-600 focus:ring-green-500"
                  defaultChecked
                />
                <span className="ml-2 text-gray-300">Remember me</span>
              </label>
              <Link to="/forgot-password" className="text-white hover:underline hover:text-gray-200">
                Forgot password?
              </Link>
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
                  Logging in...
                </span>
              ) : "Log In"}
            </button>

            <div className="text-center mt-4 text-sm text-gray-200">
              Don't have an account?{" "}
              <Link to="/signup" className="text-white font-semibold hover:underline hover:text-gray-200">
                Sign up
              </Link>
            </div>
          </form>
        </div>
      </div>
    </div>
  );
}