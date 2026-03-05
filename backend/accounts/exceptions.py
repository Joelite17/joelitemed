# accounts/exceptions.py
from rest_framework.exceptions import APIException

class FreeTrialExpired(APIException):
    status_code = 403
    default_detail = 'Free trial limit exceeded. Please subscribe to continue.'
    default_code = 'free_trial_expired'