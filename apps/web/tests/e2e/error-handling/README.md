# Error Handling E2E Tests

This directory contains end-to-end tests for error handling scenarios in the JobSphere application.

## Test Files

### `network-failures.spec.ts`

Comprehensive tests for network failure scenarios including:

#### 1. Fetch Timeout Scenarios
- **API timeout on job listing page**: Tests timeout handling when job listings take too long to load
- **Timeout on CV upload**: Verifies graceful degradation when CV upload times out
- **Slow authentication check**: Ensures page doesn't hang when auth check is slow

#### 2. 503 Service Unavailable - Retry Logic
- **Retry and eventually succeed**: Tests automatic retry mechanism that succeeds after multiple attempts
- **Max retry attempts exceeded**: Verifies error message after all retry attempts fail
- **Respect Retry-After header**: Confirms compliance with HTTP Retry-After header

#### 3. Connection Reset (ECONNRESET)
- **Connection reset during job fetch**: Tests handling of ECONNRESET errors
- **Recovery from connection reset**: Verifies automatic recovery with retry
- **Connection reset during form submission**: Tests error handling for form submissions

#### 4. Offline Mode Handling
- **Detect offline mode**: Tests offline detection and user notification
- **Recover when connection restored**: Verifies app recovery when going back online
- **Queue actions while offline**: Tests optimistic UI and background sync

#### 5. Partial Response Handling
- **Incomplete JSON response**: Tests parsing error handling for malformed JSON
- **Missing required fields**: Verifies graceful handling of incomplete data
- **Chunked response interruption**: Tests handling of interrupted chunked transfers
- **Large response timeout**: Ensures app remains responsive with large payloads

#### 6. Network Error Recovery
- **Retry button after failure**: Tests manual retry mechanism
- **Network status indicator**: Verifies visibility of connection status
- **Preserve user input**: Ensures form data persists after errors

#### 7. API Error Responses
- **502 Bad Gateway**: Tests handling of proxy errors
- **504 Gateway Timeout**: Tests handling of gateway timeouts
- **DNS resolution failure**: Tests handling of DNS errors

## Running the Tests

### Run all network failure tests
```bash
cd apps/web
yarn test:e2e error-handling/network-failures
```

### Run specific test suite
```bash
yarn test:e2e error-handling/network-failures -g "Fetch Timeout"
```

### Run with UI mode
```bash
yarn test:e2e:ui error-handling/network-failures
```

### Run in headed mode (watch browser)
```bash
yarn test:e2e error-handling/network-failures --headed
```

## Test Configuration

These tests use Playwright's route interception to simulate network failures:

- **`route.abort()`**: Simulates connection failures (ECONNRESET, DNS errors)
- **`route.fulfill()`**: Returns custom responses (503, 502, partial JSON)
- **`context.setOffline()`**: Simulates offline mode
- **`setTimeout()`**: Creates delays to test timeouts

## Important Notes

### Timeouts
The tests use various timeout values:
- Navigation timeout: 30s (configured in playwright.config.ts)
- Action timeout: 10s (configured in playwright.config.ts)
- Custom test timeouts: Varied based on scenario

### Retry Logic
Some tests verify automatic retry behavior:
- Tests track attempt counts to verify retries occurred
- Tests verify Retry-After header compliance
- Tests ensure max retry limits are respected

### Offline Detection
Offline tests may behave differently based on:
- Service Worker implementation
- Network error handling in fetch/axios wrappers
- Browser support for offline events

### Error Messages
Tests use flexible matchers (regex) for error messages:
- Messages may vary based on implementation
- Tests check for common patterns: "error", "failed", "try again", etc.
- Some assertions are lenient to avoid false failures

## Best Practices

1. **Run tests in isolation**: Network tests can interfere with each other
2. **Use unique route patterns**: Avoid conflicting route interceptions
3. **Clean up routes**: Routes are automatically cleaned between tests
4. **Verify graceful degradation**: Tests should verify app doesn't crash
5. **Test user experience**: Focus on user-visible error messages

## Test Coverage

These tests verify:
- ✅ Network error detection
- ✅ Automatic retry mechanisms
- ✅ Manual retry (user-triggered)
- ✅ Offline mode handling
- ✅ Error message visibility
- ✅ Graceful degradation
- ✅ Data persistence during errors
- ✅ Recovery mechanisms

## Related Files

- `apps/web/playwright.config.ts` - Playwright configuration
- `apps/web/src/lib/errors.ts` - Error handling utilities
- `apps/web/src/lib/api-helpers.ts` - API error classes
- `apps/web/src/lib/ocr-client.ts` - Example with timeout handling

## Troubleshooting

### Tests timing out
- Increase timeout values in test or config
- Check if route interception is blocking indefinitely
- Verify test cleanup between runs

### Flaky tests
- Add explicit waits for error messages
- Use more specific selectors
- Increase assertion timeouts

### Route interception not working
- Verify route pattern matches actual requests
- Check if request is made from correct context
- Use `page.route()` before navigation

## Future Enhancements

Potential additions:
- WebSocket connection failure tests
- Server-Sent Events (SSE) error handling
- GraphQL error scenarios
- Rate limiting error tests
- CORS error handling
- Certificate validation errors
