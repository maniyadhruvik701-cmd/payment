import re

with open(r'd:\Website\Report\index.html', 'r', encoding='utf-8') as f:
    content = f.read()

# We need to move searchCard, actionsRow, tableCard INTO view-dashboard.
# They are currently between statusBar and app-wrapper closing.

match = re.search(r'(<!-- Lookup Input -->.*?</div>\s*)(</div><!-- /app-wrapper -->)', content, re.DOTALL)
if match:
    cards = match.group(1)
    
    # Remove them from the bottom
    content = content.replace(cards, '')
    
    # Insert them inside view-dashboard. 
    # view-dashboard ends with `</div><!-- /view-dashboard -->`
    if '</div><!-- /view-dashboard -->' in content:
        content = content.replace('</div><!-- /view-dashboard -->', cards + '\n      </div><!-- /view-dashboard -->')

# Fix app-wrapper ending to app-layout ending
content = content.replace('</div><!-- /app-wrapper -->', '    </main>\n  </div><!-- /app-layout -->')

with open(r'd:\Website\Report\index.html', 'w', encoding='utf-8') as f:
    f.write(content)

print("HTML restructured.")
