from flask import Blueprint, request
from flask_jwt_extended import get_jwt_identity, jwt_required

from .. import db
from ..models.models import AlertRule
from ..schemas.common import AlertRuleSchema


alerts_bp = Blueprint("alerts", __name__)
alert_schema = AlertRuleSchema()
alert_list_schema = AlertRuleSchema(many=True)


@alerts_bp.get("")
@jwt_required()
def list_alerts():
    user_id = get_jwt_identity()
    rules = AlertRule.query.filter_by(user_id=user_id).order_by(AlertRule.created_at.desc()).all()
    return alert_list_schema.dump(rules)


@alerts_bp.post("")
@jwt_required()
def create_alert():
    user_id = get_jwt_identity()
    data = request.get_json()
    rule = AlertRule(user_id=user_id, target_ratio=data["target_ratio"], direction=data.get("direction", "above"))
    db.session.add(rule)
    db.session.commit()
    return alert_schema.dump(rule), 201
