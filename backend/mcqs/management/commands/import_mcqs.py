import os
import json
from django.core.management.base import BaseCommand
from mcqs.models import MCQSet, MCQ, Option


class Command(BaseCommand):
    help = "Import multiple MCQ JSON files based on decoder.json mapping"

    def add_arguments(self, parser):
        parser.add_argument(
            'data_dir',
            type=str,
            help='Path to the directory containing decoder.json and MCQ JSON files'
        )

    def handle(self, *args, **kwargs):
        data_dir = kwargs['data_dir']
        decoder_path = os.path.join(data_dir, 'decoder.json')

        # Load decoder file
        with open(decoder_path, 'r', encoding='utf-8') as f:
            decoder = json.load(f)

        total_imported = 0

        # Loop through all entries in decoder.json
        for key, title in decoder.items():
            file_path = os.path.join(data_dir, f"{key}.json")
            if not os.path.exists(file_path):
                self.stdout.write(self.style.WARNING(f"⚠️ File not found: {file_path}"))
                continue

            # Create or get MCQSet for this file
            mcq_set, _ = MCQSet.objects.get_or_create(title=title)

            # Load the question data
            with open(file_path, 'r', encoding='utf-8') as f:
                questions = json.load(f)

            # Insert MCQs
            for q_id, q_data in questions.items():
                mcq = MCQ.objects.create(
                    mcq_set=mcq_set,
                    question=q_data["QUESTION"],
                    mcq_type="True/False",
                    explanation=q_data.get("EXPLANATION", "")
                )

                for key_opt, text in q_data["OPTION"].items():
                    is_correct = key_opt in q_data.get("TRUE", [])
                    Option.objects.create(
                        mcq=mcq,
                        key=key_opt,
                        text=text,
                        is_correct=is_correct
                    )

            total_imported += len(questions)
            self.stdout.write(self.style.SUCCESS(f"✅ Imported {len(questions)} questions from {file_path}"))

        self.stdout.write(self.style.SUCCESS(f"\n🎉 All done! Total questions imported: {total_imported}"))
