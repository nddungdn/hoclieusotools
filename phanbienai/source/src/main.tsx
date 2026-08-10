import React from "react";
import { createRoot } from "react-dom/client";
import ReviewApp from "./review-app";
import "./styles.css";

createRoot(document.getElementById("root")!).render(
  <React.StrictMode>
    <ReviewApp />
  </React.StrictMode>,
);
