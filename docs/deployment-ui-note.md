# Current Interface Observation

The available Manus browser session exposes the top-level navigation and reports that its login has expired; it does not expose the user’s specific project controls. Therefore this project will not assume a **Settings → GitHub** entry exists.

The project-management UI documentation identifies a reliable export fallback in the project header’s **More (`⋯`)** menu: **Download as ZIP**. This can be used to move the prepared `.github/workflows` package to a public GitHub repository created directly at GitHub, without relying on a Manus GitHub integration panel.

The browser session must not be used to log in or upload on the user’s behalf without the user’s explicit confirmation. No GitHub credential is present in this task.
