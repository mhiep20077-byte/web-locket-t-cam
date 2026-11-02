const fs = require('fs');
const path = require('path');
const JavaScriptObfuscator = require('javascript-obfuscator');

const srcDir = path.join(__dirname, 'js_src');
const distDir = path.join(__dirname, 'js');

const files = ['security-shield.js', 'main.js', 'ctv.js', 'admin.js'];

console.log('🔒 Đang tiến hành mã hóa và bảo vệ toàn bộ mã nguồn JavaScript...');

files.forEach(file => {
  const srcPath = path.join(srcDir, file);
  if (!fs.existsSync(srcPath)) return;

  const code = fs.readFileSync(srcPath, 'utf8');
  console.log(`⏳ Đang mã hóa ${file} (${(code.length / 1024).toFixed(1)} KB)...`);

  const obfuscationResult = JavaScriptObfuscator.obfuscate(code, {
    compact: true,
    controlFlowFlattening: true,
    controlFlowFlatteningThreshold: 0.75,
    numbersToExpressions: true,
    simplify: true,
    stringArray: true,
    stringArrayCallsTransform: true,
    stringArrayEncoding: ['base64'],
    stringArrayThreshold: 0.8,
    splitStrings: true,
    splitStringsChunkLength: 6,
    identifierNamesGenerator: 'hexadecimal',
    renameGlobals: false,
    transformObjectKeys: false
  });

  const obfuscatedCode = obfuscationResult.getObfuscatedCode();
  const distPath = path.join(distDir, file);
  fs.writeFileSync(distPath, obfuscatedCode, 'utf8');
  console.log(`✅ Đã mã hóa thành công ${file} -> ${(obfuscatedCode.length / 1024).toFixed(1)} KB`);
});

console.log('🎉 Hoàn tất bảo vệ và mã hóa toàn bộ JavaScript!');

