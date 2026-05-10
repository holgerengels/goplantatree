const fs = require('fs');
const content = fs.readFileSync('node_modules/@webawesome/components/dist/components/input/input.js', 'utf8');
console.log(content.match(/emit\('wa-/g));
console.log(content.match(/emit\('sl-/g));
