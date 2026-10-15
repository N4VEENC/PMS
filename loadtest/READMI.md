## How to run

Start the Spring Boot service on its configured port, then run:

```sh
k6 run loadtest/loadtest.js
```

The test lasts about 10 minutes and follows a stepped ramp-and-soak profile:

| Elapsed time | Active virtual users | Phase |
|---|---:|---|
| 0:00–1:00 | 100 | Steady baseline |
| 1:00–2:00 | 100 → 325 | Stepped ramp-up 1 |
| 2:00–3:00 | 325 → 550 | Stepped ramp-up 2 |
| 3:00–4:00 | 550 → 775 | Stepped ramp-up 3 |
| 4:00–5:00 | 775 → 1000 | Stepped ramp-up 4 |
| 5:00–8:00 | 1000 | Sustained peak |
| 8:00–9:00 | 1000 → 500 | Ramp-down 1 |
| 9:00–10:00 | 500 → 0 | Ramp-down 2 |

The first three virtual users use three dedicated test managers prepared before
the measured load starts. Each checks that they can read their own portfolio
(expected HTTP 200) and cannot read either of the other managers' portfolios
(expected HTTP 404): three owner checks and six cross-manager checks total.
These checks appear in Table 6 and fail the test if the access rules are wrong.

The other virtual users sign up, log in, and create one portfolio once. All
virtual users then repeat the authenticated portfolio-list request with a
2-second think time. This keeps the run to at most 1000 test accounts and
portfolios, including the three isolation accounts, without creating a new
portfolio on every loop. Signup/login setup is staggered by 150 ms between VUs
within each 60-user cohort; the active-user ramp follows the schedule above.
After each measured create, the test immediately lists that user's portfolios
and checks that the newly returned portfolio ID is present. A missing ID or
missing read-back fails the test; Table 7 reports create attempts, responses
with IDs, verified read-backs, and unconfirmed writes separately.

The report declares and evaluates each API's p95, p99, and unexpected-response
rate (ERR) SLO for every phase with requests. A phase passes only when each
observed value is strictly below its target; phases without samples are marked
NOT MEASURED. Targets are p95 < 2000 ms for all APIs; p99 < 2000 ms for
signup/login, < 3000 ms for portfolio creation, and < 1500 ms for portfolio
listing; ERR < 0.5% for signup/login/listing and < 1% for portfolio creation.
The ERR boundary is strict, matching the k6 thresholds and breakpoint verdict:
an observed ERR equal to its limit fails.

The dashboard includes start/report timestamps, request and error totals,
dropped and inferred interrupted iterations, a 10-second p95/active-user
timeline, phase-by-phase SLO results, and the three-manager isolation results.
Interrupted iterations are inferred by comparing completed iterations with
portfolio-list requests (one per iteration); the report labels the count as an
inference because k6 does not expose it as a summary metric. Short graceful
shutdown windows can leave an iteration incomplete even when its requests
finished, and this count is separate from dropped iterations.
While the test runs, the terminal prints the target API, what each virtual user
does, the database-data warning, and one concise load-phase/progress update about
every 10 seconds. At completion, it lists the generated report filenames.

One run prints nine tables and per-API verdicts to the console, and writes all report files:

```text
loadtest-report.html  Visual, self-contained dashboard (primary output)
loadtest-report.txt   Tables 1-9 and verdicts
loadtest-report.json  Raw k6 summary
```

Open `loadtest-report.html` in a browser for an at-a-glance result: pass/fail status,
start/report timestamps, test duration, request/error totals, dropped iterations,
peak active users, a 10-second p95/active-VU timeline, phase comparisons, and nine
detailed tables with failing rows highlighted. The report has no external assets or
services and can be printed or saved as PDF from the browser.

### Windows: install k6

The npm package named `k6` is only an editor-autocomplete stub, not the k6 executable. Install the official k6 binary locally in this folder:

```powershell
npm.cmd run install:k6
```

The installer downloads Grafana Labs' official Windows MSI from `dl.k6.io`, verifies its Authenticode signature, and extracts only `k6.exe` under `.tools\k6`. It does not install the MSI, install the Grafana application, require administrator privileges, or modify the system PATH. If Windows cannot check certificate revocation for the download, the script retries the download with revocation checking disabled and still requires a valid Grafana Labs MSI signature.

From this `loadtest` folder, verify the install and run the suite using the npm script:

```powershell
npm.cmd run k6:version
npm.cmd run k6.cmd
```

The `k6.cmd` script invokes the local executable and produces all reports in this folder. The downloaded binary and generated reports are ignored by Git.

To use a different file prefix, set `REPORT_PREFIX` before running k6. For example, in PowerShell:

```powershell
$env:REPORT_PREFIX = "portfolio-loadtest"
npm.cmd run k6.cmd
```

Set `BASE_URL` to change the service origin. The default is `http://localhost:8081`.

## Note

The HTML dashboard (`loadtest-report.html`) is the primary result view. InfluxDB / Grafana are NOT required. Stock k6 does not implement a `--report` option; the test writes HTML, text, and JSON reports together directly from its `handleSummary` output.

The routes, payload fields, enum values, base port, and JWT bearer flow are based on the Spring Boot source in this workspace. Registration supports multiple users with unique email addresses and usernames. A run can create up to 1000 uniquely named `@loadtest.invalid` accounts and one portfolio per account in the configured database. Use a dedicated test database and clean only verified load-test records when finished.

### Cleaning generated test data

After inspecting the database and confirming the exact number of marked test
users and their owned portfolios, run the cleanup script with the verified
counts. For a complete run where every user owns one portfolio, a single count
is sufficient:

```powershell
node .\cleanup.js ..\portfolio\src\main\resources\application.properties 1000
```

For a partial run where the user and portfolio counts differ, supply both
verified counts:

```powershell
node .\cleanup.js ..\portfolio\src\main\resources\application.properties 1000 553
```

If marked records from earlier runs remain, use the verified totals instead.
The script refuses to delete unless both counts exactly match. If the optional
counts are omitted, it expects 1000 users and 1000 owned portfolios.

## How to read TABLE 5

Find WHICH API first crosses a latency or ERR SLO, during which load phase, and
at what observed concurrency. The verdict uses the same strict p95, p99, and
ERR limits as the phase SLO table; a value equal to its limit is a failure.
The report does not infer an unobserved database or infrastructure cause.
