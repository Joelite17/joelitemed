import base64
import pickle
from decouple import config
from google.auth.transport.requests import Request
from googleapiclient.discovery import build
from email.mime.text import MIMEText

# Load credentials
token_env = config("TOKEN_PICKLE")
creds = pickle.loads(base64.b64decode(token_env))

print("Token expiry:", creds.expiry)
print("Has refresh token:", bool(creds.refresh_token))

# Try to refresh if expired
if creds.expired:
    print("Token expired – attempting refresh...")
    creds.refresh(Request())
    print("New expiry:", creds.expiry)

# Build Gmail service
service = build('gmail', 'v1', credentials=creds)

# Send a test email
msg = MIMEText("Hello, this is a test email from your Django app.")
msg['to'] = "youremail@gmail.com"        # CHANGE THIS
msg['from'] = config("DEFAULT_FROM_EMAIL")
msg['subject'] = "Gmail API Test"

raw = base64.urlsafe_b64encode(msg.as_bytes()).decode()
result = service.users().messages().send(userId='me', body={'raw': raw}).execute()
print("✅ Email sent! Message ID:", result['id'])