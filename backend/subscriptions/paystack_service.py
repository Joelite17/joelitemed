import requests
from django.conf import settings
from django.utils import timezone
import logging

logger = logging.getLogger(__name__)

class PaystackService:
    """Encapsulate all Paystack API interactions"""
    
    def __init__(self):
        self.secret_key = settings.PAYSTACK_SECRET_KEY
        self.public_key = settings.PAYSTACK_PUBLIC_KEY
        self.base_url = "https://api.paystack.co"
    
    def _make_request(self, method, endpoint, data=None):
        """Generic request method"""
        url = f"{self.base_url}/{endpoint}"
        headers = {
            "Authorization": f"Bearer {self.secret_key}",
            "Content-Type": "application/json",
        }
        
        try:
            logger.info(f"Paystack API Request: {method} {url}")
            if data:
                logger.info(f"Request data: {data}")
            
            if method == 'POST':
                response = requests.post(url, json=data, headers=headers, timeout=30)
            elif method == 'GET':
                response = requests.get(url, headers=headers, timeout=30)
            else:
                raise ValueError(f"Unsupported method: {method}")
            
            logger.info(f"Paystack API Response Status: {response.status_code}")
            logger.info(f"Paystack API Response: {response.text[:500]}")
            
            response.raise_for_status()
            return response.json()
        except requests.exceptions.Timeout:
            logger.error("Paystack API timeout")
            raise Exception("Payment gateway timeout. Please try again.")
        except requests.exceptions.RequestException as e:
            logger.error(f"Paystack API error: {str(e)}")
            if hasattr(e, 'response') and e.response:
                logger.error(f"Response: {e.response.text}")
                try:
                    error_data = e.response.json()
                    return {"status": "error", "message": error_data.get('message', str(e))}
                except:
                    pass
            raise Exception(f"Payment gateway error: {str(e)}")
        except Exception as e:
            logger.error(f"Unexpected Paystack error: {str(e)}")
            raise
    
    def initialize_transaction(self, email, amount, reference, callback_url=None):
        """Initialize Paystack payment"""
        # Validate email
        if not email or '@' not in email:
            raise ValueError(f"Invalid email address: {email}")
        
        # Ensure amount is an integer in kobo
        try:
            amount_in_kobo = int(amount)
            if amount_in_kobo < 100:  # Paystack minimum
                raise ValueError(f"Amount too small: {amount_in_kobo} kobo (minimum: 100 kobo)")
        except (ValueError, TypeError):
            raise ValueError(f"Invalid amount: {amount}")
        
        data = {
            "email": email.strip().lower(),
            "amount": amount_in_kobo,
            "reference": reference,
            "callback_url": callback_url or f"{settings.FRONTEND_URL}/payment/verify/{reference}",
            "metadata": {
                "cancel_action": f"{settings.FRONTEND_URL}/subscription/plans",
                "custom_fields": [
                    {
                        "display_name": "Transaction Reference",
                        "variable_name": "transaction_reference",
                        "value": reference
                    }
                ]
            }
        }
        
        logger.info(f"Initializing transaction: Email={email}, Amount={amount_in_kobo} kobo, Ref={reference}")
        result = self._make_request('POST', 'transaction/initialize', data)
        
        if result.get('status') == False:
            error_message = result.get('message', 'Payment initialization failed')
            logger.error(f"Paystack initialization failed: {error_message}")
            raise Exception(error_message)
        
        return result.get('data', {})
    
    def verify_transaction(self, reference):
        """Verify Paystack transaction"""
        logger.info(f"Verifying transaction: {reference}")
        result = self._make_request('GET', f'transaction/verify/{reference}')
        
        if result.get('status') == False:
            error_message = result.get('message', 'Payment verification failed')
            logger.error(f"Paystack verification failed: {error_message}")
            raise Exception(error_message)
        
        return result.get('data', {})
    
    def create_subscription_plan(self, plan_data):
        """Create subscription plan on Paystack (one-time setup)"""
        result = self._make_request('POST', 'plan', plan_data)
        return result.get('data', {})
    
