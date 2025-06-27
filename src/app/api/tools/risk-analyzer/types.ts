// Types for our risk analysis
export interface RiskMetrics {
    contractRisk: number;
    securityRisk: number;
    overallRisk: number;
    details: {
        contractVerified: boolean;
        protocolAge: number;
        codeQuality: number;
        securityIssues: string[];
        compilerVersion: string;
        optimizationEnabled: boolean;
        isContract: boolean;
        tokenSecurity?: {
            isHoneypot: boolean;
            isBlacklisted: boolean;
            isProxy: boolean;
            isMintable: boolean;
            isOpenSource: boolean;
            isWhitelisted: boolean;
            isAntiWhale: boolean;
            isTradingEnabled: boolean;
            buyTax: number;
            sellTax: number;
            cannotSellAll: boolean;
            isScam: boolean;
            isHighRisk: boolean;
        };
    };
}

export interface ContractData {
    isContract: boolean;
    verified: boolean;
    contractName: string;
    creationDate: Date;
    protocolAge: number;
    compilerVersion: string;
    optimizationEnabled: boolean;
    sourceCode: string;
    hasSelfDestruct: boolean;
    hasDelegateCall: boolean;
    hasUncheckedMath: boolean;
    hasReentrancyRisk: boolean;
    hasAccessControl: boolean;
    hasPausable: boolean;
    criticalVulnerabilities: string[];
    majorRisks: string[];
    minorRisks: string[];
}

export interface GoPlusTokenData {
    is_honeypot?: string;
    is_blacklisted?: string;
    is_proxy?: string;
    is_mintable?: string;
    is_open_source?: string;
    is_whitelisted?: string;
    is_anti_whale?: string;
    is_trading_enabled?: string;
    buy_tax?: string;
    sell_tax?: string;
    cannot_sell_all?: string;
    is_scam?: string;
    is_high_risk?: string;
} 