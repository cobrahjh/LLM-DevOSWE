/**
 * DLL/Native Library Inspector
 * Run: node dll-inspector.js <path-to-dll>
 * 
 * For .NET DLLs: Shows exported types
 * For Native DLLs: Shows PE header info
 */

const fs = require('fs');
const path = require('path');

const dllPath = process.argv[2] || 'C:\\Program Files\\vJoy\\x64\\vJoyInterface.dll';

console.log('=== DLL Inspector ===');
console.log('Target:', dllPath);
console.log('');

if (!fs.existsSync(dllPath)) {
    console.error('ERROR: File not found!');
    process.exit(1);
}

const buffer = fs.readFileSync(dllPath);
const stats = fs.statSync(dllPath);

console.log('Size:', Math.round(stats.size / 1024), 'KB');
console.log('Modified:', stats.mtime.toISOString());
console.log('');

// Check DOS header (MZ)
if (buffer[0] === 0x4D && buffer[1] === 0x5A) {
    console.log('✓ Valid PE file (MZ signature)');
    
    // PE header offset at 0x3C
    const peOffset = buffer.readUInt32LE(0x3C);
    
    // Check PE signature
    if (buffer[peOffset] === 0x50 && buffer[peOffset + 1] === 0x45) {
        console.log('✓ PE signature verified');
        
        // Machine type
        const machine = buffer.readUInt16LE(peOffset + 4);
        const machineTypes = {
            0x8664: 'x64 (AMD64)',
            0x014c: 'x86 (i386)',
            0xAA64: 'ARM64'
        };
        console.log('Architecture:', machineTypes[machine] || `Unknown (0x${machine.toString(16)})`);
        
        // Number of sections
        const numSections = buffer.readUInt16LE(peOffset + 6);
        console.log('Sections:', numSections);
        
        // Characteristics
        const characteristics = buffer.readUInt16LE(peOffset + 22);
        console.log('Characteristics:', `0x${characteristics.toString(16)}`);
        if (characteristics & 0x2000) console.log('  - DLL');
        if (characteristics & 0x0020) console.log('  - Large address aware');
        
        // Optional header size
        const optHeaderSize = buffer.readUInt16LE(peOffset + 20);
        const optHeaderOffset = peOffset + 24;
        
        // PE32 or PE32+?
        const magic = buffer.readUInt16LE(optHeaderOffset);
        const isPE32Plus = magic === 0x20b;
        console.log('Format:', isPE32Plus ? 'PE32+ (64-bit)' : 'PE32 (32-bit)');
        
        // Export directory RVA
        const exportDirOffset = isPE32Plus ? 112 : 96;
        const exportRVA = buffer.readUInt32LE(optHeaderOffset + exportDirOffset);
        const exportSize = buffer.readUInt32LE(optHeaderOffset + exportDirOffset + 4);
        
        if (exportRVA > 0) {
            console.log('');
            console.log('=== Export Directory ===');
            console.log('RVA:', `0x${exportRVA.toString(16)}`);
            console.log('Size:', exportSize, 'bytes');
            
            // Find section containing exports
            const sectionHeaderOffset = optHeaderOffset + optHeaderSize;
            
            for (let i = 0; i < numSections; i++) {
                const secOffset = sectionHeaderOffset + (i * 40);
                const secName = buffer.slice(secOffset, secOffset + 8).toString('ascii').replace(/\0/g, '');
                const secVirtAddr = buffer.readUInt32LE(secOffset + 12);
                const secRawSize = buffer.readUInt32LE(secOffset + 16);
                const secRawPtr = buffer.readUInt32LE(secOffset + 20);
                
                // Check if export RVA is in this section
                if (exportRVA >= secVirtAddr && exportRVA < secVirtAddr + secRawSize) {
                    const exportFileOffset = secRawPtr + (exportRVA - secVirtAddr);
                    
                    // Read export directory
                    const numFunctions = buffer.readUInt32LE(exportFileOffset + 20);
                    const numNames = buffer.readUInt32LE(exportFileOffset + 24);
                    const namesRVA = buffer.readUInt32LE(exportFileOffset + 32);
                    
                    console.log('Functions:', numFunctions);
                    console.log('Named exports:', numNames);
                    
                    if (numNames > 0 && numNames < 1000) {
                        console.log('');
                        console.log('=== Exported Functions ===');
                        
                        const namesFileOffset = secRawPtr + (namesRVA - secVirtAddr);
                        
                        for (let j = 0; j < Math.min(numNames, 50); j++) {
                            const nameRVA = buffer.readUInt32LE(namesFileOffset + (j * 4));
                            const nameFileOffset = secRawPtr + (nameRVA - secVirtAddr);
                            
                            // Read null-terminated string
                            let name = '';
                            let k = 0;
                            while (buffer[nameFileOffset + k] !== 0 && k < 256) {
                                name += String.fromCharCode(buffer[nameFileOffset + k]);
                                k++;
                            }
                            console.log(`  ${j + 1}. ${name}`);
                        }
                        
                        if (numNames > 50) {
                            console.log(`  ... and ${numNames - 50} more`);
                        }
                    }
                    break;
                }
            }
        } else {
            console.log('');
            console.log('No exports (likely .NET assembly)');
        }
    }
} else {
    console.error('Not a valid PE file');
}
