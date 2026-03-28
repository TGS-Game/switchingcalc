from .. import ma
from ..models.models import AlertRule, ReconciliationCase, Transaction


class TransactionSchema(ma.SQLAlchemyAutoSchema):
    class Meta:
        model = Transaction
        include_fk = True
        load_instance = True


class ReconciliationCaseSchema(ma.SQLAlchemyAutoSchema):
    class Meta:
        model = ReconciliationCase
        include_fk = True
        load_instance = True


class AlertRuleSchema(ma.SQLAlchemyAutoSchema):
    class Meta:
        model = AlertRule
        include_fk = True
        load_instance = True
