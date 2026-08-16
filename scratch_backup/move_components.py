import re

file_path = r"e:\Github\IIScBadmintonClub\client\src\components\pulse\FeedTab.tsx"

with open(file_path, "r", encoding="utf-8") as f:
    content = f.read()

# We want to extract the block starting at `            {!loading && displayMatches.length > 0 && (` which contains the court util.
# We also want to extract PollsSection, RivalryCards, and weeklyRecap.
# Let's locate the exact start and end.

start_str = """            {!loading && displayMatches.length > 0 && (
              <>
                <div className="mb-6 bg-white dark:bg-slate-900 rounded-3xl p-5 border border-slate-100 dark:border-slate-800 shadow-sm relative overflow-hidden">"""

end_str = """                </div>
              </div>
            )}"""

# The Search Bar starts right after that
search_bar_str = """            {/* Search Bar */}"""

start_idx = content.find(start_str)
end_idx = content.find(search_bar_str, start_idx)

if start_idx != -1 and end_idx != -1:
    extracted_block = content[start_idx:end_idx]
    
    # Remove it from the original place
    content = content[:start_idx] + content[end_idx:]
    
    # Insert it at the end of the FeedTab, just before the closing tag of the main content fragment.
    # The end of the activeTab === "announcements" ? ... : ( <> ... </>) block.
    # Let's find:
    target_end_str = """            )}
          </>
        )}
      </div>"""
      
    target_idx = content.rfind("          </>\n        )}")
    
    if target_idx != -1:
        # Insert before the `          </>`
        # Make sure we add a top margin so it's separated from the feed above it
        # Actually, let's wrap it in a div with mt-8 if we want, or just insert it directly
        modified_block = "\n            {/* --- MOVED SECTIONS --- */}\n" + extracted_block
        content = content[:target_idx] + modified_block + content[target_idx:]
        
        with open(file_path, "w", encoding="utf-8") as f:
            f.write(content)
        print("Successfully moved the components.")
    else:
        print("Could not find the target insertion point.")
else:
    print("Could not find the start or end index.")
