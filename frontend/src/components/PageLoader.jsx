// src/components/PageLoader.jsx
import { useState, useEffect } from "react";
import Spinner from "./Spinner";

export default function PageLoader({ children, minDuration = 1500 }) {
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const timeout = setTimeout(() => setLoading(false), minDuration);
    return () => clearTimeout(timeout);
  }, [minDuration]);

  return (
    <>
      {loading && <Spinner show={true} size={16} />}
      {!loading && children}
    </>
  );
}
