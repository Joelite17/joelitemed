import os
import base64
import pickle
from email.mime.text import MIMEText
from googleapiclient.discovery import build
from google.auth.transport.requests import Request


def send_gmail_api_email(to_email, subject, message_text):
    creds = None

    # Load existing token
    if os.path.exists("token.pickle"):
        with open("token.pickle", "rb") as token:
            creds = pickle.load(token)

    # Refresh token if expired
    if creds and creds.expired and creds.refresh_token:
        creds.refresh(Request())
        with open("token.pickle", "wb") as token:
            pickle.dump(creds, token)

    if not creds:
        print("No valid credentials found.")
        return

    try:
        service = build("gmail", "v1", credentials=creds)

        message = MIMEText(message_text)
        message["to"] = to_email
        message["from"] = "chinedujosiahstu@gmail.com"  # MUST match authenticated account
        message["subject"] = subject

        raw = base64.urlsafe_b64encode(message.as_bytes()).decode()
        body = {"raw": raw}

        sent_message = service.users().messages().send(
            userId="me",
            body=body
        ).execute()

        print("\n✅ Email sent successfully!")
        print("Message ID:", sent_message["id"])
        print("Thread ID:", sent_message["threadId"])
        print("Labels:", sent_message.get("labelIds"))

    except Exception as e:
        print("\n❌ Error sending email:")
        print(e)


# TEST
send_gmail_api_email(
    "chinedujosiah123@gmail.com",
    "Test Email From Gmail API",
    "Hello Chinedu,\n\nThis is a real Gmail API test email.\n\nRegards."
)