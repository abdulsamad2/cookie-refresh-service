# Cookie Refresh Service

This service is responsible for automatically refreshing cookies to maintain active sessions.

## API Endpoints

### Health Check

*   **GET** `/api/health`
    *   Checks the health of the service.
    *   **Response:** `200 OK` with a status message.

### Cookie Refresh

*   **POST** `/api/cookie-refresh/trigger`
    *   Manually triggers a cookie refresh.
    *   **Response:** `200 OK` with a success message or `500 Internal Server Error` on failure.

*   **GET** `/api/cookie-refresh/status`
    *   Retrieves the current status and statistics of the cookie refresh service.
    *   **Response:** `200 OK` with a JSON object containing service status, refresh statistics, and next scheduled refresh time.

*   **GET** `/api/cookie-refresh/cookies`
    *   Retrieves current cookies from storage. If no cookies exist, automatically triggers a refresh to generate new ones.
    *   **Response:** `200 OK` with a JSON object containing cookies array, count, last updated timestamp, and auto-generation flag.