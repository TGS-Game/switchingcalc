from flask import Blueprint, request
from app.models.models import db, User
from app.services.auth import hash_password, verify_password, generate_totp_secret, verify_totp
from flask_jwt_extended import create_access_token

auth_bp = Blueprint("auth", __name__, url_prefix="/api/auth")


@auth_bp.post("/register")
def register():
    data = request.get_json()
    user = User(email=data["email"], password_hash=hash_password(data["password"]))
    db.session.add(user)
    db.session.commit()
    return {"id": str(user.id), "email": user.email}, 201


@auth_bp.post("/login")
def login():
    data = request.get_json()
    user = User.query.filter_by(email=data["email"]).first()

    if not user or not verify_password(data["password"], user.password_hash):
        return {"msg": "Invalid credentials"}, 401

    token = create_access_token(identity=str(user.id))
    return {"access_token": token}
