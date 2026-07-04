const fs = require('fs');

const path = 'd:\\Website\\Report\\index.html';
let content = fs.readFileSync(path, 'utf8');

// We need to move searchCard, actionsRow, tableCard INTO view-dashboard.
// They are currently between statusBar and app-wrapper closing.

const match = content.match(/(<!-- Lookup Input -->[\s\S]*?<\/div>\s*)(<\/div><!-- \/app-wrapper -->)/);
if (match) {
    const cards = match[1];
    
    // Remove them from the bottom
    content = content.replace(cards, '');
    
    // Insert them inside view-dashboard. 
    // view-dashboard ends with `</div><!-- /view-dashboard -->`
    if (content.includes('</div><!-- /view-dashboard -->')) {
        content = content.replace('</div><!-- /view-dashboard -->', cards + '\n      </div><!-- /view-dashboard -->');
    }
}

// Fix app-wrapper ending to app-layout ending
content = content.replace('</div><!-- /app-wrapper -->', '    </main>\n  </div><!-- /app-layout -->');

fs.writeFileSync(path, content, 'utf8');
console.log("HTML restructured.");
