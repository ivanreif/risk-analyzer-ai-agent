export function isTokenContract(sourceCode: string): boolean {
    if (!sourceCode) return false;
    
    // Check for common token interface implementations
    const tokenPatterns = [
        'interface IERC20',
        'interface ERC20',
        'interface IERC721',
        'interface ERC721',
        'interface IERC1155',
        'interface ERC1155',
        'function transfer(',
        'function transferFrom(',
        'function balanceOf(',
        'function approve(',
        'function allowance(',
        'function totalSupply(',
        'function name()',
        'function symbol()',
        'function decimals()'
    ];

    return tokenPatterns.some(pattern => sourceCode.includes(pattern));
}

export function analyzeSolidityCode(sourceCode: string) {
    if (!sourceCode) {
        return {
            hasSelfDestruct: false,
            hasDelegateCall: false,
            hasUncheckedMath: false,
            hasReentrancyRisk: false,
            hasAccessControl: false,
            hasPausable: false,
            criticalVulnerabilities: [],
            majorRisks: [],
            minorRisks: []
        };
    }

    // Improved pattern matching with context awareness
    const hasSelfDestruct = /selfdestruct\s*\(|suicide\s*\(/.test(sourceCode);
    const hasDelegateCall = /delegatecall\s*\(/.test(sourceCode);
    const hasUncheckedMath = /unchecked\s*\{/.test(sourceCode);
    
    // More sophisticated reentrancy detection
    const hasReentrancyRisk = /\.call\s*\{[^}]*value\s*:/.test(sourceCode) && 
                              !/nonReentrant|ReentrancyGuard|mutex/.test(sourceCode);
    
    // Better access control detection
    const hasAccessControl = /onlyOwner|onlyAdmin|AccessControl|require\s*\(\s*msg\.sender\s*==/.test(sourceCode);
    const hasPausable = /pausable|pause\(\)|unpause\(\)|whenNotPaused/.test(sourceCode);

    // Advanced vulnerability detection
    const criticalVulnerabilities = [];
    const majorRisks = [];
    const minorRisks = [];

    // Critical vulnerability patterns
    if (/\.call\s*\([^)]*\)(?!\s*;\s*require\()/.test(sourceCode)) {
        criticalVulnerabilities.push('Unchecked low-level call - return value not verified');
    }
    
    if (/tx\.origin\s*==|msg\.sender\s*==\s*tx\.origin/.test(sourceCode)) {
        criticalVulnerabilities.push('Using tx.origin for authorization (phishing vulnerability)');
    }

    if (hasReentrancyRisk) {
        criticalVulnerabilities.push('Potential reentrancy vulnerability in external calls');
    }

    // Major risk patterns
    if (/function\s+\w*[mM]int\w*\s*\([^)]*\)\s+(private|internal)/.test(sourceCode)) {
        majorRisks.push('Hidden mint function detected');
    }

    if (/onlyOwner.*\{[^}]*(_mint\(|transfer\()/.test(sourceCode)) {
        majorRisks.push('Admin can mint tokens or transfer user funds');
    }

    if (/upgradeTo\(|upgradeToAndCall\(/.test(sourceCode)) {
        majorRisks.push('Upgradeable contract - admin can change logic');
    }

    if (/mapping\s*\([^)]*\)\s+\w*[bB]lacklist/.test(sourceCode)) {
        majorRisks.push('Contract can blacklist addresses');
    }

    // Minor issues
    if (/pragma\s+solidity\s+\^?0\.[0-7]\./.test(sourceCode)) {
        minorRisks.push('Using outdated Solidity version');
    }

    if (/assembly\s*\{/.test(sourceCode)) {
        minorRisks.push('Uses inline assembly - increased complexity');
    }

    return {
        hasSelfDestruct,
        hasDelegateCall,
        hasUncheckedMath,
        hasReentrancyRisk,
        hasAccessControl,
        hasPausable,
        criticalVulnerabilities,
        majorRisks,
        minorRisks
    };
} 