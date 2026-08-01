from fastapi import FastAPI

app = FastAPI(title="WealthPilot AI Service")


@app.get("/health")
def health() -> dict[str, str]:
    return {"status": "ok", "service": "ai-service"}
