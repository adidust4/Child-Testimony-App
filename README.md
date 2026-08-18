# How to run

## Local

To run the frontend:

```
cd frontend
npm run dev
```

To run the backend:

```
cd backend
.\.venv\Scripts\activate
uvicon main:app
```

if `uvicorn` part doesn't work, use `python -m uvicorn main:app --reload`

open http://localhost:3000 on your browser