import React from "react";
import ReactDOM from "react-dom/client";
import { BrowserRouter } from "react-router-dom";
import App from "./App";
import { AuthProvider } from "./authContext";
import { SessionProvider } from "./sessionContext";
import { VerificationProvider } from "./verificationContext";
import "./styles.css";
import "./presence-verification/presence-verification.css";

ReactDOM.createRoot(document.getElementById("root")).render(
  <React.StrictMode>
    <BrowserRouter>
      <AuthProvider>
        <SessionProvider>
          <VerificationProvider>
            <App />
          </VerificationProvider>
        </SessionProvider>
      </AuthProvider>
    </BrowserRouter>
  </React.StrictMode>
);
