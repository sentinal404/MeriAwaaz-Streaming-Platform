import ts from 'typescript';
import fs from 'fs';

const fileName = 'src/pages/Admin.tsx';
const fileContent = fs.readFileSync(fileName, 'utf8');

const sourceFile = ts.createSourceFile(
    fileName,
    fileContent,
    ts.ScriptTarget.Latest,
    true
);

console.log("Parsing completed. Syntactic Diagnostics:");
const diagnostics = sourceFile.parseDiagnostics;

if (diagnostics.length > 0) {
    diagnostics.forEach(diag => {
        const { line, character } = sourceFile.getLineAndCharacterOfPosition(diag.start);
        console.log(`Error at line ${line + 1}, col ${character + 1}: ${diag.messageText}`);
    });
} else {
    console.log("No syntactic diagnostics found in source file!");
}
