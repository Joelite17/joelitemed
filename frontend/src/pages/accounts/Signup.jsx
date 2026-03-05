import { useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { AccountsAPI } from "../../apis/accounts";
import { useNotification, NOTIFICATION_TYPES } from "../../context/NotificationContext";
import Spinner from "../../components/Spinner";

export default function Signup() {
  const [formData, setFormData] = useState({
    username: "",
    first_name: "",
    last_name: "",
    email: "",
    password1: "",
    password2: "",
  });
  
  const [loading, setLoading] = useState(false);
  const [errors, setErrors] = useState({});
  const navigate = useNavigate();
  const { addNotification } = useNotification();

  const handleChange = (e) => {
    const { name, value } = e.target;
    setFormData((s) => ({ ...s, [name]: value }));
    // Clear error for this field when user starts typing
    if (errors[name]) {
      setErrors(prev => ({ ...prev, [name]: null }));
    }
  };

  const validateForm = () => {
    const newErrors = {};
    
    // Username validation
    if (!formData.username.trim()) {
      newErrors.username = "Username is required";
    } else if (formData.username.length < 3) {
      newErrors.username = "Username must be at least 3 characters";
    }
    
    // Email validation
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!formData.email.trim()) {
      newErrors.email = "Email is required";
    } else if (!emailRegex.test(formData.email)) {
      newErrors.email = "Please enter a valid email address";
    }
    
    // Password validation
    if (!formData.password1) {
      newErrors.password1 = "Password is required";
    } else if (formData.password1.length < 8) {
      newErrors.password1 = "Password must be at least 8 characters";
    }
    
    if (formData.password1 !== formData.password2) {
      newErrors.password2 = "Passwords do not match";
    }
    
    // First name validation
    if (!formData.first_name.trim()) {
      newErrors.first_name = "First name is required";
    }
    
    // Last name validation
    if (!formData.last_name.trim()) {
      newErrors.last_name = "Last name is required";
    }
    
    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleSignup = async (e) => {
    e.preventDefault();
    
    if (!validateForm()) {
      addNotification({
        message: "Please fix the errors in the form",
        type: NOTIFICATION_TYPES.ERROR
      });
      return;
    }
    
    setLoading(true);
    setErrors({});
    
    try {
      await AccountsAPI.register(formData);
      
      addNotification({
        message: "Account created successfully! Please log in.",
        type: NOTIFICATION_TYPES.SUCCESS,
        duration: 8000
      });
      
      // Clear form
      setFormData({
        username: "",
        first_name: "",
        last_name: "",
        email: "",
        password1: "",
        password2: "",
      });
      
      // Redirect to login page after 1 second
      setTimeout(() => {
        navigate("/login");
      }, 1000);
      
    } catch (err) {
      // Handle specific error messages from backend
      let errorMessage = err.message || "Registration failed. Please try again.";
      
      // Parse Django error response if it's JSON
      try {
        const errorData = JSON.parse(err.message);
        if (typeof errorData === 'object') {
          // Handle field errors
          const fieldErrors = {};
          Object.entries(errorData).forEach(([field, messages]) => {
            if (Array.isArray(messages)) {
              fieldErrors[field] = messages[0];
            } else {
              fieldErrors[field] = messages;
            }
          });
          setErrors(fieldErrors);
          
          // Show first error in notification
          const firstError = Object.values(fieldErrors)[0];
          if (firstError) {
            addNotification({
              message: firstError,
              type: NOTIFICATION_TYPES.ERROR
            });
          }
          return;
        }
      } catch (parseError) {
        // Not JSON, show as regular error
        addNotification({
          message: errorMessage,
          type: NOTIFICATION_TYPES.ERROR
        });
      }
    } finally {
      setLoading(false);
    }
  };

  const fields = [
    { name: "username", label: "Username", type: "text", autoComplete: "username" },
    { name: "first_name", label: "First Name", type: "text", autoComplete: "given-name" },
    { name: "last_name", label: "Last Name", type: "text", autoComplete: "family-name" },
    { name: "email", label: "Email", type: "email", autoComplete: "email" },
    { name: "password1", label: "Password", type: "password", autoComplete: "new-password" },
    { name: "password2", label: "Confirm Password", type: "password", autoComplete: "new-password" },
  ];

  if (loading) {
    return (
      <div className="relative min-h-screen flex items-center justify-center">
        <div
          aria-hidden
          className="fixed inset-0 bg-center bg-cover"
          style={{ backgroundImage: `url('/login-hero-bg.jpg')` }}
        />
        <div className="fixed inset-0 bg-black/50" aria-hidden />
        <Spinner fullScreen={true} transparent={true} text="Creating your account..." />
      </div>
    );
  }

  return (
    <div className="relative min-h-screen flex items-center justify-center">
      {/* Background */}
      <div
        aria-hidden
        className="fixed inset-0 bg-center bg-cover"
        style={{ backgroundImage: `url('/login-hero-bg.jpg')` }}
      />
      <div className="fixed inset-0 bg-black/50" aria-hidden />

      <div className="relative w-full max-w-md mx-4 py-16">
        <div className="bg-white/10 border border-white/20 rounded-2xl shadow-2xl p-8 text-white">
          <h2 className="text-3xl font-semibold text-center mb-8">Create Account</h2>

          <form onSubmit={handleSignup} className="space-y-5">
            {fields.map((f) => (
              <div key={f.name} className="relative">
                <div className={`relative border-b ${errors[f.name] ? 'border-red-400' : 'border-white/40'} pb-1`}>
                  <input
                    name={f.name}
                    type={f.type || "text"}
                    value={formData[f.name]}
                    onChange={handleChange}
                    placeholder=" "
                    required
                    disabled={loading}
                    className={`peer w-full bg-transparent border-none outline-none text-white text-base pt-5 pb-2 placeholder-transparent ${
                      errors[f.name] ? 'text-red-200' : ''
                    }`}
                    autoComplete={f.autoComplete}
                  />
                  <label
                    className={`absolute left-0 transition-all pointer-events-none
                    peer-placeholder-shown:top-1/2 peer-placeholder-shown:-translate-y-1/2 peer-placeholder-shown:text-base
                    peer-focus:top-0 peer-focus:-translate-y-3 peer-focus:text-sm peer-focus:text-white
                    top-0 -translate-y-3 text-sm ${errors[f.name] ? 'text-red-300' : 'text-gray-200'}`}
                  >
                    {f.label}
                  </label>
                </div>
                {errors[f.name] && (
                  <p className="text-red-300 text-xs mt-1 flex items-center">
                    <svg className="w-3 h-3 mr-1" fill="currentColor" viewBox="0 0 20 20">
                      <path fillRule="evenodd" d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7 4a1 1 0 11-2 0 1 1 0 012 0zm-1-9a1 1 0 00-1 1v4a1 1 0 102 0V6a1 1 0 00-1-1z" clipRule="evenodd" />
                    </svg>
                    {errors[f.name]}
                  </p>
                )}
              </div>
            ))}

            <div className="text-xs text-gray-300 mt-2 space-y-1">
              <p className="flex items-center">
                <svg className="w-4 h-4 mr-1 text-green-400" fill="currentColor" viewBox="0 0 20 20">
                  <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" />
                </svg>
                Password must be at least 8 characters long
              </p>
              <p className="flex items-center">
                <svg className="w-4 h-4 mr-1 text-green-400" fill="currentColor" viewBox="0 0 20 20">
                  <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" />
                </svg>
                Use a mix of letters, numbers, and symbols for security
              </p>
            </div>

            <button
              type="submit"
              disabled={loading}
              className="mt-6 w-full flex items-center justify-center border border-white text-white py-3 rounded-md font-medium bg-transparent hover:bg-white hover:text-gray-900 transition duration-300 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {loading ? (
                <span className="flex items-center">
                  <svg className="animate-spin -ml-1 mr-3 h-5 w-5 text-white" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                  </svg>
                  Creating Account...
                </span>
              ) : "Sign Up"}
            </button>

            <div className="text-center mt-4 text-sm text-gray-200">
              Already have an account?{" "}
              <Link to="/login" className="text-white font-semibold hover:underline">
                Login
              </Link>
            </div>
          </form>
        </div>
      </div>
    </div>
  );
}