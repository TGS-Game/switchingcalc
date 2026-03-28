from flask import Blueprint, request
from flask_jwt_extended import get_jwt_identity, jwt_required

from ..services.dashboard import calculator, holdings_summary


dashboard_bp = Blueprint("dashboard", __name__)


@dashboard_bp.get("/summary")
@jwt_required()
def summary():
    return holdings_summary(get_jwt_identity())


@dashboard_bp.get("/calculator")
@jwt_required()
def run_calculator():
    ratio = float(request.args.get("target_ratio", "80"))
    return calculator(get_jwt_identity(), ratio)
