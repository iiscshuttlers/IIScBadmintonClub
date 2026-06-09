import re

with open("client/src/components/player-profile/PlayerProfileWidgets.tsx", "r", encoding="utf-8") as f:
    content = f.read()

# I need to add DoublesSynergyWidget.
# Let's check what components are exported.
