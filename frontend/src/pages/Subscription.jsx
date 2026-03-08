import { useState, useEffect, useContext, useRef, useCallback } from "react";
import { SubscriptionAPI } from "../apis/subscriptions";
import { AccountsAPI } from "../apis/accounts";          // <-- added
import { useNavigate } from "react-router-dom";
import { AccountsContext } from "../context/AccountsContext";
import {
  CalendarIcon,
  ClockIcon,
  CheckCircleIcon,
  ArrowPathIcon,
  ChartBarIcon,
  ExclamationTriangleIcon,
  CheckBadgeIcon,
  LockClosedIcon,
  ShieldCheckIcon,
  SparklesIcon,
  EnvelopeIcon,
  BanknotesIcon,
  ReceiptRefundIcon
} from "@heroicons/react/24/outline";
import { VITE_PAYSTACK_PUBLIC_KEY } from "../apis/base_url";
import Spinner from "../components/Spinner";
import SuccessCheck from "../components/SuccessCheck";
import DataTable from "../components/DataTable";

// Helper to check if Paystack is properly loaded
const isPaystackLoaded = () => {
  return typeof window !== 'undefined' && window.PaystackPop && typeof window.PaystackPop.setup === 'function';
};

export default function Subscription() {
  const [subscription, setSubscription] = useState(null);
  const [loading, setLoading] = useState(true);
  const [plansLoading, setPlansLoading] = useState(false);
  const [plans, setPlans] = useState([]);
  const [paymentHistory, setPaymentHistory] = useState([]);
  const [showHistory, setShowHistory] = useState(false);

  // Payment states
  const [paymentInitializing, setPaymentInitializing] = useState(false);
  const [paymentInitialized, setPaymentInitialized] = useState(false);
  const [selectedPlan, setSelectedPlan] = useState(null);
  const [paystackLoaded, setPaystackLoaded] = useState(false);
  const [paymentError, setPaymentError] = useState("");

  // Success state
  const [showSuccess, setShowSuccess] = useState(false);
  const [successMessage, setSuccessMessage] = useState("");

  const navigate = useNavigate();
  const { user, updateUser } = useContext(AccountsContext);   // <-- get updateUser
  const plansRef = useRef(null);

  useEffect(() => {
    fetchSubscription();
    fetchPaymentHistory();
    fetchPlans();
    checkPaystack();
  }, []);

  const fetchSubscription = async () => {
    try {
      const data = await SubscriptionAPI.getMySubscription();
      setSubscription(data);
    } catch (err) {
      console.error("Failed to fetch subscription:", err);
    } finally {
      setLoading(false);
    }
  };

  const fetchPaymentHistory = async () => {
    try {
      const data = await SubscriptionAPI.getPaymentHistory();
      setPaymentHistory(Array.isArray(data) ? data : []);
    } catch (err) {
      console.error("Failed to fetch payment history:", err);
    }
  };

  const fetchPlans = async () => {
    try {
      setPlansLoading(true);
      const data = await SubscriptionAPI.getPlans();

      if (data && data.length > 0) {
        const compactPlans = data.slice(0, 4).map(plan => ({
          id: plan.id,
          name: plan.name,
          amount: plan.amount,
          plan_type: plan.plan_type,
          description: plan.description
        }));
        setPlans(compactPlans);
      }
    } catch (err) {
      console.error("Failed to fetch plans:", err);
    } finally {
      setPlansLoading(false);
    }
  };

  const checkPaystack = () => {
    if (isPaystackLoaded()) {
      setPaystackLoaded(true);
    } else {
      const script = document.createElement('script');
      script.src = 'https://js.paystack.co/v1/inline.js';
      script.async = true;
      script.onload = () => {
        if (isPaystackLoaded()) {
          console.log("DEBUG: Paystack loaded successfully");
          setPaystackLoaded(true);
        } else {
          console.error("Paystack failed to load");
          setPaymentError("Payment gateway failed to load. Please refresh the page.");
        }
      };
      script.onerror = () => {
        console.error("Failed to load Paystack script");
        setPaymentError("Payment gateway failed to load. Please check your internet connection.");
      };
      document.body.appendChild(script);
    }
  };

  const formatDate = (dateString) => {
    if (!dateString) return "N/A";
    return new Date(dateString).toLocaleDateString("en-US", {
      year: "numeric",
      month: "long",
      day: "numeric",
      hour: "2-digit",
      minute: "2-digit"
    });
  };

  const formatCurrency = (amount) => {
    return new Intl.NumberFormat('en-NG', {
      style: 'currency',
      currency: 'NGN',
      minimumFractionDigits: 0,
    }).format(amount);
  };

  const calculateDaysRemaining = (expiryDate) => {
    if (!expiryDate) return 0;
    const expiry = new Date(expiryDate);
    const now = new Date();
    const diffTime = expiry - now;
    const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
    return Math.max(0, diffDays);
  };

  const getSubscriptionStatus = () => {
    if (!subscription) return "inactive";

    if (subscription.has_subscription && subscription.expires_at) {
      const daysRemaining = calculateDaysRemaining(subscription.expires_at);
      if (daysRemaining > 0) return "active";
      if (daysRemaining === 0) return "expiring_today";
      return "expired";
    }

    return "inactive";
  };

  const validateEmail = (email) => {
    if (!email) {
      return "Email is required";
    }
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(email)) {
      return "Invalid email format";
    }
    return null;
  };

  // ========== UPDATED: refresh user after payment ==========
  const handlePaymentCallback = useCallback(async (plan, response) => {
    setPaymentInitializing(false);
    setPaymentInitialized(false);

    try {
      console.log("DEBUG: Payment callback received:", response);
      const result = await SubscriptionAPI.verifyPayment(response.reference);

      if (result.success) {
        // Refresh user data from the server
        const freshUser = await AccountsAPI.getProfile();
        console.log(freshUser)
        updateUser(freshUser);   // update context and localStorage

        setSuccessMessage(`Payment Successful! Your ${plan.name} subscription is now active.`);
        setShowSuccess(true);

        // Refresh subscription data
        await fetchSubscription();
        // Refresh payment history
        await fetchPaymentHistory();
        setPaymentError("");
      } else {
        setPaymentError(result.message || "Payment verification failed. Please contact support.");
      }
    } catch (err) {
      console.error("Verification error:", err);
      setPaymentError(err.message || "Payment verification failed. Please check your payment status or contact support.");
    } finally {
      setSelectedPlan(null);
    }
  }, [updateUser]);

  const handleSuccessClose = () => {
    setShowSuccess(false);
    // Navigate to home page with success state
    navigate("/", {
      replace: true,
      state: {
        subscriptionActivated: true,
        showSuccess: true
      }
    });
  };

  const handlePaymentClose = useCallback(() => {
    setPaymentInitializing(false);
    setPaymentInitialized(false);
    setSelectedPlan(null);
    setPaymentError("Payment was cancelled. You can try again.");
  }, []);

  const handleSubscribe = async (plan) => {
    console.log("DEBUG: Subscribe clicked for plan:", plan.name);

    if (!user) {
      navigate("/login", { state: { from: "/subscription/status" } });
      return;
    }

    // Validate user email
    const emailError = validateEmail(user.email);
    if (emailError) {
      setPaymentError(`Email validation failed: ${emailError}. Please update your profile email.`);
      return;
    }

    if (!paystackLoaded) {
      setPaymentError("Payment gateway is still loading. Please wait a moment and try again.");
      return;
    }

    setSelectedPlan(plan);
    setPaymentError("");

    try {
      // Initialize payment with backend
      setPaymentInitializing(true);
      console.log("DEBUG: Initializing payment for plan:", plan.id);
      const paymentData = await SubscriptionAPI.initializePayment(plan.id);

      if (!paymentData.success) {
        throw new Error(paymentData.error || "Payment initialization failed");
      }

      console.log("DEBUG: Payment data received:", paymentData);
      console.log("DEBUG: Paystack public key:", VITE_PAYSTACK_PUBLIC_KEY);

      if (!window.PaystackPop) {
        throw new Error("Paystack payment gateway not loaded. Please refresh the page.");
      }

      // Create callback functions
      const paymentCallback = (response) => {
        console.log("DEBUG: Paystack callback triggered:", response);
        handlePaymentCallback(plan, response);
      };

      const paymentOnClose = () => {
        console.log("DEBUG: Paystack popup closed");
        handlePaymentClose();
      };

      // Initialize Paystack payment
      const handler = window.PaystackPop.setup({
        key: VITE_PAYSTACK_PUBLIC_KEY,
        email: user.email.trim(),
        amount: paymentData.amount * 100,
        ref: paymentData.reference,
        currency: "NGN",
        metadata: {
          custom_fields: [
            {
              display_name: "Plan",
              variable_name: "plan",
              value: plan.name
            },
            {
              display_name: "User ID",
              variable_name: "user_id",
              value: String(user.id)
            }
          ]
        },
        callback: paymentCallback,
        onClose: paymentOnClose
      });

      setPaymentInitialized(true);

      // Open Paystack iframe
      setTimeout(() => {
        try {
          handler.openIframe();
        } catch (iframeError) {
          console.error("Failed to open payment iframe:", iframeError);
          setPaymentError("Failed to open payment window. Please check your popup blocker.");
          setPaymentInitializing(false);
          setPaymentInitialized(false);
          setSelectedPlan(null);
        }
      }, 100);

    } catch (err) {
      console.error("Payment initialization error:", err);

      let errorMessage = "Failed to initialize payment. ";

      if (err.response?.status === 400) {
        errorMessage += "Invalid request parameters. Please try again or contact support.";
      } else if (err.response?.status === 401) {
        errorMessage += "Authentication failed. Please log in again.";
      } else if (err.message?.includes("email")) {
        errorMessage += "Email validation failed. Please update your profile email address.";
      } else if (err.response?.data?.error) {
        errorMessage += err.response.data.error;
      } else if (err.message) {
        errorMessage += err.message;
      } else {
        errorMessage += "Please check your internet connection and try again.";
      }

      setPaymentError(errorMessage);
      setPaymentInitializing(false);
      setPaymentInitialized(false);
      setSelectedPlan(null);
    }
  };

  const scrollToPlans = () => {
    if (plansRef.current) {
      plansRef.current.scrollIntoView({
        behavior: 'smooth',
        block: 'center'
      });
    }
  };

  const status = getSubscriptionStatus();

  // Define columns for payment history table
  const paymentHistoryColumns = [
    {
      key: "created_at",
      header: "Date",
      minWidth: "180px",
      render: (value) => formatDate(value),
      sortable: true,
    },
    {
      key: "amount",
      header: "Amount",
      minWidth: "120px",
      render: (value) => formatCurrency(value),
      sortable: true,
      cellClassName: "font-medium",
    },
    {
      key: "status",
      header: "Status",
      minWidth: "120px",
      render: (value) => {
        let statusConfig = {
          text: value,
          icon: null,
          bgColor: "bg-gray-100 dark:bg-gray-700",
          textColor: "text-gray-800 dark:text-gray-300"
        };

        if (value === "successful" || value === "success") {
          statusConfig = {
            text: "Successful",
            icon: <CheckCircleIcon className="w-4 h-4 mr-1" />,
            bgColor: "bg-green-100 dark:bg-green-900",
            textColor: "text-green-800 dark:text-green-300"
          };
        } else if (value === "pending" || value === "processing") {
          statusConfig = {
            text: "Pending",
            icon: <ClockIcon className="w-4 h-4 mr-1" />,
            bgColor: "bg-yellow-100 dark:bg-yellow-900",
            textColor: "text-yellow-800 dark:text-yellow-300"
          };
        } else if (value === "failed" || value === "cancelled" || value === "rejected") {
          statusConfig = {
            text: "Failed",
            icon: <ExclamationTriangleIcon className="w-4 h-4 mr-1" />,
            bgColor: "bg-red-100 dark:bg-red-900",
            textColor: "text-red-800 dark:text-red-300"
          };
        } else if (value === "refunded") {
          statusConfig = {
            text: "Refunded",
            icon: <ReceiptRefundIcon className="w-4 h-4 mr-1" />,
            bgColor: "bg-blue-100 dark:bg-blue-900",
            textColor: "text-blue-800 dark:text-blue-300"
          };
        }

        return (
          <span className={`inline-flex items-center px-3 py-1 rounded-full text-sm ${statusConfig.bgColor} ${statusConfig.textColor}`}>
            {statusConfig.icon}
            {statusConfig.text}
          </span>
        );
      },
      sortable: true,
    },
    {
      key: "paystack_reference",
      header: "Transaction ID",
      minWidth: "200px",
      render: (value) => (
        <span className="font-mono text-xs">
          {value || "N/A"}
        </span>
      ),
      cellClassName: "text-gray-500 dark:text-gray-400",
    },
  ];

  // Payment Processing Modal
  if (paymentInitializing || paymentInitialized) {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center bg-gray-100 dark:bg-gray-900 p-4">
        <div className="text-center max-w-md">
          <Spinner fullScreen text={paymentInitialized ? "Processing Payment..." : "Initializing Payment..."} />
          <div className="mt-6 space-y-4">
            <p className="text-gray-600 dark:text-gray-300">
              {paymentInitialized
                ? "Please complete the payment in the popup window. Do not close this tab."
                : "Preparing secure payment gateway..."
              }
            </p>

            {paymentInitialized && (
              <>
                <div className="bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800 rounded-lg p-4">
                  <p className="text-sm text-blue-700 dark:text-blue-300">
                    <span className="font-bold">Plan:</span> {selectedPlan?.name}<br />
                    <span className="font-bold">Amount:</span> {formatCurrency(selectedPlan?.amount || 0)}<br />
                    <span className="font-bold">Email:</span> {user?.email}
                  </p>
                </div>

                <div className="bg-yellow-50 dark:bg-yellow-900/20 border border-yellow-200 dark:border-yellow-800 rounded-lg p-4">
                  <p className="text-sm text-yellow-700 dark:text-yellow-300">
                    <span className="font-bold">Note:</span> If the payment window doesn't appear, check your browser's popup blocker and allow popups for this site.
                  </p>
                </div>
              </>
            )}

            <button
              onClick={() => {
                setPaymentInitializing(false);
                setPaymentInitialized(false);
                setSelectedPlan(null);
              }}
              className="mt-6 px-6 py-3 bg-gray-200 dark:bg-gray-700 text-gray-800 dark:text-gray-200 rounded-lg hover:bg-gray-300 dark:hover:bg-gray-600 transition-colors font-medium"
            >
              Cancel Payment
            </button>
          </div>
        </div>
      </div>
    );
  }

  if (loading) {
    return <Spinner fullScreen text="Loading subscription status..." />;
  }

  const isActive = status === "active" || status === "expiring_today";

  return (
    <>
      {/* Success Check Animation */}
      <SuccessCheck
        show={showSuccess}
        message={successMessage}
        onClose={handleSuccessClose}
      />

      <div className="flex flex-col items-center w-full text-gray-900 dark:text-gray-100">
        <div className="w-full lg:w-4/6 space-y-6 py-6 px-4">
          {/* Status Card */}
          <div className="bg-white dark:bg-gray-800 rounded-2xl shadow-lg p-6">
            <div className="flex flex-col md:flex-row md:items-center justify-between mb-6">
              <div>
                <h2 className="text-2xl font-bold text-gray-900 dark:text-white">
                  {status === "active" ? "✅ Active Subscription" :
                   status === "expiring_today" ? "⚠️ Expiring Today" :
                   status === "expired" ? "❌ Subscription Expired" :
                   "🔒 No Active Subscription"}
                </h2>
                <p className="text-gray-600 dark:text-gray-300 mt-2">
                  {status === "active" ? "You have full access to all content" :
                   status === "expiring_today" ? "Your subscription ends today" :
                   status === "expired" ? "Your subscription has expired" :
                   "Subscribe to unlock all content"}
                </p>
              </div>

              {isActive ? (
                <div className="mt-4 md:mt-0">
                  <span className="inline-flex items-center px-4 py-2 rounded-full bg-green-100 dark:bg-green-900 text-green-800 dark:text-green-300 text-sm font-bold">
                    <CheckCircleIcon className="w-4 h-4 mr-2" />
                    ACTIVE
                  </span>
                </div>
              ) : (
                <button
                  onClick={scrollToPlans}
                  className="mt-4 md:mt-0 px-6 py-3 bg-green-600 hover:bg-green-700 text-white font-semibold rounded-lg transition"
                >
                  Subscribe Now
                </button>
              )}
            </div>

            {/* Plan Details */}
            {subscription?.has_subscription && (
              <div className="flex flex-col gap-6 mt-5">
                <div className="bg-gray-50 dark:bg-gray-700/50 rounded-xl p-3 shadow-sm">
                  <div className="flex items-center mb-1">
                    <CalendarIcon className="w-5 h-5 text-green-600 mr-2" />
                    <span className="text-sm font-medium text-gray-600 dark:text-gray-300">Plan</span>
                  </div>
                  <p className="text-sm font-bold text-gray-900 dark:text-white">
                    {subscription.plan_name || "Premium Plan"}
                  </p>
                </div>

                <div className="bg-gray-50 dark:bg-gray-700/50 rounded-xl p-3 shadow-sm">
                  <div className="flex items-center mb-1">
                    <ClockIcon className="w-5 h-5 text-blue-600 mr-2" />
                    <span className="text-sm font-medium text-gray-600 dark:text-gray-300">Expires</span>
                  </div>
                  <p className="text-sm font-bold text-gray-900 dark:text-white">
                    {formatDate(subscription.expires_at)}
                  </p>
                </div>

                <div className="bg-gray-50 dark:bg-gray-700/50 rounded-xl p-3 shadow-sm">
                  <div className="flex items-center mb-1">
                    <ChartBarIcon className="w-5 h-5 text-purple-600 mr-2" />
                    <span className="text-sm font-medium text-gray-600 dark:text-gray-300">Days Remaining</span>
                  </div>
                  <p className="text-sm font-bold text-gray-900 dark:text-white">
                    {calculateDaysRemaining(subscription.expires_at)}
                  </p>
                </div>
              </div>
            )}

            {/* Progress Bar */}
            {subscription?.expires_at && (
              <div className="mt-8">
                <div className="flex justify-between text-sm text-gray-600 dark:text-gray-300 mb-2">
                  <span>Subscription Progress</span>
                  <span>{calculateDaysRemaining(subscription.expires_at)} days remaining</span>
                </div>
                <div className="w-full bg-gray-200 dark:bg-gray-700 rounded-full h-2.5">
                  <div
                    className="bg-green-600 h-2.5 rounded-full transition-all duration-500"
                    style={{
                      width: `${Math.min(100, (calculateDaysRemaining(subscription.expires_at) / 30) * 100)}%`
                    }}
                  ></div>
                </div>
              </div>
            )}
          </div>

          {/* Features Card */}
          <div className="bg-white dark:bg-gray-800 rounded-2xl shadow-lg p-6">
            <div className="inline-flex items-center px-4 py-2 rounded-full bg-green-100 dark:bg-green-900/30 text-green-800 dark:text-green-300 text-sm font-medium mb-4">
              <SparklesIcon className="w-4 h-4 mr-2" />
              What You Get
            </div>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              {[
                { icon: "📚", title: "All MCQs", desc: "Thousands of practice questions" },
                { icon: "🎴", title: "Flashcards", desc: "Interactive study cards" },
                { icon: "🏥", title: "OSCE Stations", desc: "Clinical practice scenarios" },
                { icon: "📝", title: "Study Notes", desc: "Comprehensive revision notes" },
                { icon: "📊", title: "Progress Tracking", desc: "Monitor your study progress" },
                { icon: "🏆", title: "Contest", desc: "Participate in the weekly contest and stand a chance to win a cash price." }
              ].map((feature, idx) => (
                <div key={idx} className="flex items-start p-4 bg-gray-50 dark:bg-gray-700/50 rounded-xl">
                  <span className="text-2xl mr-4">{feature.icon}</span>
                  <div>
                    <h4 className="font-bold text-gray-900 dark:text-white">{feature.title}</h4>
                    <p className="text-sm text-gray-600 dark:text-gray-300">{feature.desc}</p>
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* Only show payment plans if user doesn't have active subscription */}
          {!isActive && (
            <div ref={plansRef} className="bg-white dark:bg-gray-800 rounded-2xl shadow-lg p-6">
              <div className="mb-6">
                <div className="inline-flex items-center px-4 py-2 rounded-full bg-green-100 dark:bg-green-900/30 text-green-800 dark:text-green-300 text-sm font-medium mb-4">
                  <SparklesIcon className="w-4 h-4 mr-2" />
                  Available Plans
                </div>
                <p className="text-gray-600 dark:text-gray-300 mt-1">
                  Subscribe now to unlock all features
                </p>
              </div>

              {/* Payment Security Info */}
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6">
                <div className="flex items-center p-3 bg-gray-50 dark:bg-gray-700/50 rounded-lg">
                  <ShieldCheckIcon className="w-5 h-5 text-green-600 mr-3" />
                  <span className="text-sm font-medium">Secure Payment</span>
                </div>
                <div className="flex items-center p-3 bg-gray-50 dark:bg-gray-700/50 rounded-lg">
                  <ArrowPathIcon className="w-5 h-5 text-green-600 mr-3" />
                  <span className="text-sm font-medium">Instant Access</span>
                </div>
                <div className="flex items-center p-3 bg-gray-50 dark:bg-gray-700/50 rounded-lg">
                  <LockClosedIcon className="w-5 h-5 text-green-600 mr-3" />
                  <span className="text-sm font-medium">Full Content</span>
                </div>
              </div>

              {/* User Email Info */}
              {user && (
                <div className="bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800 rounded-xl p-4 mb-6">
                  <div className="flex items-center">
                    <EnvelopeIcon className="w-5 h-5 text-blue-600 mr-3" />
                    <div>
                      <p className="text-sm font-medium text-blue-800 dark:text-blue-300">
                        Payment will be processed using: <span className="font-bold">{user.email}</span>
                      </p>
                      <p className="text-xs text-blue-600 dark:text-blue-400 mt-1">
                        If this email is incorrect, please update it in your profile before subscribing.
                      </p>
                    </div>
                  </div>
                </div>
              )}

              {!paystackLoaded && (
                <div className="bg-yellow-50 dark:bg-yellow-900/20 border border-yellow-200 dark:border-yellow-800 rounded-xl p-4 mb-6">
                  <div className="flex items-center">
                    <ExclamationTriangleIcon className="w-5 h-5 text-yellow-600 mr-3" />
                    <p className="text-yellow-700 dark:text-yellow-300">
                      Loading payment gateway... Please wait a moment before subscribing.
                    </p>
                  </div>
                </div>
              )}

              {paymentError && (
                <div className="bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-xl p-4 mb-6">
                  <div className="flex items-start">
                    <ExclamationTriangleIcon className="w-5 h-5 text-red-600 mr-3 mt-0.5 flex-shrink-0" />
                    <div className="flex-1">
                      <p className="text-red-700 dark:text-red-300 font-medium mb-2">Payment Error</p>
                      <p className="text-red-600 dark:text-red-400">{paymentError}</p>
                      <div className="mt-3 flex flex-wrap gap-3">
                        <button
                          onClick={() => setPaymentError("")}
                          className="px-4 py-2 bg-red-600 hover:bg-red-700 text-white rounded-lg text-sm font-medium transition-colors"
                        >
                          Dismiss
                        </button>
                        <button
                          onClick={() => window.location.reload()}
                          className="px-4 py-2 bg-gray-200 dark:bg-gray-700 hover:bg-gray-300 dark:hover:bg-gray-600 text-gray-800 dark:text-gray-200 rounded-lg text-sm font-medium transition-colors"
                        >
                          Refresh Page
                        </button>
                        {user && (
                          <button
                            onClick={() => navigate("/profile")}
                            className="px-4 py-2 bg-green-600 hover:bg-green-700 text-white rounded-lg text-sm font-medium transition-colors"
                          >
                            Update Profile
                          </button>
                        )}
                      </div>
                    </div>
                  </div>
                </div>
              )}

              {plansLoading ? (
                <div className="flex justify-center py-8">
                  <Spinner size={40} color="green-600" />
                </div>
              ) : plans.length > 0 ? (
                <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-4">
                  {plans.map((plan, index) => (
                    <div
                      key={plan.id || index}
                      className={`border rounded-xl p-4 transition-all duration-200 hover:shadow-md ${
                        subscription?.plan_id === plan.id
                          ? "border-green-500 bg-green-50 dark:bg-green-900/10"
                          : "border-gray-200 dark:border-gray-700 hover:border-green-300 dark:hover:border-green-700"
                      }`}
                    >
                      <div className="flex items-start justify-between mb-2">
                        <div>
                          <h4 className="font-semibold text-gray-900 dark:text-white">
                            {plan.name}
                          </h4>
                          <p className="text-xs text-gray-500 dark:text-gray-400">
                            {plan.plan_type === "monthly" ? "Monthly plan" :
                             plan.plan_type === "three_months" ? "3 months access" :
                             plan.plan_type === "six_months" ? "6 months access" :
                             plan.plan_type === "yearly" ? "Yearly access" : ""}
                          </p>
                        </div>
                        {subscription?.plan_id === plan.id && (
                          <div className="flex items-center">
                            <CheckBadgeIcon className="w-5 h-5 text-green-600" />
                          </div>
                        )}
                      </div>

                      <div className="mt-3">
                        <div className="flex items-baseline">
                          <span className="text-2xl font-bold text-gray-900 dark:text-white">
                            {formatCurrency(plan.amount)}
                          </span>
                        </div>
                      </div>

                      <button
                        onClick={() => handleSubscribe(plan)}
                        disabled={!paystackLoaded || !user}
                        className={`mt-4 w-full py-2 text-sm font-medium rounded-lg transition ${
                          !paystackLoaded || !user
                            ? "opacity-50 cursor-not-allowed bg-gray-300 dark:bg-gray-700 text-gray-800 dark:text-gray-300"
                            : "bg-green-600 hover:bg-green-700 text-white"
                        }`}
                      >
                        {!paystackLoaded ? (
                          "Loading Payment..."
                        ) : !user ? (
                          "Please Login"
                        ) : (
                          "Subscribe"
                        )}
                      </button>
                    </div>
                  ))}
                </div>
              ) : (
                <div className="text-center py-8">
                  <p className="text-gray-500 dark:text-gray-400">No subscription plans available.</p>
                  <button
                    onClick={fetchPlans}
                    className="mt-3 px-4 py-2 bg-gray-200 dark:bg-gray-700 hover:bg-gray-300 dark:hover:bg-gray-600 text-gray-800 dark:text-gray-200 rounded-lg text-sm transition"
                  >
                    Try Again
                  </button>
                </div>
              )}
            </div>
          )}

          {/* Payment History Card - Only show if user has payment history */}
          {paymentHistory.length > 0 && (
            <div className="bg-white dark:bg-gray-800 rounded-2xl shadow-lg p-6">
              <div className="flex items-center justify-between mb-6">
                <div>
                  <div className="inline-flex items-center px-4 py-2 rounded-full bg-green-100 dark:bg-green-900/30 text-green-800 dark:text-green-300 text-sm font-medium mb-2">
                    <BanknotesIcon className="w-4 h-4 mr-2" />
                    Payment History
                  </div>
                  <p className="text-sm text-gray-600 dark:text-gray-300">
                    View your past subscription payments
                  </p>
                </div>
                <button
                  onClick={() => setShowHistory(!showHistory)}
                  className="flex items-center text-green-600 hover:text-green-700 font-medium px-4 py-2 rounded-lg hover:bg-green-50 dark:hover:bg-green-900/20 transition-colors"
                >
                  <ArrowPathIcon className="w-5 h-5 mr-2" />
                  {showHistory ? "Hide History" : "Show History"}
                </button>
              </div>

              {showHistory && (
                <DataTable
                  data={paymentHistory}
                  columns={paymentHistoryColumns}
                  loading={false}
                  showPagination={true}
                  pageSize={5}
                  totalItems={paymentHistory.length}
                  className="mt-4"
                  striped={true}
                  hoverable={true}
                  onRowClick={(row) => {
                    console.log("Payment details clicked:", row);
                  }}
                  emptyMessage="No payment history found."
                />
              )}
            </div>
          )}
        </div>
      </div>
    </>
  );
}