$files = @('client\src\components\QuickSettings.tsx', 'client\src\pages\ProfileSetup.tsx', 'client\src\components\players-directory\PlayerCard.tsx')

foreach ($f in $files) {
    if (Test-Path $f) {
        $content = Get-Content $f -Raw
        $content = $content -replace 'Looking for Match', 'Looking to play'
        $content = $content -replace 'Resting / Injured', 'Taking a break'
        
        # In QuickSettings and ProfileSetup, add Injured option
        if ($f -match 'QuickSettings') {
            $content = $content -replace '{ id: ''resting'', label: ''Taking a break'', color: ''text-rose-500 bg-rose-50 dark:bg-rose-950'' },', "{ id: 'resting', label: 'Taking a break', color: 'text-indigo-500 bg-indigo-50 dark:bg-indigo-950' },
    { id: 'injured', label: 'Injured', color: 'text-rose-500 bg-rose-50 dark:bg-rose-950' },"
        }
        if ($f -match 'ProfileSetup') {
            $content = $content -replace '<option value="resting">Taking a break</option>', "<option value="resting">Taking a break</option>
                <option value="injured">Injured</option>"
        }
        if ($f -match 'PlayerCard') {
            $content = $content -replace 'resting: { color: ''bg-rose-500'', pulse: ''bg-rose-400'', label: ''Taking a break'' }', "resting: { color: 'bg-indigo-500', pulse: 'bg-indigo-400', label: 'Taking a break' },
            injured: { color: 'bg-rose-500', pulse: 'bg-rose-400', label: 'Injured' }"
            
            # Add getBaseShareUrl import
            $content = $content -replace 'import { Capacitor } from "@capacitor/core";', "import { Capacitor } from "@capacitor/core";
import { getBaseShareUrl } from "@/lib/utils";"
            
            # Replace share URL
            $content = $content -replace 'const url = \/player/\;', 'const url = ${getBaseShareUrl()}/player/;'
        }
        
        Set-Content -Path $f -Value $content
    }
}
