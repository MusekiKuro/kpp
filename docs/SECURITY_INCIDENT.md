# Privileged Supabase key incident checklist

Status: open until a human confirms rotation and review completion.

A privileged Supabase key was present in tracked utility scripts. Treat that key as compromised. The key value is intentionally not reproduced here or in logs.

## Required human actions

- [ ] Rotate/revoke the exposed privileged Supabase key in Supabase before treating this incident as closed.
- [ ] Store the replacement only in the server environment as `SUPABASE_SERVICE_ROLE_KEY`; never use a `NEXT_PUBLIC_*` variable for it.
- [ ] Review remote Git history, all branches/tags, pull requests, forks, and release artifacts for the exposed key. Remove or restrict access to copies according to the repository’s incident policy; do not rewrite history as part of this task.
- [ ] Review CI/CD logs, deployment logs, Supabase logs, shell history, and other remote or shared logs for use or disclosure of the key.
- [ ] Confirm the old key is rejected and that the replacement is not present in tracked files or client bundles.
- [ ] Record the rotation timestamp, reviewer, affected project, and any observed unauthorized activity in the approved incident system.

## Local verification

Run from the repository root:

```text
npm.cmd run security:scan
npm.cmd run lint
npm.cmd run test
npm.cmd run build
git diff --check
```

The scan reports file names and detector labels only; it never prints matched values.

## Scope boundary

This checklist does not rotate credentials, rewrite Git history, inspect remote systems, commit, push, or deploy. Those actions require the project owner’s human approval.
