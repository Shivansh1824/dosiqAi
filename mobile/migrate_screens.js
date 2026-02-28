const fs = require('fs');
const path = require('path');

const srcDir = path.join(__dirname, 'src', 'screens');
const appDir = path.join(__dirname, 'app');

if (!fs.existsSync(appDir)) {
    fs.mkdirSync(appDir);
}

// Map old screen filenames to new app routes
// e.g., HomeScreen.tsx -> (tabs)/home.tsx ? No, the user will need to structure it. For now, we will
// just output everything to `app/`. The user had `Home` rendering `HomeScreen`. Let's just create a flat `app/` folder except `Home` which I guess could be `home.tsx`?
// Let's just strip 'Screen' and make it lowercase if needed, or just leave it as is.
// Actually, leaving them as `[Name].tsx` is fine for Expo Router, but standard is `name.tsx` 
// Except we need to handle `route.params`.

const files = fs.readdirSync(srcDir);

for (const file of files) {
    if (!file.endsWith('.tsx')) continue;

    const oldPath = path.join(srcDir, file);
    // Remove "Screen.tsx", e.g. "HomeScreen.tsx" -> "home"
    // Keep original name if we want, or strip "Screen".
    let newName = file.replace('Screen.tsx', '');
    // Expo router routes are often lowercase but don't strictly have to be.
    // We'll keep the exact name for now to prevent breaking other imports,
    // Actually, we'll output to app/${newName}.tsx
    const newPath = path.join(appDir, newName + '.tsx');

    let content = fs.readFileSync(oldPath, 'utf8');

    // Replace imports
    content = content.replace(/import\s+\{([^}]*?)useNavigation([^}]*?)\}\s+from\s+['"]@react-navigation\/native['"];?/g, "import { $1 $2 } from '@react-navigation/native';\nimport { useRouter, useLocalSearchParams } from 'expo-router';");
    // If useNavigation was the only import, we might have `import {  } from '@react-navigation/native'`, which is fine.

    // Also handle if @react-navigation/native wasn't imported but we need useRouter?
    if (!content.includes('useRouter')) {
        content = "import { useRouter, useLocalSearchParams } from 'expo-router';\n" + content;
    }

    // Find where useNavigation is called
    const useNavRegex = /const\s+navigation\s*=\s*useNavigation<[^>]*>\(\);/g;
    content = content.replace(useNavRegex, 'const router = useRouter();');
    // Or without generics
    content = content.replace(/const\s+navigation\s*=\s*useNavigation\(\);/g, 'const router = useRouter();');

    // Replace navigation.navigate('ScreenName', { params }) -> router.push({ pathname: '/ScreenName', params })
    // Simplistic approach:
    content = content.replace(/navigation\.navigate\(['"]([^'"]+)['"](?:\s*,\s*(\{.*?\}|\w+))?\)/g, (match, screen, params) => {
        // We stripped "Screen" from filenames. So 'Home' goes to 'Home' which matches app/Home.tsx
        if (params) {
            return `router.push({ pathname: '/${screen}', params: ${params} })`;
        }
        return `router.push('/${screen}')`;
    });

    content = content.replace(/navigation\.replace\(['"]([^'"]+)['"](?:\s*,\s*(\{.*?\}|\w+))?\)/g, (match, screen, params) => {
        if (params) {
            return `router.replace({ pathname: '/${screen}', params: ${params} })`;
        }
        return `router.replace('/${screen}')`;
    });

    content = content.replace(/navigation\.goBack\(\)/g, 'router.back()');
    content = content.replace(/navigation\.canGoBack\(\)/g, 'router.canGoBack()');

    // What if it took `navigation` as props?
    content = content.replace(/(\{.*?navigation.*?\}\s*:\s*[A-Za-z]+Props\s*)=>|function\s+[A-Za-z]+\(\s*\{.*?navigation.*?\}\s*\)/g, (match) => {
        // Just inject const router = useRouter(); inside if it was using props. This is too hard with regex.
        return match;
    });

    // What if it uses `route.params`?
    // We need to replace `const params = route.params` with `const params = useLocalSearchParams()`
    content = content.replace(/const\s+(\w+)\s*=\s*route\.params/g, 'const $1 = useLocalSearchParams()');
    content = content.replace(/route\.params/g, 'useLocalSearchParams()');

    // Fix relative imports: since we moved from src/screens/ to app/,
    // imports like `../components` become `../src/components`
    content = content.replace(/from\s+['"]\.\.\//g, "from '../src/");

    fs.writeFileSync(newPath, content, 'utf8');
}

console.log('Migration script complete');
