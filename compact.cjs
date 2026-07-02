const fs = require('fs');
const path = require('path');

const directoryPath = path.join(__dirname, 'client/src/pages');

function compactHeroes() {
    const files = fs.readdirSync(directoryPath);
    
    files.forEach(file => {
        if (file.endsWith('.tsx')) {
            const filePath = path.join(directoryPath, file);
            let content = fs.readFileSync(filePath, 'utf8');
            let originalContent = content;

            // Reduce hero padding
            content = content.replace(/py-12 lg:py-16/g, 'py-6');
            content = content.replace(/py-12 relative overflow-hidden/g, 'py-6 relative overflow-hidden');
            content = content.replace(/py-16 relative overflow-hidden/g, 'py-6 relative overflow-hidden');
            content = content.replace(/py-6 sm:py-8 relative overflow-hidden/g, 'py-4 sm:py-6 relative overflow-hidden');

            // Reduce top pill margin
            content = content.replace(/tracking-widest mb-4/g, 'tracking-widest mb-2');

            // Reduce heading size and margins
            content = content.replace(/text-3xl sm:text-5xl font-black mb-4/g, 'text-2xl sm:text-3xl font-black mb-1');
            content = content.replace(/text-4xl sm:text-5xl font-black mb-4/g, 'text-3xl sm:text-4xl font-black mb-1');
            
            // Special case for Feed.tsx heading which might just be mb-4
            content = content.replace(/text-3xl sm:text-5xl font-black mb-4 tracking-tight/g, 'text-2xl sm:text-3xl font-black mb-1 tracking-tight');
            
            // Reduce paragraph margin (if there's mb-8 etc)
            
            // Reduce mt-8 for tab bars
            content = content.replace(/mt-8 w-full/g, 'mt-4 w-full');
            content = content.replace(/mt-8 max-w-3xl/g, 'mt-4 max-w-3xl');

            if (content !== originalContent) {
                fs.writeFileSync(filePath, content);
                console.log(`Updated ${file}`);
            }
        }
    });
}

compactHeroes();
