import re

with open('new_html.html', 'r', encoding='utf-8') as f:
    new_html = f.read()

with open('index.html', 'r', encoding='utf-8') as f:
    old_html = f.read()

# Find the start of the Javascript section
script_match = re.search(r'<script>', old_html)
if script_match:
    js_content = old_html[script_match.start():]
else:
    print("Could not find <script> in index.html, aborting.")
    exit(1)

# Ensure the new HTML just prepends the JS content
with open('index_stitch.html', 'w', encoding='utf-8') as f:
    f.write(new_html + js_content)

print("Successfully generated index_stitch.html")
