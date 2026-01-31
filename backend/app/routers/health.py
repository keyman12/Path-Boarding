from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session
from sqlalchemy import text

from app.core.deps import get_db

router = APIRouter()


@router.get("")
async def health_check(db: Session = Depends(get_db)):
    """Health check; includes DB connectivity."""
    try:
        db.execute(text("SELECT 1"))
        db_ok = True
    except Exception:
        db_ok = False
    return {
        "status": "ok",
        "database": "connected" if db_ok else "disconnected",
    }
