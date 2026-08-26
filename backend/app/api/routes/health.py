from fastapi import APIRouter

router = APIRouter(
    prefix="/api",
    tags=["System"]
)


@router.get("/health")
async def health_check():
    return {
        "status": "ok",
        "service": "vmic-backend",
        "version": "0.1.0"
    }
