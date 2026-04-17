#!/usr/bin/env python3
"""
Convert all HEIC files in folder 'z' to JPEG and delete the original HEIC files.
Usage: python convert_z_heic.py [input_folder] [output_folder]
If no arguments given, input_folder defaults to 'z' and output_folder defaults to input_folder.
"""

import sys
import os
from pathlib import Path
from PIL import Image
import pillow_heif

# Register HEIF opener once
pillow_heif.register_heif_opener()


def convert_heic_to_jpg(heic_path: Path, jpg_path: Path, delete_original: bool = True) -> bool:
    """
    Convert a single HEIC file to JPEG. Optionally delete the original HEIC.
    
    Returns:
        bool: True if conversion succeeded (and deletion if requested), False otherwise.
    """
    try:
        with Image.open(heic_path) as img:
            rgb_img = img.convert("RGB")
            rgb_img.save(jpg_path, "JPEG")
        print(f"✔ Converted: {heic_path.name} -> {jpg_path.name}")
        
        if delete_original:
            heic_path.unlink()  # Delete the original HEIC file
            print(f"   Deleted original: {heic_path.name}")
        return True
    except Exception as e:
        print(f"✘ Failed: {heic_path.name} - {e}")
        return False


def process_folder(input_folder: Path, output_folder: Path = None, delete_original: bool = True):
    """
    Recursively find all .heic files in input_folder and convert them to JPEG.
    If output_folder is None, save JPEGs alongside the originals.
    """
    if output_folder is None:
        output_folder = input_folder
    else:
        output_folder.mkdir(parents=True, exist_ok=True)

    # Find all .heic files (case‑insensitive)
    heic_files = list(input_folder.rglob("*.[hH][eE][iI][cC]"))
    if not heic_files:
        print(f"No HEIC files found in '{input_folder}'")
        return

    print(f"Found {len(heic_files)} HEIC file(s). Converting...")
    for heic_path in heic_files:
        # Determine output path: same relative path but with .jpg extension
        if output_folder == input_folder:
            jpg_path = heic_path.with_suffix(".jpg")
        else:
            rel_path = heic_path.relative_to(input_folder)
            jpg_path = output_folder / rel_path.with_suffix(".jpg")
            jpg_path.parent.mkdir(parents=True, exist_ok=True)

        convert_heic_to_jpg(heic_path, jpg_path, delete_original)


def main():
    # Default input folder is 'z' (in current working directory)
    input_folder = Path("z")
    output_folder = None

    if len(sys.argv) > 1:
        input_folder = Path(sys.argv[1])
    if len(sys.argv) > 2:
        output_folder = Path(sys.argv[2])

    if not input_folder.exists():
        print(f"Error: Input folder '{input_folder}' does not exist.")
        sys.exit(1)

    # Delete originals by default; set to False if you want to keep them
    process_folder(input_folder, output_folder, delete_original=True)


if __name__ == "__main__":
    main()