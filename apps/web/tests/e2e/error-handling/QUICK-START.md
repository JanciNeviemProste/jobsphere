# Quick Start - Network Failure Tests

## Run Tests Immediately

### 1. Basic Run (Headless)
```bash
cd apps/web
yarn test:e2e error-handling/network-failures
```

### 2. Watch in Browser (Headed)
```bash
cd apps/web
yarn test:e2e error-handling/network-failures --headed
```

### 3. Interactive UI Mode
```bash
cd apps/web
yarn test:e2e:ui error-handling/network-failures
```

---

## Run Specific Test Suites

### Timeout Tests Only
```bash
yarn test:e2e error-handling/network-failures -g "Timeout"
```

### Retry Logic Tests Only
```bash
yarn test:e2e error-handling/network-failures -g "Retry"
```

### Offline Mode Tests Only
```bash
yarn test:e2e error-handling/network-failures -g "Offline"
```

### Connection Reset Tests Only
```bash
yarn test:e2e error-handling/network-failures -g "ECONNRESET"
```

---

## What Gets Tested

✅ **5 Network Error Types**
- Timeouts (fetch, upload, auth)
- 503 Service Unavailable (with retry)
- Connection resets (ECONNRESET)
- Offline mode
- Partial/malformed responses

✅ **7 Error Recovery Mechanisms**
- Automatic retry with backoff
- Manual retry buttons
- Offline detection
- Error message display
- Data preservation
- Graceful degradation
- Network status indicators

✅ **22 Test Scenarios**
Covering edge cases and real-world failures

---

## Expected Results

### All Passing
```
Running 22 tests using 1 worker

  ✓ Network Failure Handling (22)
    ✓ Fetch Timeout Scenarios (3)
    ✓ 503 Service Unavailable (3)
    ✓ Connection Reset (3)
    ✓ Offline Mode Handling (3)
    ✓ Partial Response Handling (4)
    ✓ Network Error Recovery (3)
    ✓ API Error Responses (3)

  22 passed (2m 30s)
```

### If Tests Fail
Some tests may fail if:
- Error messages don't match expected patterns
- Retry logic not implemented
- Offline detection missing
- Network error handling needs improvement

**This is expected!** Tests document ideal behavior.

---

## Next Steps After Running

### If All Pass ✅
Great! Your app handles network failures well.

### If Some Fail ❌
1. Review failing test output
2. Check error handling implementation
3. Add retry logic if missing
4. Improve error messages
5. Add offline detection

---

## Debug Failing Tests

### Run in Debug Mode
```bash
yarn test:e2e error-handling/network-failures --debug
```

### Run Single Test
```bash
yarn test:e2e error-handling/network-failures -g "specific test name"
```

### View Screenshots
Failed tests automatically capture screenshots in:
```
apps/web/test-results/
```

---

## Files Created

1. **network-failures.spec.ts** (629 lines)
   - Main test file with 22 test cases

2. **README.md** (214 lines)
   - Comprehensive documentation

3. **TEST-SUMMARY.md** (356 lines)
   - Complete overview and statistics

4. **QUICK-START.md** (this file)
   - Quick reference guide

---

## Troubleshooting

### "Command not found: yarn"
```bash
npm install -g yarn
```

### "Cannot find module '@playwright/test'"
```bash
cd apps/web
yarn install
```

### Tests timeout
Increase timeout in `playwright.config.ts`:
```typescript
timeout: 60 * 1000, // 60 seconds
```

### Flaky tests
Run with retries:
```bash
yarn test:e2e error-handling/network-failures --retries=2
```

---

## More Information

- Full docs: See `README.md`
- Test details: See `TEST-SUMMARY.md`
- Code: See `network-failures.spec.ts`

---

**Ready to test? Run this now:**

```bash
cd apps/web && yarn test:e2e error-handling/network-failures
```
