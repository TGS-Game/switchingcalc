import os
from datetime import timedelta

from flask import Flask
from flask_cors import CORS
from flask_jwt_extended import JWTManager
from flask_marshmallow import Marshmallow
from flask_sqlalchemy import SQLAlchemy


db = SQLAlchemy()
jwt = JWTManager()
ma = Marshmallow()


def create_app():
    app = Flask(__name__)

    app.config["SQLALCHEMY_DATABASE_URI"] = os.getenv("DATABASE_URL", "postgresql://postgres:postgres@db:5432/metals")
    app.config["SQLALCHEMY_TRACK_MODIFICATIONS"] = False
    app.config["JWT_SECRET_KEY"] = os.getenv("JWT_SECRET_KEY", "super-secret-jwt-key-please-change-this-1234567890")
    app.config["SECRET_KEY"] = os.getenv("SECRET_KEY", "super-secret-flask-key-please-change-this-1234567890")
    app.config["JWT_ACCESS_TOKEN_EXPIRES"] = timedelta(hours=8)

    db.init_app(app)
    jwt.init_app(app)
    ma.init_app(app)

    CORS(
        app,
        resources={r"/api/*": {"origins": "*"}},
        supports_credentials=False,
    )

    from .api.auth import auth_bp
    from .api.dashboard import dashboard_bp
    from .api.reconciliation import reconciliation_bp
    from .api.uploads import uploads_bp
    from .api.transactions import transactions_bp
    from .api.dev import dev_bp
    from .api.admin import admin_bp
    from .api.account import account_bp

    app.register_blueprint(auth_bp, url_prefix="/api/auth")
    app.register_blueprint(dashboard_bp, url_prefix="/api/dashboard")
    app.register_blueprint(reconciliation_bp, url_prefix="/api/reconciliation")
    app.register_blueprint(uploads_bp, url_prefix="/api/uploads")
    app.register_blueprint(transactions_bp, url_prefix="/api/transactions")
    app.register_blueprint(dev_bp, url_prefix="/api/dev")
    app.register_blueprint(admin_bp, url_prefix="/api/admin")
    app.register_blueprint(account_bp, url_prefix="/api/account")

    with app.app_context():
        db.create_all()

    return app

