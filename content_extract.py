import os

# ===== USER INPUT HERE =====
FILES_TO_COLLECT = [
    "backend/accounts/views.py",
    "backend/accounts/urls.py",
    "backend/accounts/admin.py",
    "backend/accounts/serializers.py",
    "backend/accounts/models.py",
    "backend/accounts/tokens.py",
    "backend/accounts/utils.py",
    "frontend/src/pages/accounts/ForgotPassword.jsx",
    "frontend/src/pages/accounts/MyProfile.jsx",
    "frontend/src/pages/accounts/ResetPassword.jsx",
    "frontend/src/pages/accounts/UserProfile.jsx",
    "frontend/src/pages/accounts/Signup.jsx",
    "frontend/src/pages/accounts/Login.jsx",
    "frontend/src/App.jsx",
    
    "backend/backend/settings.py",
    "backend/backend/urls.py"

    "backend/osces/views.py",
    "backend/osces/urls.py",
    "backend/osces/admin.py",
    "backend/osces/serializers.py",
    "backend/osces/models.py",    
    

    "backend/contests/views.py",
    "backend/contests/urls.py",
    "backend/contests/admin.py",
    "backend/contests/serializers.py",
    "backend/contests/models.py",

    "backend/mcqs/views.py",
    "backend/mcqs/urls.py",
    "backend/mcqs/admin.py",
    "backend/mcqs/serializers.py",
    "backend/mcqs/models.py",

    "backend/flashcards/views.py",
    "backend/flashcards/urls.py",
    "backend/flashcards/admin.py",
    "backend/flashcards/serializers.py",
    "backend/flashcards/models.py",

    "backend/notes/views.py",
    "backend/notes/urls.py",
    "backend/notes/admin.py",
    "backend/notes/serializers.py",
    "backend/notes/models.py",

    "backend/contests/views.py",
    "backend/contests/urls.py",
    "backend/contests/admin.py",
    "backend/contests/serializers.py",
    "backend/contests/models.py",

    "backend/feed/views.py",
    "backend/feed/urls.py",
    "backend/feed/admin.py",
    "backend/feed/serializers.py",
    "backend/feed/models.py",

    "backend/subscriptions/views.py",
    "backend/subscriptions/urls.py",
    "backend/subscriptions/admin.py",
    "backend/subscriptions/serializers.py",
    "backend/subscriptions/paystack_service.py",
    "backend/subscriptions/permission.py",
    "backend/subscriptions/middleware.py",
    "backend/subscriptions/models.py",


    "frontend/src/apis/feed.js",
    "frontend/src/apis/osces.js",
    "frontend/src/apis/mcqs.js",
    "frontend/src/apis/flashcards.js",
    "frontend/src/apis/notes.js",
    "frontend/src/apis/subscriptions.js",
    "frontend/src/components/FeedItem.jsx",
    "frontend/src/App.jsx",
    "frontend/src/App.css",
    "frontend/src/index.css",
    "frontend/src/main.jsx",
    "frontend/src/pages/Feeds.jsx",
    "frontend/src/pages/subscription/PaymentSuccess.jsx",
    "frontend/src/pages/Subscription.jsx",
    "frontend/src/pages/resources/MCQDetail.jsx",
    "frontend/src/pages/resources/NoteDetail.jsx",
    "frontend/src/pages/resources/OSCEDetail.jsx",


    "frontend/src/pages/resources/MCQSet.jsx",
    "frontend/src/pages/resources/ResourceFilter.jsx",
    "frontend/src/pages/resources/NoteSet.jsx",
    "frontend/src/pages/resources/FlashcardSet.jsx",
    "frontend/src/pages/resources/OSCESet.jsx",

    "frontend/src/context/AccountsContext.jsx",
    "frontend/src/components/DataTable.jsx",
    "frontend/src/pages/Contest.jsx",
    "frontend/src/pages/ContestTake.jsx",
    "frontend/src/pages/ContestAnswers.jsx",

    "frontend/src/pages/resources/ResourceFilter.jsx",

    "backend/templates/admin/osce_upload_json.html",
    "backend/templates/admin/flashcard_upload_json.html",
    "backend/templates/admin/note_upload_document.html"

    
]

OUTPUT_FILE = "extracted.txt"
# ===========================


def find_file(root, filename):
    """Search for a unique file by name"""
    matches = []
    for dirpath, _, filenames in os.walk(root):
        if filename in filenames:
            matches.append(os.path.join(dirpath, filename))
    return matches


def write_file_content(file_path, out):
    out.write("=" * 40 + "\n")
    out.write(f"FILE: {os.path.basename(file_path)}\n")
    out.write(f"PATH: {file_path}\n")
    out.write("=" * 40 + "\n")

    try:
        with open(file_path, "r", encoding="utf-8", errors="ignore") as f:
            out.write(f.read())
    except Exception as e:
        out.write(f"[ERROR READING FILE: {e}]\n")

    out.write("\n\n")


def main():
    root_dir = os.getcwd()

    with open(OUTPUT_FILE, "w", encoding="utf-8") as out:
        for item in FILES_TO_COLLECT:
            # Case 1: path exists as provided
            if os.path.isfile(item):
                write_file_content(item, out)

            # Case 2: filename only → search project
            else:
                matches = find_file(root_dir, item)

                if len(matches) == 1:
                    write_file_content(matches[0], out)
                elif len(matches) > 1:
                    out.write(f"[AMBIGUOUS FILE NAME: {item}]\n")
                    for m in matches:
                        out.write(f" - {m}\n")
                    out.write("\n\n")
                else:
                    out.write(f"[FILE NOT FOUND: {item}]\n\n")

    print(f"Done ✅ Contents saved to '{OUTPUT_FILE}'")


if __name__ == "__main__":
    main()
