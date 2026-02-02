"""
Database models for persistent scenario storage.

Uses PostgreSQL via SQLAlchemy - scenarios persist across restarts
and support proper multi-user isolation.
"""

from sqlalchemy import create_engine, Column, String, Text, DateTime, Index
from sqlalchemy.ext.declarative import declarative_base
from sqlalchemy.orm import sessionmaker
from datetime import datetime
import os
import json

Base = declarative_base()


class ScenarioModel(Base):
    """
    Scenario database model.
    
    Stores complete scenario JSON with user isolation.
    """
    __tablename__ = "scenarios"
    
    # Composite primary key: user_id + scenario_id
    user_id = Column(String(255), primary_key=True, nullable=False)
    scenario_id = Column(String(255), primary_key=True, nullable=False)
    
    # Full scenario JSON
    data = Column(Text, nullable=False)
    
    # Metadata
    created_at = Column(DateTime, default=datetime.utcnow, nullable=False)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow, nullable=False)
    
    # Index for listing user's scenarios
    __table_args__ = (
        Index('idx_user_scenarios', 'user_id'),
    )


# Database connection (lazy-initialized)
_engine = None
_SessionLocal = None


def get_db_engine():
    """Get database engine, creating it if needed."""
    global _engine
    
    if _engine is not None:
        return _engine
    
    database_url = os.getenv("DATABASE_URL")
    
    if not database_url:
        raise RuntimeError(
            "DATABASE_URL not set. Required for production deployment.\n"
            "For local dev: use in-memory storage or set DATABASE_URL=postgresql://..."
        )
    
    # Railway uses 'postgres://' but SQLAlchemy 1.4+ needs 'postgresql://'
    if database_url.startswith("postgres://"):
        database_url = database_url.replace("postgres://", "postgresql://", 1)
    
    _engine = create_engine(
        database_url,
        pool_pre_ping=True,  # Verify connections before using
        pool_recycle=300,    # Recycle connections after 5 minutes
    )
    
    # Create tables if they don't exist
    Base.metadata.create_all(_engine)
    
    print(f"✓ Connected to PostgreSQL")
    return _engine


def get_session_maker():
    """Get SQLAlchemy session maker."""
    global _SessionLocal
    
    if _SessionLocal is not None:
        return _SessionLocal
    
    engine = get_db_engine()
    _SessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)
    return _SessionLocal


def get_db():
    """
    Dependency for FastAPI routes to get DB session.
    
    Usage:
        @router.get("/scenarios")
        def list_scenarios(db: Session = Depends(get_db)):
            ...
    """
    SessionLocal = get_session_maker()
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()
