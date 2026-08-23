# Zero-Cost Scheduled Execution Review

## GitHub Actions

GitHub’s pricing page states that the Free plan includes 2,000 CI/CD minutes per month and that Actions execution is free for public repositories. GitHub’s schedule documentation confirms scheduled workflows are supported and that workflow files must exist on the default branch for scheduled execution.

For this project, a scheduled workflow will use the public repository path, run the Python collector once per hour, set the Google service-account JSON and spreadsheet identifier solely from encrypted repository secrets, and avoid committing any credential or source row. The collector will run only when a scheduled event or manual dispatch occurs—there is no continuously running server.

| Constraint | Design response |
| --- | --- |
| Must remain $0 | Use a public repository, for which GitHub states Actions is free. |
| No personal computer | GitHub-hosted runner executes each scheduled run. |
| Python runs are not persistent | The collector stores its deduplication state in Google Sheets; each run builds no local durable state. |
| Schedule may be delayed | Set the workflow to an hourly minute offset and present collection timestamp/next-run expectation in the dashboard. |
| Secrets must stay private | Store the service-account JSON and spreadsheet ID as encrypted repository secrets; never write them to tracked files or logs. |
| Avoid an earthquake API | Call only the documented USGS downloadable monthly CSV feed. |

GitHub’s schedule documentation further states that scheduled workflows run on the latest commit on the default branch, that the shortest supported interval is once every five minutes, and that runs can be delayed during high-load periods—especially at the start of the hour—or dropped under sufficient load. It also states that scheduled workflows in a public repository are automatically disabled after 60 days without repository activity. The proposed workflow will therefore use a 17-minute hourly offset rather than the top of the hour, remain on the default branch, and include a monthly lightweight scheduled run/commit strategy only if the repository otherwise risks inactivity.

## References

1. [GitHub Pricing](https://github.com/pricing)
2. [GitHub Actions schedule event documentation](https://docs.github.com/en/actions/reference/workflows-and-actions/events-that-trigger-workflows#schedule)
