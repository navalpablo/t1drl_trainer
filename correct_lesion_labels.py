#!/usr/bin/env python3
"""Lesion Label Correction Tool"""

import os
import re
import sys

class LesionLabelTool:
    def __init__(self, root_dir):
        self.root_dir = root_dir
        self.lesions = []
        
    def scan_files(self):
        """Scan all HTML files and extract lesion information"""
        self.lesions = []
        files_scanned = 0
        
        for filename in sorted(os.listdir(self.root_dir)):
            if not filename.endswith('.html') or filename == 'index.html':
                continue
            
            filepath = os.path.join(self.root_dir, filename)
            file_type = 'train' if filename.startswith('train_') else 'eval'
            
            try:
                with open(filepath, 'r', encoding='utf-8') as f:
                    content = f.read()
                
                before_count = len(self.lesions)
                
                if file_type == 'train':
                    self._extract_train_lesions(content, filename)
                else:
                    self._extract_eval_lesions(content, filename)
                
                added = len(self.lesions) - before_count
                files_scanned += 1
                print(f"  {filename}: found {added} lesions")
                
            except Exception as e:
                print(f"  Error reading {filename}: {e}")
        
        print(f"\nTotal: {len(self.lesions)} lesions in {files_scanned} files")
    
    def _extract_train_lesions(self, content, filename):
        """Extract lesions from training files"""
        lines = content.split('\n')
        
        for i, line in enumerate(lines):
            h3_match = re.search(r'<h3>(\d+)\.(?:&nbsp;|\s+)([A-Za-z0-9_]+)', line)
            if h3_match:
                num = h3_match.group(1)
                lesion_id = h3_match.group(2)
                
                label = None
                for j in range(i, min(i+5, len(lines))):
                    badge_match = re.search(r'class="badge (true|false)"', lines[j])
                    if badge_match:
                        label = badge_match.group(1).capitalize()
                        break
                
                if label:
                    self.lesions.append({
                        'file': filename,
                        'type': 'train',
                        'number': int(num),
                        'lesion_id': lesion_id,
                        'label': label
                    })
    
    def _extract_eval_lesions(self, content, filename):
        """Extract lesions from evaluation files"""
        sections = content.split('<div class="lesion-container"')
        
        for section in sections[1:]:
            gold_match = re.search(r'data-gold="(True|False)"', section)
            h3_match = re.search(r'<h3>(\d+)\.(?:&nbsp;|\s+)([A-Za-z0-9_]+)', section)
            
            if gold_match and h3_match:
                self.lesions.append({
                    'file': filename,
                    'type': 'eval',
                    'number': int(h3_match.group(1)),
                    'lesion_id': h3_match.group(2),
                    'label': gold_match.group(1)
                })
    
    def list_lesions(self, filter_text=None, filter_label=None):
        """List all lesions with optional filtering"""
        filtered = self.lesions
        
        if filter_text:
            filtered = [l for l in filtered if filter_text.lower() in l['lesion_id'].lower()]
        
        if filter_label:
            filtered = [l for l in filtered if l['label'].lower() == filter_label.lower()]
        
        if not filtered:
            print("\nNo lesions found matching the criteria.")
            return []
        
        print(f"\n{'#':<6} {'File':<18} {'Type':<7} {'Lesion ID':<20} {'Label':<10}")
        print("-" * 70)
        
        for i, lesion in enumerate(filtered, 1):
            print(f"{i:<6} {lesion['file']:<18} {lesion['type']:<7} "
                  f"{lesion['lesion_id']:<20} {lesion['label']:<10}")
        
        return filtered
    
    def correct_label(self, lesion_id, new_label):
        """Correct the label for a specific lesion"""
        new_label = new_label.capitalize()
        if new_label not in ['True', 'False']:
            print(f"Error: Label must be 'True' or 'False'")
            return False
        
        matches = [l for l in self.lesions if l['lesion_id'] == lesion_id]
        
        if not matches:
            print(f"Error: Lesion ID '{lesion_id}' not found")
            return False
        
        print(f"\nFound {len(matches)} occurrence(s):")
        
        for lesion in matches:
            if lesion['label'] == new_label:
                print(f"  ✓ {lesion['file']}: Already {new_label}")
                continue
            
            filepath = os.path.join(self.root_dir, lesion['file'])
            
            try:
                with open(filepath, 'r', encoding='utf-8') as f:
                    content = f.read()
                
                original = content
                
                if lesion['type'] == 'train':
                    pattern = (rf'(<h3>{lesion["number"]}\.(?:&nbsp;|\s+){re.escape(lesion["lesion_id"])}.*?'
                              rf'<span class="badge )(true|false)(">.*?)(TRUE|FALSE)( lesion)')
                    
                    new_class = new_label.lower()
                    new_text = new_label.upper()
                    
                    def replace_train(m):
                        return f'{m.group(1)}{new_class}{m.group(3)}{new_text}{m.group(5)}'
                    
                    content = re.sub(pattern, replace_train, content, flags=re.DOTALL)
                
                else:
                    # Simpler pattern - just find and replace the data-gold value near the lesion
                    # Look for the data-gold line that comes before this specific lesion
                    lines = content.split('\n')
                    new_lines = []
                    found = False
                    
                    for i, line in enumerate(lines):
                        # Check if this line has our lesion heading
                        if f'<h3>{lesion["number"]}.&nbsp;{lesion["lesion_id"]}</h3>' in line:
                            # Now look backwards for the data-gold attribute (should be within 10 lines)
                            for j in range(max(0, i-10), i):
                                if 'data-gold=' in lines[j]:
                                    # Replace the data-gold value
                                    old_line = lines[j]
                                    new_line = re.sub(r'data-gold="(True|False)"', f'data-gold="{new_label}"', old_line)
                                    if new_line != old_line:
                                        lines[j] = new_line
                                        found = True
                                    break
                            break
                    
                    if found:
                        content = '\n'.join(lines)
                
                if content != original:
                    with open(filepath, 'w', encoding='utf-8') as f:
                        f.write(content)
                    print(f"  ✓ {lesion['file']}: Changed {lesion['label']} → {new_label}")
                    lesion['label'] = new_label
                else:
                    print(f"  ⚠ {lesion['file']}: Pattern not found")
                    
            except Exception as e:
                print(f"  ✗ {lesion['file']}: Error - {e}")
        
        return True
    
    def interactive_mode(self):
        """Run in interactive mode"""
        while True:
            print("\n" + "=" * 70)
            print("Lesion Label Correction Tool")
            print("=" * 70)
            print("\nOptions:")
            print("  1. List all lesions")
            print("  2. Search by lesion ID")
            print("  3. Filter by label (True/False)")
            print("  4. Correct a label")
            print("  5. Rescan files")
            print("  6. Exit")
            
            choice = input("\nChoose an option (1-6): ").strip()
            
            if choice == '1':
                self.list_lesions()
            
            elif choice == '2':
                search = input("Enter lesion ID (or part): ").strip()
                self.list_lesions(filter_text=search)
            
            elif choice == '3':
                label = input("Filter by label (True/False): ").strip()
                self.list_lesions(filter_label=label)
            
            elif choice == '4':
                lesion_id = input("Enter lesion ID: ").strip()
                new_label = input("Enter new label (True/False): ").strip()
                
                confirm = input(f"Change '{lesion_id}' to '{new_label}'? (yes/no): ").strip().lower()
                if confirm == 'yes':
                    self.correct_label(lesion_id, new_label)
            
            elif choice == '5':
                print("\nRescanning files...")
                self.scan_files()
            
            elif choice == '6':
                print("Goodbye!")
                break

def main():
    root_dir = sys.argv[1] if len(sys.argv) > 1 else os.getcwd()
    
    if not os.path.exists(root_dir):
        print(f"Error: Directory not found: {root_dir}")
        sys.exit(1)
    
    print(f"Working directory: {root_dir}\n")
    print("Scanning files...")
    
    tool = LesionLabelTool(root_dir)
    tool.scan_files()
    
    tool.interactive_mode()

if __name__ == "__main__":
    main()
