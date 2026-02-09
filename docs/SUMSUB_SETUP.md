# SumSub Identity Verification Setup

This guide explains how to configure SumSub identity verification for the Path Boarding application.

## Overview

SumSub is integrated for identity verification (passport/driving license + selfie). The integration:
- Is embedded directly on Step 3 of the boarding flow
- Uses the SumSub WebSDK (React component)
- Doesn't pre-fill any data (SumSub scans documents and extracts information)
- Tracks verification status in the database
- Automatically moves users to Step 4 (Business Info) upon successful verification

## Configuration

### 1. Add SumSub Credentials to Backend

Add these environment variables to your `backend/.env` file:

```bash
# SumSub Identity Verification
SUMSUB_APP_TOKEN=sbx:fWhbDJF496mJVNzFSfMrLN3y.n32nzimHLF0A6X28chK5CdqIlROGno0m
SUMSUB_SECRET_KEY=DlStPb45wems1EX4Z5CGOhmKQknOolXg
SUMSUB_BASE_URL=https://api.sumsub.com
SUMSUB_LEVEL_NAME=basic-kyc-level
```

**Note:** The credentials above are for the **sandbox environment**. For production:
1. Go to the [SumSub Dashboard](https://cockpit.sumsub.com/)
2. Create production credentials (without `sbx:` prefix)
3. Update the level name to match your SumSub configuration

### 2. Run Database Migration

The integration requires new database fields to track verification status:

```bash
cd backend
source venv/bin/activate  # or source ../venv/bin/activate if using shared venv
alembic upgrade head
deactivate
```

### 3. Install Frontend Dependencies

The frontend uses the `@sumsub/websdk-react` package (already in package.json):

```bash
cd frontend
npm install
```

## Testing Locally

### 1. Start Backend

```bash
cd backend
source venv/bin/activate
uvicorn app.main:app --reload --port 8000
```

### 2. Start Frontend

```bash
cd frontend
npm run dev
```

### 3. Test the Flow

1. Go to `http://localhost:3000/boarding-api`
2. Create a new boarding invite
3. Go through the boarding flow:
   - Step 1: Create account
   - Step 2: Personal details
   - Step 3: Click "Start Verification"
4. The SumSub widget will appear - follow the on-screen instructions
5. After completion, you should be automatically redirected to Step 4

### Test Documents for Sandbox

In sandbox mode, SumSub provides test documents you can use. Refer to the [SumSub documentation](https://docs.sumsub.com/docs/test-mode) for sample documents and test data.

## API Endpoints

### Generate Access Token

**POST** `/boarding/sumsub/generate-token?token={invite_token}`

Generates a SumSub access token for the current user. Called automatically when user clicks "Start Verification".

**Response:**
```json
{
  "token": "act-...",
  "user_id": "boarding-event-id"
}
```

### Complete Verification

**POST** `/boarding/sumsub/complete?token={invite_token}&status={completed|rejected}`

Marks verification as complete. Called automatically by the frontend after SumSub callback.

**Response:**
```json
{
  "success": true,
  "status": "completed",
  "next_step": "step4"
}
```

## User Flow

### Success Path

1. User clicks "Start Verification" on Step 3
2. Backend generates SumSub access token
3. SumSub widget loads in iframe
4. User uploads document and takes selfie
5. SumSub processes verification
6. Frontend receives success callback
7. Backend updates status to "completed"
8. User sees success message
9. Auto-redirect to Step 4 after 2 seconds

### Failure Path

1-5. Same as success path
6. SumSub rejects verification
7. User sees rejection message with reasons:
   - Document quality issues
   - Document expiration
   - Photo clarity concerns
8. User can click "Try Again" to restart
9. Support email provided for assistance

## Database Schema

New fields added to `boarding_contact` table:

- `sumsub_applicant_id` (String, nullable): SumSub applicant ID
- `sumsub_verification_status` (String, nullable): "pending", "completed", or "rejected"

## Production Deployment

When deploying to production:

1. **Update credentials** in `/opt/boarding/backend.env` on AWS:
   ```bash
   SUMSUB_APP_TOKEN=your-production-token
   SUMSUB_SECRET_KEY=your-production-secret
   SUMSUB_LEVEL_NAME=your-level-name
   ```

2. **Run migration** on AWS (see `docs/AWS_UPDATE_STEPS.md`):
   ```bash
   cd /opt/boarding/repo/backend
   export $(grep -v '^#' /opt/boarding/backend.env | xargs)
   alembic upgrade head
   ```

3. **Update frontend and restart services** (see `docs/AWS_UPDATE_STEPS.md`)

## Webhooks (Optional)

For now, verification status is updated via frontend callbacks. For production, you may want to configure SumSub webhooks:

1. In SumSub Dashboard, configure webhook URL: `https://boarding.path2ai.tech/api/sumsub/webhook`
2. Add webhook endpoint to `backend/app/routers/boarding.py`
3. Verify webhook signature for security
4. Update verification status server-side

This provides redundancy in case the user closes their browser before the frontend callback completes.

## Troubleshooting

### "Identity verification is not configured"

- Check that `SUMSUB_APP_TOKEN` and `SUMSUB_SECRET_KEY` are set in backend/.env
- Restart the backend service

### "Failed to generate verification token"

- Check backend logs for detailed error
- Verify credentials are correct (sandbox tokens start with `sbx:`)
- Ensure SumSub level name matches your dashboard configuration

### SumSub widget not loading

- Check browser console for errors
- Verify access token was generated successfully
- Check network tab to see if iframe is blocked

### Verification status not updating

- Check frontend callbacks in browser console
- Verify `/boarding/sumsub/complete` endpoint is reachable
- Check backend logs for errors

## Support

For SumSub-specific issues, refer to:
- [SumSub Documentation](https://docs.sumsub.com/)
- [SumSub Developer Hub](https://developers.sumsub.com/)
- SumSub Support: support@sumsub.com
