# Wheelhouse LivePro Training

Staff enter their name to watch the three LivePro lessons. Management at `/dashboard` shows watch progress by lesson and can remove entries.

## Deploy to Vercel

1. In Vercel, import this GitHub repository as a Next.js project.
2. In Vercel Marketplace, provision and connect an Upstash Redis database for this project. It supplies `UPSTASH_REDIS_REST_URL` and `UPSTASH_REDIS_REST_TOKEN`.
3. Add a private `TRAINING_ADMIN` environment variable in Vercel for the Management password, then deploy. Keep all three values out of GitHub.
4. Open the Vercel deployment URL, enter a test viewer name, and check that playback appears in Management. Remove the test entry with ×.

The Vercel deployment starts with an empty watch history. Records from the previous D1 database are stored separately. No database schema setup is needed for Redis.
