// frontend/src/components/ProtectedRoute.jsx (Simplified)
import { useContext } from "react";
import { Navigate, useLocation } from "react-router-dom";
import { AccountsContext } from "../context/AccountsContext";
import Spinner from "./Spinner";

export default function ProtectedRoute({ children }) {
  const { user, isAuthenticated, authLoading } = useContext(AccountsContext);
  const location = useLocation();

  // Show loading while auth is being checked
  if (authLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <Spinner fullContainer text="Checking authentication..." />
      </div>
    );
  }

  // Redirect to login if not authenticated
  if (!isAuthenticated || !user) {
    return (
      <Navigate
        to="/login"
        replace
        state={{ from: location.pathname }}
      />
    );
  }

  return children;
}