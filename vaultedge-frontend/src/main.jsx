import "./index.css";
import React from "react";
import ReactDOM from "react-dom/client";
import { BrowserRouter } from "react-router-dom";
import App from "./App";
import { AuthProvider } from "./contexts/AuthContext";
import { I18nProvider } from "./contexts/I18nContext";

ReactDOM.createRoot(document.getElementById("root")).render(
  <BrowserRouter>
    <I18nProvider>
      <AuthProvider>
        <App />
      </AuthProvider>
    </I18nProvider>
  </BrowserRouter>
);