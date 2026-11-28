# web-vitals

Measures the Web Vitals of the deployed web app with `web-vitals-flow` after each production deploy.

- To measure a URL by hand, run `vp run measure` in this workspace with the target URL as an argument.
- The `deploy:production` task runs after `web#deploy:production` and does nothing when `TARGET_URL` is empty.
