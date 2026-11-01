# Exact-history bootstrap

This temporary commit restores the validated Git bundle into `main` without dropping binary assets or history.

The restore workflow verifies the bundle SHA-256 and expected HEAD before replacing this bootstrap commit. Do not edit the bundle parts while restoration is running.
