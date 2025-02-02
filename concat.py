#!/usr/bin/env python3
import os
import argparse
from pathlib import Path
from typing import Set, List

# Default blacklist of file extensions and directories to ignore
DEFAULT_BLACKLIST = {
    #
    "LICENSE", ".gitignore",
    # venv
    "venv", 
    # Compiled files
    '.pyc', '.pyo', '.pyd', '.so', '.dll', '.dylib',
    '.obj', '.o', '.a', '.lib', '.out',
    # Cache directories
    '__pycache__', '.pytest_cache', '.mypy_cache',
    # Build directories
    'build', 'dist', 'node_modules',
    # IDE directories
    '.idea', '.vscode', '.vs',
    # Git directories
    '.git',
    # Package files
    '.egg-info',
    # Temporary files
    '.tmp', '.temp', '.bak', '.swp',
    # Binary and media files
    '.exe', '.bin', '.pkl', '.jpg', '.jpeg', '.png', ".csv", ".json", ".xlsx", ".ipynb",
    '.gif', '.bmp', '.ico', '.mp3', '.mp4', '.avi',
    '.mov', '.zip', '.tar', '.gz', '.7z', '.rar'
}

def should_skip_path(path: Path, blacklist: Set[str]) -> bool:
    """
    Check if a path should be skipped based on the blacklist.
    """
    # Check if any parent directory is in blacklist
    for parent in path.parents:
        if parent.name in blacklist:
            return True
            
    # Check file extension
    if path.suffix in blacklist:
        return True
        
    # Check directory name
    if path.name in blacklist:
        return True
        
    return False

def read_file_content(file_path: Path) -> str:
    """
    Read and return file content, handling different encodings.
    """
    encodings = ['utf-8', 'latin1', 'cp1252']
    
    for encoding in encodings:
        try:
            with open(file_path, 'r', encoding=encoding) as f:
                return f.read()
        except UnicodeDecodeError:
            continue
        except Exception as e:
            return f"Error reading file: {str(e)}"
    
    return "Could not read file with supported encodings"

def concat_files(base_path: Path, output_file: Path, blacklist: Set[str]) -> None:
    """
    Recursively concatenate all files from base_path into output_file.
    """
    # Get all files recursively, sorted for consistent output
    all_files: List[Path] = []
    
    for root, dirs, files in os.walk(base_path):
        root_path = Path(root)
        
        # Skip blacklisted directories
        dirs[:] = [d for d in dirs if not should_skip_path(root_path / d, blacklist)]
        
        for file in sorted(files):
            file_path = root_path / file
            if not should_skip_path(file_path, blacklist):
                all_files.append(file_path)
    
    # Sort files for consistent output
    all_files.sort()
    
    # Create output file
    with open(output_file, 'w', encoding='utf-8') as outf:
        for file_path in all_files:
            # Get relative path from base_path
            rel_path = file_path.relative_to(base_path)
            
            # Write file path as comment
            outf.write(f"##PATH> {rel_path}\n")
            
            # Write file content
            content = read_file_content(file_path)
            outf.write(content)
            
            # Add newlines between files
            outf.write("\n\n")

def main():
    parser = argparse.ArgumentParser(description='Concatenate all files in a directory recursively')
    parser.add_argument('--path', type=str, default='.',
                      help='Base path to start recursive concatenation (default: current directory)')
    parser.add_argument('--output', type=str, default='all.txt',
                      help='Output file path (default: all.txt)')
    parser.add_argument('--blacklist', type=str, nargs='*',
                      help='Additional file extensions or directory names to ignore')
                      
    args = parser.parse_args()
    
    # Convert paths to Path objects
    base_path = Path(args.path).resolve()
    output_file = Path(args.output)
    
    # Combine default blacklist with any additional items
    blacklist = DEFAULT_BLACKLIST.copy()
    if args.blacklist:
        blacklist.update(args.blacklist)
    
    print(f"Starting concatenation from: {base_path}")
    print(f"Output file will be: {output_file}")
    
    try:
        concat_files(base_path, output_file, blacklist)
        print(f"Successfully created concatenated file: {output_file}")
    except Exception as e:
        print(f"Error during concatenation: {str(e)}")
        exit(1)

if __name__ == "__main__":
    main()