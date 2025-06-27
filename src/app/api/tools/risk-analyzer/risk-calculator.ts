import { RiskMetrics, ContractData, GoPlusTokenData } from "./types";

export function calculateRiskMetrics(contractData: ContractData, goPlusData: GoPlusTokenData, isToken: boolean, address?: string): RiskMetrics {
    let contractRisk = calculateContractRisk(contractData);
    let securityRisk = calculateSecurityRisk(contractData, goPlusData, isToken);
    
    
    return {
        contractRisk,
        securityRisk,
        overallRisk: (contractRisk + securityRisk) / 2,
        details: {
            contractVerified: contractData.verified,
            codeQuality: calculateCodeQuality(contractData),
            securityIssues: getSecurityIssues(contractData, goPlusData, isToken, address),
            compilerVersion: contractData.compilerVersion || "unknown",
            optimizationEnabled: contractData.optimizationEnabled,
            isContract: true,
            isToken: isToken,
            tokenSecurity: isToken ? {
                isHoneypot: goPlusData.is_honeypot === "1",
                isBlacklisted: goPlusData.is_blacklisted === "1",
                isProxy: goPlusData.is_proxy === "1",
                isMintable: goPlusData.is_mintable === "1",
                isWhitelisted: goPlusData.is_whitelisted === "1",
                isAntiWhale: goPlusData.is_anti_whale === "1",
                isTradingEnabled: goPlusData.is_trading_enabled === "1",
                buyTax: parseFloat(goPlusData.buy_tax || "0"),
                sellTax: parseFloat(goPlusData.sell_tax || "0"),
                cannotSellAll: goPlusData.cannot_sell_all === "1",
                isScam: goPlusData.is_scam === "1",
                isHighRisk: goPlusData.is_high_risk === "1"
            } : undefined
        }
    };
}

export function calculateContractRisk(data: ContractData): number {
    let riskScore = 0;
    
    // Verification status (20% weight)
    if (!data.verified) {
        riskScore += 0.2;
        
        // If we have API limitations, add moderate risk but don't max out
        if (data.criticalVulnerabilities.some(v => v.includes('API access limited') || v.includes('analysis failed'))) {
            riskScore += 0.3; // Moderate penalty for unknown status
            return Math.min(riskScore, 0.7); // Cap at 0.7 for API limitations
        }
        
        // For truly unverified contracts, add higher penalty
        return Math.min(riskScore + 0.4, 1.0);
    }
    
    // Critical vulnerabilities (40% weight)
    if (data.criticalVulnerabilities && data.criticalVulnerabilities.length > 0) {
        // Each critical vulnerability adds significant risk
        riskScore += Math.min(data.criticalVulnerabilities.length * 0.2, 0.4);
    }
    
    // Major risks (25% weight)
    if (data.majorRisks && data.majorRisks.length > 0) {
        riskScore += Math.min(data.majorRisks.length * 0.125, 0.25);
    }
    
    // Minor issues (5% weight)
    if (data.minorRisks && data.minorRisks.length > 0) {
        riskScore += Math.min(data.minorRisks.length * 0.025, 0.05);
    }
    
    return Math.min(riskScore, 1.0);
}

export function calculateAgeFactor(ageInYears: number): number {
    if (ageInYears < 0.08) return 0.8;  // Very new (< 1 month)
    if (ageInYears < 0.5) return 0.4;   // New (< 6 months)
    if (ageInYears < 1) return 0.2;     // Young (< 1 year)
    if (ageInYears < 2) return 0.1;     // Established (1-2 years)
    return 0.0;                         // Mature (2+ years) - no age penalty
}

export function calculateSecurityRisk(data: ContractData, goPlusData: GoPlusTokenData, isToken: boolean): number {
    let securityScore = 0;
    
    // Weighted security risks based on severity
    const securityRisks = [
        { condition: data.hasSelfDestruct, weight: 0.15, name: 'selfdestruct' },
        { condition: data.hasDelegateCall, weight: 0.12, name: 'delegatecall' },
        { condition: data.hasUncheckedMath, weight: 0.08, name: 'unchecked math' },
        { condition: data.hasReentrancyRisk, weight: 0.2, name: 'reentrancy risk' },
        { condition: !data.hasAccessControl, weight: 0.1, name: 'no access control' },
        { condition: !data.hasPausable, weight: 0.05, name: 'not pausable' }
    ];
    
    // Calculate weighted security score
    securityRisks.forEach(risk => {
        if (risk.condition) {
            securityScore += risk.weight;
        }
    });
    
    // Add GoPlus token-specific risks with proper weighting
    if (isToken) {
        const tokenRisks = [
            { condition: goPlusData.is_honeypot === "1", weight: 0.3, name: 'honeypot' },
            { condition: goPlusData.is_blacklisted === "1", weight: 0.25, name: 'blacklisted' },
            { condition: goPlusData.is_scam === "1", weight: 0.3, name: 'scam flag' },
            { condition: goPlusData.is_high_risk === "1", weight: 0.2, name: 'high risk flag' },
            { condition: goPlusData.cannot_sell_all === "1", weight: 0.15, name: 'cannot sell all' },
            { condition: parseFloat(goPlusData.buy_tax || "0") > 20, weight: 0.1, name: 'high buy tax' },
            { condition: parseFloat(goPlusData.sell_tax || "0") > 20, weight: 0.1, name: 'high sell tax' }
        ];
        
        tokenRisks.forEach(risk => {
            if (risk.condition) {
                securityScore += risk.weight;
            }
        });
    }
    
    // Ensure score stays within bounds but remove artificial cap
    return Math.min(securityScore, 1.0);
}

export function calculateCodeQuality(data: ContractData): number {
    if (!data.verified) return 0.1;
    
    const qualityFactors = [
        data.optimizationEnabled,
        data.compilerVersion?.includes('0.8'),
        data.hasAccessControl,
        data.hasPausable,
        !data.hasSelfDestruct,
        !data.hasDelegateCall
    ];
    
    const qualityScore = qualityFactors.filter(Boolean).length / qualityFactors.length;
    // Increase base quality score for verified contracts
    return Math.max(0.4, qualityScore);
}

export function getSecurityIssues(data: ContractData, goPlusData: GoPlusTokenData, isToken: boolean, address?: string): string[] {
    const issues: string[] = [];
    
    // Handle unverified contracts
    if (!data.verified) {
        issues.push("Contract not verified - source code unavailable for analysis");
    }
    
    // Add detected vulnerabilities from code analysis
    if (data.criticalVulnerabilities) {
        issues.push(...data.criticalVulnerabilities);
    }
    
    if (data.majorRisks) {
        issues.push(...data.majorRisks);
    }
    
    // Add traditional security issues
    if (data.hasSelfDestruct) issues.push("Contract contains selfdestruct functionality");
    if (data.hasDelegateCall) issues.push("Contract uses delegatecall");
    if (data.hasReentrancyRisk) issues.push("Potential reentrancy vulnerability");
    if (!data.hasAccessControl) issues.push("No access control mechanisms found");
    
    // GoPlus security issues (only for tokens)
    if (isToken) {
        if (goPlusData.is_honeypot === "1") issues.push("Token is a honeypot - cannot sell");
        if (goPlusData.is_blacklisted === "1") issues.push("Token is blacklisted");
        if (goPlusData.is_scam === "1") issues.push("Token is flagged as a scam");
        if (goPlusData.is_high_risk === "1") issues.push("Token is considered high risk");
        if (goPlusData.cannot_sell_all === "1") issues.push("Cannot sell all tokens at once");
        if (parseFloat(goPlusData.buy_tax || "0") > 20) {
            issues.push(`High buy tax: ${goPlusData.buy_tax}%`);
        }
        if (parseFloat(goPlusData.sell_tax || "0") > 20) {
            issues.push(`High sell tax: ${goPlusData.sell_tax}%`);
        }
        if (goPlusData.is_proxy === "1") issues.push("Contract is a proxy - can be upgraded");
        if (goPlusData.is_mintable === "1") issues.push("Token is mintable - supply can increase");
    }
    
    // Add minor issues with lower priority
    if (data.minorRisks) {
        issues.push(...data.minorRisks);
    }
    
    return issues;
} 