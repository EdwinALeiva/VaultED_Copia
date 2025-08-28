// src/services/http.js
import axios from 'axios';

const baseURL = import.meta.env.VITE_API_BASE_URL || 'http://localhost:8081';

export const http = axios.create({
  baseURL,
  withCredentials: false,
});

// Optional interceptors placeholder for auth headers in future
http.interceptors.response.use(
  (res) => res,
  (err) => Promise.reject(err)
);
