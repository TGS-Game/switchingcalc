import axios from "axios";

const client = axios.create({
  baseURL: "/api"
});

client.interceptors.request.use((config) => {
  const token = localStorage.getItem("token");
  if (token) {
    config.headers = config.headers || {};
    config.headers.Authorization = `Bearer ${token}`;
  }
  return config;
});

client.interceptors.response.use(
  (response) => response,
  (error) => {
    const status = error?.response?.status;
    if (status === 401) {
      try {
        localStorage.removeItem("token");
      } catch {}
      if (window.location.pathname !== "/") {
        window.location.href = "/";
      } else {
        window.location.reload();
      }
    }
    return Promise.reject(error);
  }
);

export default client;
