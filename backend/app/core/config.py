import os
from datetime import timedelta


class Config:
    SECRET_KEY = os.getenv("SECRET_KEY", "dev-secret-change-me")
    SQLALCHEMY_DATABASE_URI = os.getenv(
        "DATABASE_URL",
        "postgresql://postgres:postgres@db:5432/metals",
    )
    SQLALCHEMY_TRACK_MODIFICATIONS = False
    JWT_SECRET_KEY = os.getenv("JWT_SECRET_KEY", "jwt-secret-change-me")
    JWT_ACCESS_TOKEN_EXPIRES = timedelta(hours=12)
    MAX_CONTENT_LENGTH = 20 * 1024 * 1024
    UPLOAD_DIR = os.getenv("UPLOAD_DIR", "/tmp/uploads")
    ENABLE_2FA = os.getenv("ENABLE_2FA", "true").lower() == "true"
