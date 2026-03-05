import { useState, useEffect, useContext } from "react";
import { useNavigate } from "react-router-dom";
import { AccountsContext } from "../../context/AccountsContext";
import { AccountsAPI } from "../../apis/accounts";
import { useNotification, NOTIFICATION_TYPES } from "../../context/NotificationContext";
import Spinner from "../../components/Spinner";
import {
  UserIcon,
  EnvelopeIcon,
  LockClosedIcon,
  ArrowLeftIcon,
  CheckCircleIcon,
  XCircleIcon
} from "@heroicons/react/24/outline";

export default function EditProfile() {
  const { user, updateUser } = useContext(AccountsContext);
  const navigate = useNavigate();
  const { addNotification } = useNotification();

  const [formData, setFormData] = useState({
    username: "",
    first_name: "",
    last_name: "",
    email: "",
    current_password: "",
    new_password1: "",
    new_password2: "",
  });
  
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [errors, setErrors] = useState({});
  const [showPasswordFields, setShowPasswordFields] = useState(false);
  const [passwordStrength, setPasswordStrength] = useState(0);

  // Initialize form with user data
  useEffect(() => {
    if (user) {
      setFormData({
        username: user.username || "",
        first_name: user.first_name || "",
        last_name: user.last_name || "",
        email: user.email || "",
        current_password: "",
        new_password1: "",
        new_password2: "",
      });
    }
  }, [user]);

  // Check password strength
  useEffect(() => {
    const password = formData.new_password1;
    
    if (!password) {
      setPasswordStrength(0);
      return;
    }
    
    const criteria = {
      length: password.length >= 8,
      uppercase: /[A-Z]/.test(password),
      lowercase: /[a-z]/.test(password),
      number: /\d/.test(password),
      special: /[!@#$%^&*(),.?":{}|<>]/.test(password),
    };
    
    // Calculate strength (0-100)
    const metCriteria = Object.values(criteria).filter(Boolean).length;
    const strength = (metCriteria / 5) * 100;
    setPasswordStrength(strength);
  }, [formData.new_password1]);

  const handleChange = (e) => {
    const { name, value } = e.target;
    setFormData((prev) => ({ ...prev, [name]: value }));
    
    // Clear error for this field when user starts typing
    if (errors[name]) {
      setErrors((prev) => ({ ...prev, [name]: null }));
    }
  };

  const validateForm = () => {
    const newErrors = {};
    
    // Required fields validation
    if (!formData.first_name.trim()) {
      newErrors.first_name = "First name is required";
    }
    
    if (!formData.last_name.trim()) {
      newErrors.last_name = "Last name is required";
    }
    
    // Email validation
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!formData.email.trim()) {
      newErrors.email = "Email is required";
    } else if (!emailRegex.test(formData.email)) {
      newErrors.email = "Please enter a valid email address";
    }
    
    // Password validation (if changing password)
    if (showPasswordFields) {
      if (!formData.current_password) {
        newErrors.current_password = "Current password is required to change password";
      }
      
      if (formData.new_password1 && formData.new_password1.length < 8) {
        newErrors.new_password1 = "New password must be at least 8 characters";
      }
      
      if (formData.new_password1 !== formData.new_password2) {
        newErrors.new_password2 = "Passwords do not match";
      }
      
      if (formData.new_password1 && passwordStrength < 40) {
        newErrors.new_password1 = "Please choose a stronger password";
      }
    }
    
    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    
    if (!validateForm()) {
      addNotification({
        message: "Please fix the errors in the form",
        type: NOTIFICATION_TYPES.ERROR
      });
      return;
    }
    
    setSaving(true);
    setErrors({});
    
    try {
      // Prepare data for API
      const updateData = {
        first_name: formData.first_name,
        last_name: formData.last_name,
        email: formData.email,
      };
      
      // Include password fields only if user wants to change password
      if (showPasswordFields && formData.current_password) {
        updateData.current_password = formData.current_password;
        updateData.new_password1 = formData.new_password1;
        updateData.new_password2 = formData.new_password2;
      }
      
      // Call API to update profile
      const response = await AccountsAPI.updateProfile(updateData);
      
      // Update user in context
      const updatedUser = {
        ...user,
        first_name: formData.first_name,
        last_name: formData.last_name,
        email: formData.email,
      };
      updateUser(updatedUser);
      
      addNotification({
        message: "Profile updated successfully!",
        type: NOTIFICATION_TYPES.SUCCESS,
        duration: 3000
      });
      
      // Clear password fields
      setFormData(prev => ({
        ...prev,
        current_password: "",
        new_password1: "",
        new_password2: "",
      }));
      setShowPasswordFields(false);
      setPasswordStrength(0);
      
      // Navigate back to profile after a short delay
      setTimeout(() => {
        navigate("/profile");
      }, 1000);
      
    } catch (err) {
      // Handle specific error messages from backend
      let errorMessage = err.message || "Failed to update profile. Please try again.";
      
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
        // Not JSON, might be a string error
        if (err.message.includes("email") || err.message.includes("Email")) {
          setErrors({ email: err.message });
          addNotification({
            message: err.message,
            type: NOTIFICATION_TYPES.ERROR
          });
        } else {
          addNotification({
            message: errorMessage,
            type: NOTIFICATION_TYPES.ERROR
          });
        }
      }
    } finally {
      setSaving(false);
    }
  };

  const handleReset = () => {
    if (user) {
      setFormData({
        username: user.username || "",
        first_name: user.first_name || "",
        last_name: user.last_name || "",
        email: user.email || "",
        current_password: "",
        new_password1: "",
        new_password2: "",
      });
      setErrors({});
      setShowPasswordFields(false);
      setPasswordStrength(0);
      
      addNotification({
        message: "Form reset to original values",
        type: NOTIFICATION_TYPES.INFO,
        duration: 2000
      });
    }
  };

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

  if (loading || !user) {
    return (
      <div className="flex justify-center items-center min-h-screen">
        <Spinner fullScreen text="Loading profile..." />
      </div>
    );
  }

  return (
    <div className="flex justify-center w-full min-h-screen bg-gray-100 dark:bg-gray-900 text-gray-900 dark:text-gray-100">
      <div className="w-full lg:w-4/6 space-y-4 py-8 px-4">
        {/* Header with Back Button */}
        <div className="flex items-center justify-between mb-6">
          <button
            onClick={() => navigate("/profile")}
            className="flex items-center text-gray-600 dark:text-gray-300 hover:text-gray-900 dark:hover:text-white transition-colors"
          >
            <ArrowLeftIcon className="w-5 h-5 mr-2" />
            Back
          </button>
          <h1 className="text-2xl font-bold">Edit Profile</h1>
          <div className="w-20"></div> {/* Spacer for alignment */}
        </div>

        {/* Main Form Card */}
        <div className="bg-white dark:bg-gray-800 rounded-2xl shadow-lg p-6">
          <div className="mb-8">
            <h2 className="text-xl font-semibold mb-2">Personal Information</h2>
            <p className="text-gray-600 dark:text-gray-400 text-sm">
              Update your personal details and contact information
            </p>
          </div>

          <form onSubmit={handleSubmit} className="space-y-6">
            {/* Username (Read-only) */}
            <div>
              <label className="flex items-center text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                <UserIcon className="w-4 h-4 mr-2" />
                Username
              </label>
              <input
                type="text"
                value={formData.username}
                readOnly
                className="w-full px-4 py-3 bg-gray-50 dark:bg-gray-700 border border-gray-300 dark:border-gray-600 rounded-lg text-gray-900 dark:text-gray-100 cursor-not-allowed"
              />
              <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">
                Username cannot be changed
              </p>
            </div>

            {/* Name Fields */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                  First Name *
                </label>
                <input
                  type="text"
                  name="first_name"
                  value={formData.first_name}
                  onChange={handleChange}
                  className={`w-full px-4 py-3 border rounded-lg focus:ring-2 focus:ring-green-500 focus:border-transparent transition ${
                    errors.first_name
                      ? "border-red-500 dark:border-red-500 bg-red-50 dark:bg-red-900/10"
                      : "border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700"
                  }`}
                  placeholder="Enter your first name"
                />
                {errors.first_name && (
                  <p className="text-red-500 text-sm mt-1">{errors.first_name}</p>
                )}
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                  Last Name *
                </label>
                <input
                  type="text"
                  name="last_name"
                  value={formData.last_name}
                  onChange={handleChange}
                  className={`w-full px-4 py-3 border rounded-lg focus:ring-2 focus:ring-green-500 focus:border-transparent transition ${
                    errors.last_name
                      ? "border-red-500 dark:border-red-500 bg-red-50 dark:bg-red-900/10"
                      : "border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700"
                  }`}
                  placeholder="Enter your last name"
                />
                {errors.last_name && (
                  <p className="text-red-500 text-sm mt-1">{errors.last_name}</p>
                )}
              </div>
            </div>

            {/* Email */}
            <div>
              <label className="flex items-center text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                <EnvelopeIcon className="w-4 h-4 mr-2" />
                Email Address *
              </label>
              <input
                type="email"
                name="email"
                value={formData.email}
                onChange={handleChange}
                className={`w-full px-4 py-3 border rounded-lg focus:ring-2 focus:ring-green-500 focus:border-transparent transition ${
                  errors.email
                    ? "border-red-500 dark:border-red-500 bg-red-50 dark:bg-red-900/10"
                    : "border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700"
                }`}
                placeholder="Enter your email address"
              />
              {errors.email && (
                <p className="text-red-500 text-sm mt-1">{errors.email}</p>
              )}
            </div>

            {/* Password Change Section */}
            <div className="pt-6 border-t border-gray-200 dark:border-gray-700">
              <div className="flex items-center justify-between mb-4">
                <div>
                  <h3 className="text-lg font-semibold">Change Password</h3>
                  <p className="text-sm text-gray-600 dark:text-gray-400">
                    Update your password for enhanced security
                  </p>
                </div>
                <button
                  type="button"
                  onClick={() => setShowPasswordFields(!showPasswordFields)}
                  className="px-4 py-2 text-sm font-medium text-green-600 hover:text-green-700 hover:bg-green-50 dark:hover:bg-green-900/20 rounded-lg transition-colors"
                >
                  {showPasswordFields ? "Cancel" : "Change Password"}
                </button>
              </div>

              {showPasswordFields && (
                <div className="space-y-6 bg-gray-50 dark:bg-gray-700/30 p-6 rounded-xl">
                  {/* Current Password */}
                  <div>
                    <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                      Current Password *
                    </label>
                    <input
                      type="password"
                      name="current_password"
                      value={formData.current_password}
                      onChange={handleChange}
                      className={`w-full px-4 py-3 border rounded-lg focus:ring-2 focus:ring-green-500 focus:border-transparent transition ${
                        errors.current_password
                          ? "border-red-500 dark:border-red-500 bg-red-50 dark:bg-red-900/10"
                          : "border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700"
                      }`}
                      placeholder="Enter your current password"
                    />
                    {errors.current_password && (
                      <p className="text-red-500 text-sm mt-1">{errors.current_password}</p>
                    )}
                  </div>

                  {/* New Password */}
                  <div>
                    <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                      New Password
                    </label>
                    <input
                      type="password"
                      name="new_password1"
                      value={formData.new_password1}
                      onChange={handleChange}
                      className={`w-full px-4 py-3 border rounded-lg focus:ring-2 focus:ring-green-500 focus:border-transparent transition ${
                        errors.new_password1
                          ? "border-red-500 dark:border-red-500 bg-red-50 dark:bg-red-900/10"
                          : "border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700"
                      }`}
                      placeholder="Enter new password"
                    />
                    
                    {/* Password Strength Meter */}
                    {formData.new_password1 && (
                      <div className="mt-3 space-y-2">
                        <div className="flex justify-between text-xs">
                          <span>Password Strength:</span>
                          <span className={`font-semibold ${
                            passwordStrength < 40 ? 'text-red-500' :
                            passwordStrength < 70 ? 'text-yellow-500' : 'text-green-500'
                          }`}>
                            {getPasswordStrengthText()}
                          </span>
                        </div>
                        <div className="w-full bg-gray-200 dark:bg-gray-700 rounded-full h-2">
                          <div 
                            className={`h-2 rounded-full transition-all duration-300 ${getPasswordStrengthColor()}`}
                            style={{ width: `${passwordStrength}%` }}
                          ></div>
                        </div>
                      </div>
                    )}
                    
                    {errors.new_password1 && (
                      <p className="text-red-500 text-sm mt-1">{errors.new_password1}</p>
                    )}
                    
                    {/* Password Requirements */}
                    <div className="text-xs text-gray-600 dark:text-gray-400 mt-3 space-y-1">
                      <p className="flex items-center">
                        <CheckCircleIcon className="w-3 h-3 mr-1 text-green-500" />
                        Password must be at least 8 characters long
                      </p>
                      <p className="flex items-center">
                        <CheckCircleIcon className="w-3 h-3 mr-1 text-green-500" />
                        Use a mix of uppercase and lowercase letters
                      </p>
                      <p className="flex items-center">
                        <CheckCircleIcon className="w-3 h-3 mr-1 text-green-500" />
                        Include numbers and special characters for security
                      </p>
                    </div>
                  </div>

                  {/* Confirm New Password */}
                  <div>
                    <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                      Confirm New Password
                    </label>
                    <input
                      type="password"
                      name="new_password2"
                      value={formData.new_password2}
                      onChange={handleChange}
                      className={`w-full px-4 py-3 border rounded-lg focus:ring-2 focus:ring-green-500 focus:border-transparent transition ${
                        errors.new_password2
                          ? "border-red-500 dark:border-red-500 bg-red-50 dark:bg-red-900/10"
                          : "border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700"
                      }`}
                      placeholder="Confirm new password"
                    />
                    {errors.new_password2 && (
                      <p className="text-red-500 text-sm mt-1">{errors.new_password2}</p>
                    )}
                  </div>
                </div>
              )}
            </div>

            {/* Action Buttons */}
            <div className="flex flex-col sm:flex-row gap-4 pt-6 border-t border-gray-200 dark:border-gray-700">
              <button
                type="button"
                onClick={handleReset}
                disabled={saving}
                className="flex-1 flex items-center justify-center px-6 py-3 border border-gray-300 dark:border-gray-600 text-gray-700 dark:text-gray-300 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors disabled:opacity-50"
              >
                <XCircleIcon className="w-5 h-5 mr-2" />
                Reset
              </button>
              
              <button
                type="submit"
                disabled={saving}
                className="flex-1 flex items-center justify-center px-6 py-3 bg-green-600 text-white rounded-lg hover:bg-green-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {saving ? (
                  <>
                    <svg className="animate-spin -ml-1 mr-3 h-5 w-5 text-white" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                      <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                      <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                    </svg>
                    Saving...
                  </>
                ) : (
                  <>
                    <CheckCircleIcon className="w-5 h-5 mr-2" />
                    Save Changes
                  </>
                )}
              </button>
            </div>
          </form>
        </div>

        {/* Information Card */}
        <div className="bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800 rounded-xl p-6">
          <h3 className="font-semibold text-blue-800 dark:text-blue-300 mb-2 flex items-center">
            <LockClosedIcon className="w-5 h-5 mr-2" />
            Profile Update Information
          </h3>
          <ul className="text-sm text-blue-700 dark:text-blue-400 space-y-2">
            <li className="flex items-start">
              <span className="inline-block w-2 h-2 bg-blue-500 rounded-full mt-1 mr-2 flex-shrink-0"></span>
              <span>Your username cannot be changed for security reasons</span>
            </li>
            <li className="flex items-start">
              <span className="inline-block w-2 h-2 bg-blue-500 rounded-full mt-1 mr-2 flex-shrink-0"></span>
              <span>Email changes may require verification</span>
            </li>
            <li className="flex items-start">
              <span className="inline-block w-2 h-2 bg-blue-500 rounded-full mt-1 mr-2 flex-shrink-0"></span>
              <span>Password changes require your current password for security</span>
            </li>
            <li className="flex items-start">
              <span className="inline-block w-2 h-2 bg-blue-500 rounded-full mt-1 mr-2 flex-shrink-0"></span>
              <span>All fields marked with * are required</span>
            </li>
          </ul>
        </div>
      </div>
    </div>
  );
}