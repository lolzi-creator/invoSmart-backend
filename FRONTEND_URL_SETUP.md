# Frontend URL Configuration

The quote acceptance links are generated using the `FRONTEND_URL` environment variable.

## Setup Instructions

### For Production (Netlify, Vercel, etc.)

Set the `FRONTEND_URL` environment variable in your backend hosting platform:

**Example for Netlify deployment:**
```
FRONTEND_URL=https://silly-meringue-c49518.netlify.app
```

### For Local Development

Create a `.env` file in the backend root directory:

```env
FRONTEND_URL=http://localhost:5173
```

Or set it when running:

```bash
FRONTEND_URL=http://localhost:5173 npm run dev
```

## Important Notes

- The `FRONTEND_URL` should be the base URL of your frontend application (without trailing slash)
- For production, use your actual domain (e.g., `https://your-app.netlify.app`)
- The acceptance link format will be: `{FRONTEND_URL}/quotes/accept/{token}`
- After setting the environment variable, restart your backend server

## Where It's Used

- Quote creation: Generates acceptance links when quotes are created
- Email notifications: Includes the acceptance link in quote emails
- PDF generation: Includes the acceptance link and QR code in quote PDFs

