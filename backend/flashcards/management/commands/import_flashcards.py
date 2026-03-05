import os
import json
from django.core.management.base import BaseCommand
from django.contrib.auth import get_user_model
from flashcards.models import FlashcardSet, Flashcard

User = get_user_model()

class Command(BaseCommand):
    help = "Import multiple Flashcard JSON files based on decoder.json mapping"

    def add_arguments(self, parser):
        parser.add_argument(
            "data_dir",
            type=str,
            help="Path to the directory containing decoder.json and flashcard JSON files",
        )
        parser.add_argument(
            "--username",
            type=str,
            default=None,
            help="Assign imported flashcard sets to this username (default: first superuser)",
        )

    def handle(self, *args, **kwargs):
        data_dir = kwargs["data_dir"]
        username = kwargs["username"]

        # Get user to assign flashcard sets
        if username:
            try:
                user = User.objects.get(username=username)
            except User.DoesNotExist:
                self.stdout.write(self.style.ERROR(f"User '{username}' does not exist."))
                return
        else:
            user = User.objects.filter(is_superuser=True).first()
            if not user:
                self.stdout.write(self.style.ERROR("No superuser found."))
                return

        # Load decoder file
        decoder_path = os.path.join(data_dir, "decoder.json")
        if not os.path.exists(decoder_path):
            self.stdout.write(self.style.ERROR(f"decoder.json not found in {data_dir}"))
            return

        with open(decoder_path, "r", encoding="utf-8") as f:
            decoder = json.load(f)

        total_imported = 0

        for key, title in decoder.items():
            file_path = os.path.join(data_dir, f"{key}.json")
            if not os.path.exists(file_path):
                self.stdout.write(self.style.WARNING(f"⚠️ File not found: {file_path}"))
                continue

            # Create or get FlashcardSet
            flashcard_set, _ = FlashcardSet.objects.get_or_create(user=user, title=title)

            # Load questions
            with open(file_path, "r", encoding="utf-8") as f:
                cards_data = json.load(f)

            for card_id, card in cards_data.items():
                # Convert list-type answers to HTML bullet list
                if isinstance(card["answer"], list):
                    answer_html = "<ul>\n" + "\n".join(f"<li>{item}</li>" for item in card["answer"]) + "\n</ul>"
                else:
                    answer_html = card["answer"]

                Flashcard.objects.create(
                    flashcard_set=flashcard_set,
                    question=card["question"],
                    answer=answer_html,
                    type=card.get("type", "plain"),
                )

            total_imported += len(cards_data)
            self.stdout.write(
                self.style.SUCCESS(f"✅ Imported {len(cards_data)} cards from {file_path}")
            )

        self.stdout.write(self.style.SUCCESS(f"\n🎉 All done! Total cards imported: {total_imported}"))
