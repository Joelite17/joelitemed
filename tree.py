import os

IGNORE_FOLDERS = {"public", "node_modules", "dist", "__pycache__", ".git", "staticfiles"}
OUTPUT_FILE = "folder_structure.txt"

def print_tree(path, prefix="", file_handle=None):
    entries = sorted(os.listdir(path))
    entries = [e for e in entries if e not in IGNORE_FOLDERS]

    for index, entry in enumerate(entries):
        full_path = os.path.join(path, entry)
        connector = "└── " if index == len(entries) - 1 else "├── "
        line = prefix + connector + entry

        print(line)
        file_handle.write(line + "\n")

        if os.path.isdir(full_path):
            extension = "    " if index == len(entries) - 1 else "│   "
            print_tree(full_path, prefix + extension, file_handle)

if __name__ == "__main__":
    root_dir = os.getcwd()
    root_name = os.path.basename(root_dir) + "/"

    with open(OUTPUT_FILE, "w", encoding="utf-8") as f:
        print(root_name)
        f.write(root_name + "\n")
        print_tree(root_dir, "", f)

    print(f"\nFolder structure saved to '{OUTPUT_FILE}'")
