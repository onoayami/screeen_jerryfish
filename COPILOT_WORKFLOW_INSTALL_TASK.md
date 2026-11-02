# Temporary Copilot task

Copy `restore-validated-history.yml` to `.github/workflows/restore-validated-history.yml` byte-for-byte.

Requirements:
- Change no other existing file.
- Verify source SHA-256: `22b16b3a1c969f511b1758b5e6e5ad59f0d0b3c8b8e58ade223db92deb61ecd7`.
- Verify source and destination with `cmp -s`.
- Delete this temporary task file before finishing, so the PR contains only `.github/workflows/restore-validated-history.yml`.