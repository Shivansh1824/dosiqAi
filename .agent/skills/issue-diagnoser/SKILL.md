---
name: issue-diagnoser
description: Workflow for diagnosing and fixing codebase errors. Use this skill when the user provides an error message, stack trace, or screenshot of an issue. The skill involves analyzing the codebase, adding strategic debug logs, and waiting for the user to reproduce the issue before providing a fix.
---

# Issue Diagnoser Skill

This skill provides a systematic workflow for diagnosing and fixing errors in the project.

## Core Workflow

Always follow these steps precisely:

1. **Information Gathering & Codebase Study**
   - Read the error message, stack trace, or screenshot carefully.
   - Use codebase search tools (`grep_search`, `find_by_name`, `view_code_item`) to find the relevant files and components where the issue likely originates.
   - Trace the logical flow of data leading up to the point of failure.

2. **Strategic Instrumentation (Adding Debug Logs)**
   - Do NOT attempt to blindly fix the issue if the root cause is ambiguous.
   - Instead, modify the relevant files to add detailed debug logging.
   - **Logging Best Practices**:
     - Log function inputs, state variables, API request/response payloads, and execution variables.
     - Use a unique, searchable prefix for these logs (e.g., `console.log('🐞 [DIAGNOSTICS] <FunctionName>:', { varName });`).
     - Ensure the logs won't crash the app (use optional chaining `?.` to avoid null reference errors while logging).
   - If utilizing Python, use `logger.debug` or `print` with a similar prefix.

3. **User Handoff (The Feedback Loop)**
   - Once the logs are injected, **stop execution** and return control to the user.
   - Provide a brief summary of the files you modified.
   - Tell the user exactly what actions to perform in the app to trigger the logs.
   - Instruct the user to paste the resulting terminal output or logs back into the chat.

4. **Root Cause Analysis & Fix**
   - Analyze the provided debug logs from the user.
   - Identify the exact point of failure and the erroneous data state.
   - Formulate a fix, clearly explain the root cause to the user, and apply the code changes.
   
5. **Clean Up**
   - Finally, clean up and remove any of the temporary diagnostic logs you added in Step 2 to keep the codebase pristine.
