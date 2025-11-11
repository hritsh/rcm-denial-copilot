# RCM Denial Copilot

a quick project i hacked together in a weekend to explore the capabilities of llms in the revenue cycle management space. it uses a fastapi backend (making calls to the gemini api) and a react frontend to assist medical billers in analyzing and addressing claim denials and automating the process where possible.

## stuff used

- [this dataset](https://www.kaggle.com/datasets/abuthahir1998/synthetic-healthcare-claims-dataset) i found on kaggle that had synthetic medical claim data with denial info which was super helpful to populate the database cause i didnt have to make up my own

| Column Name          | Description                                                                         |
| -------------------- | ----------------------------------------------------------------------------------- |
| -------------------- | -----------------------------------------------------------------------------       |
| Claim ID             | Unique identifier for each claim.                                                   |
| Provider ID          | Unique identifier for the healthcare provider submitting the claim.                 |
| Patient ID           | Unique identifier for the patient (randomly generated).                             |
| Date of Service      | The date when the healthcare service was provided.                                  |
| Procedure Code       | The code representing the medical procedure or service rendered.                    |
| Diagnosis Code       | International Classification of Diseases code representing the patient’s diagnosis. |
| Charge Amount        | The total amount billed for the service by the provider.                            |
| Paid Amount          | The amount paid by the insurer or patient for the claim.                            |
| Insurance Type       | The type of insurance coverage (e.g., Private, Medicare, Medicaid).                 |
| Claim Status         | The current status of the claim (e.g., Paid, Denied, Partially Paid).               |
| Reason Code          | Code representing the reason for claim denial or payment adjustment.                |
| Follow-up Required   | Indicates whether follow-up actions are required to resolve the claim.              |
| AR Status            | Accounts Receivable status for the claim (e.g., Open, Closed).                      |
| Outcome              | Final outcome of the claim (e.g., Paid, Denied, Partial).                           |

- [fastapi](https://fastapi.tiangolo.com/) for the backend api that serves claim data and makes calls to the gemini api
- [uvicorn](https://www.uvicorn.org/) for running the fastapi server
- [gemini api](https://developers.generativeai.google/products/gemini) for analyzing claim denials and translating medical codes
- [react + vite + typescript](https://vitejs.dev/guide/) for the frontend
- [shadcn/ui](https://shadcn.com/ui) with tailwind for some prebuilt react components to build the frontend quickly

## features

- view all claim data in a table with all fields layed out
- sort and filter claims by different columns
- translate procedure and diagnosis codes to human readable names using gemini api
- manually analyze claim denials with ai assistance in a modal view
  - recommends root cause, immediate fix, and prevention plan for each denial
  - shows recommended team to send the fix to (eg coding, billing, etc)
  - shows a call script to use when contacting the payer
- an autonomous mode where the app steps through all denied claims one by one, analyzes them using the gemini api, and presents the biller with ai generated immediate fixes to approve or skip
  - allows billers to quickly process large volumes of denied claims with ai assistance
  - helps reduce manual effort and speeds up denial resolution
  - future steps could include auto-submitting approved fixes back to the payer system

## setup instructions

### backend

1. cd into the `backend` folder
2. create a virtual environment (i used uv): `uv venv venv`
3. activate the virtual environment:
   - on mac/linux: `source venv/bin/activate`
   - on windows: `venv\Scripts\activate`
4. install dependencies: `pip install -r requirements.txt`
5. copy the `.env.example` file to `.env` and add your gemini api key
6. run the backend server: `uv run main.py`
7. the backend api will be running at `http://0.0.0.0:8000`

### frontend

1. cd into the `frontend` folder
2. install dependencies: `npm install`
3. run the frontend dev server: `npm run dev`
4. the frontend app will be running at `http://localhost:5173`
