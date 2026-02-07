# UK address lookup (Ideal Postcodes)

The Personal Details form supports **UK postcode address lookup**: when the user enters a valid UK postcode (and country is United Kingdom), the app fetches a list of addresses from [Ideal Postcodes](https://ideal-postcodes.co.uk/) and shows a dropdown. Selecting an address fills Address Line 1, Line 2, Town, and Postcode.

## How it works

- **Frontend:** When country is United Kingdom and the user enters a postcode (or blurs the postcode field), the frontend calls the backend `GET /boarding/address-lookup?postcode=...`. If the response is a list of addresses, a "Select your address" dropdown is shown; on selection, the form fields are filled.
- **Backend:** The backend proxies the request to the Ideal Postcodes API (`https://api.ideal-postcodes.co.uk/v1/postcodes/{postcode}`). The API key is kept server-side only. The backend maps results to `{ addressLine1, addressLine2, town, postcode }`.

## Configuration

- **`ADDRESS_LOOKUP_UK_API_KEY`** (optional). Get a key at [Ideal Postcodes](https://ideal-postcodes.co.uk/) (free trial then pay-as-you-go). **Store it in `backend/.env`** (never commit the real key). See `backend/.env.example` for the variable name.
- If the key is not set, the address-lookup endpoint returns **503** and the frontend shows that address lookup is not configured; users can still complete the form by typing their address manually.

## Updating the key / adding credits

- **Credit run out:** When your Ideal Postcodes balance is depleted, the API returns 402 with code 4020. The backend turns this into a clear 503 message: *"Address lookup credit has run out. Please add credits or update the API key in settings."* The frontend displays this so you know to add credits or generate a new key in the Ideal Postcodes dashboard and update `ADDRESS_LOOKUP_UK_API_KEY` in your backend environment.
- **Daily limit (4021):** If you hit a daily or IP limit, the message will say to try again tomorrow or increase your limit.

## Other countries

The config is structured so you can add lookup for other countries later (e.g. `ADDRESS_LOOKUP_IE_API_KEY` for Ireland). The current endpoint is UK-only; additional countries would require new env vars and backend logic.

## AWS deployment

Set `ADDRESS_LOOKUP_UK_API_KEY` in the backend environment on AWS. Ensure outbound HTTPS to `api.ideal-postcodes.co.uk` is allowed. See [DEPLOYMENT.md](DEPLOYMENT.md).

## Fallback behaviour

- No API key, or Ideal Postcodes returns an error → backend returns 503/502; frontend shows the backend message (e.g. "Address lookup not configured", "Address lookup credit has run out...", or "Could not load addresses. Please enter your address manually.").
- Invalid postcode format → backend returns 400; frontend also validates UK postcode format before calling.
- No addresses found for postcode → backend returns 200 with an empty list; frontend shows "No addresses found for this postcode." Users can always type the address manually.
