// Global configuration for the CRM App

// API_BASE_URL: Determines the base path for all API calls.
// It checks if the hostname is localhost or 127.0.0.1 (typical for development)
// and sets a specific URL (including port 3001, where the backend might be running separately).
// For any other hostname (assumed production or staging), it defaults to '/api',
// which implies the frontend is served from the same domain as the backend,
// and API calls are relative to the root (e.g., https://yourdomain.com/api).
// Adjust the production path if your API is hosted on a different domain.
const API_BASE_URL = (window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1')
                     ? 'http://localhost:3001/api' // Development URL
                     : '/api';                     // Production URL (same domain)
                                                 // Example for different production domain: 'https://api.yourdomain.com/api'

// You can add other global configurations here if needed, for example:
// const DEFAULT_PAGE_SIZE = 20;
// const FEATURE_FLAGS = {
//     enableNewDashboard: true,
// };
