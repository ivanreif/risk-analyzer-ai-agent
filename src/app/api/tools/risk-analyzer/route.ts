import { NextResponse } from "next/server";
import axios from "axios";

// Types for our risk analysis
interface RiskMetrics {
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

// API Keys should be in environment variables
const ETHERSCAN_API_KEY = process.env.ETHERSCAN_API_KEY;

function isTokenContract(sourceCode: string): boolean {
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

async function checkIsEthereumContract(address: string): Promise<boolean> {
    try {
        const response = await axios.get(
            `https://api.etherscan.io/api?module=proxy&action=eth_getCode&address=${address}&tag=latest&apikey=${ETHERSCAN_API_KEY}`
        );
        console.log(response.data);
        return response.data.result !== '0x' && response.data.result !== '0x0';
    } catch (error) {
        console.error('Error checking Ethereum contract:', error);
        return false;
    }
}

export async function GET(request: Request) {
    const { searchParams } = new URL(request.url);
    const address = searchParams.get("address");

    if (!address) {
        return NextResponse.json({ error: "Address parameter is required" }, { status: 400 });
    }

    try {
        // Check if it's an Ethereum contract
        const isEthereumContract = await checkIsEthereumContract(address);
        if (!isEthereumContract) {
            return NextResponse.json(
                { 
                    error: "Network not supported",
                    message: "This tool only works with Ethereum mainnet contracts. The provided address was not found on Ethereum.",
                    details: "Please provide a valid Ethereum mainnet contract address."
                },
                { status: 200 }
            );
        }

        // Check if it's a smart contract
        const isContract = await checkIsContract(address);
        if (!isContract) {
            return NextResponse.json(
                { 
                    error: "This tool only works with smart contracts",
                    message: "The provided address is not a smart contract. Please provide a valid smart contract address to analyze its risk metrics.",
                    details: "Smart contracts are programs that run on the Ethereum blockchain. Regular wallet addresses cannot be analyzed by this tool."
                },
                { status: 400 }
            );
        }

        // Get contract data first to check if it's a token
        const contractData = await getContractData(address);
        const isToken = isTokenContract(contractData.sourceCode);

        // Only fetch GoPlus data if it's a token
        const goPlusData = isToken ? await getGoPlusSecurity(address) : {};

        // Calculate risk metrics with combined data
        const riskMetrics = calculateRiskMetrics(contractData, goPlusData, isToken);

        return NextResponse.json(riskMetrics);
    } catch (error) {
        console.error("Risk analysis error:", error);
        return NextResponse.json(
            { error: "Failed to perform risk analysis" },
            { status: 500 }
        );
    }
}

async function checkIsContract(address: string): Promise<boolean> {
    try {
        // Get bytecode from Etherscan
        const response = await axios.get(
            `https://api.etherscan.io/api?module=proxy&action=eth_getCode&address=${address}&tag=latest&apikey=${ETHERSCAN_API_KEY}`
        );

        const bytecode = response.data.result;
        // Check if bytecode exists and is not empty (0x or 0x0)
        return bytecode !== '0x' && bytecode !== '0x0' && bytecode.length > 2;
    } catch (error) {
        console.error('Error checking contract status:', error);
        return false;
    }
}

async function getContractData(address: string) {
    // Get contract verification status and source code from Etherscan
    const response = await axios.get(
        `https://api.etherscan.io/api?module=contract&action=getsourcecode&address=${address}&apikey=${ETHERSCAN_API_KEY}`
    );
    
    // Get contract creation date and transaction history
    const txResponse = await axios.get(
        `https://api.etherscan.io/api?module=account&action=txlist&address=${address}&startblock=0&endblock=99999999&sort=asc&apikey=${ETHERSCAN_API_KEY}`
    );

    const creationDate = txResponse.data.result[0]?.timeStamp 
        ? new Date(parseInt(txResponse.data.result[0].timeStamp) * 1000)
        : new Date();

    const sourceCode = response.data.result[0].SourceCode || '';
    const contractName = response.data.result[0].ContractName || 'Contract';
    const codeAnalysis = analyzeSolidityCode(sourceCode);

    return {
        isContract: true,
        verified: response.data.result[0].SourceCode !== "",
        contractName,
        creationDate,
        protocolAge: Math.floor((new Date().getTime() - creationDate.getTime()) / (1000 * 60 * 60 * 24 * 365)),
        compilerVersion: response.data.result[0].CompilerVersion,
        optimizationEnabled: response.data.result[0].OptimizationUsed === '1',
        sourceCode,
        ...codeAnalysis
    };
}

function analyzeSolidityCode(sourceCode: string) {
    if (!sourceCode) {
        return {
            hasSelfDestruct: false,
            hasDelegateCall: false,
            hasUncheckedMath: false,
            hasReentrancyRisk: false,
            hasAccessControl: false,
            hasPausable: false
        };
    }

    // Basic code analysis
    const hasSelfDestruct = sourceCode.includes('selfdestruct') || sourceCode.includes('suicide');
    const hasDelegateCall = sourceCode.includes('delegatecall');
    const hasUncheckedMath = sourceCode.includes('unchecked');
    const hasReentrancyRisk = sourceCode.includes('call') && !sourceCode.includes('reentrancyGuard');
    const hasAccessControl = sourceCode.includes('onlyOwner') || sourceCode.includes('accessControl');
    const hasPausable = sourceCode.includes('pausable') || sourceCode.includes('pause');

    return {
        hasSelfDestruct,
        hasDelegateCall,
        hasUncheckedMath,
        hasReentrancyRisk,
        hasAccessControl,
        hasPausable
    };
}

function calculateRiskMetrics(contractData: any, goPlusData: any, isToken: boolean): RiskMetrics {
    const contractRisk = calculateContractRisk(contractData);
    const securityRisk = calculateSecurityRisk(contractData, goPlusData, isToken);
    
    return {
        contractRisk,
        securityRisk,
        overallRisk: (contractRisk + securityRisk) / 2,
        details: {
            contractVerified: contractData.verified,
            protocolAge: contractData.protocolAge,
            codeQuality: calculateCodeQuality(contractData),
            securityIssues: getSecurityIssues(contractData, goPlusData, isToken),
            compilerVersion: contractData.compilerVersion || "unknown",
            optimizationEnabled: contractData.optimizationEnabled,
            isContract: true,
            tokenSecurity: isToken ? {
                isHoneypot: goPlusData.is_honeypot === "1",
                isBlacklisted: goPlusData.is_blacklisted === "1",
                isProxy: goPlusData.is_proxy === "1",
                isMintable: goPlusData.is_mintable === "1",
                isOpenSource: goPlusData.is_open_source === "1",
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

function calculateContractRisk(data: any): number {
    if (!data.verified) return 0.9;
    if (data.protocolAge < 1) return 0.7;
    if (data.protocolAge < 2) return 0.5;
    if (data.protocolAge < 3) return 0.3;
    return 0.2; // Very low risk for contracts older than 3 years
}

function calculateSecurityRisk(data: any, goPlusData: any, isToken: boolean): number {
    const risks = [
        data.hasSelfDestruct,
        data.hasDelegateCall,
        data.hasUncheckedMath,
        data.hasReentrancyRisk,
        !data.hasAccessControl,
        !data.hasPausable
    ];
    
    // Add GoPlus risks only if it's a token
    if (isToken) {
        risks.push(
            goPlusData.is_honeypot === "1",
            goPlusData.is_blacklisted === "1",
            goPlusData.is_scam === "1",
            goPlusData.is_high_risk === "1",
            goPlusData.cannot_sell_all === "1",
            parseFloat(goPlusData.buy_tax || "0") > 20,
            parseFloat(goPlusData.sell_tax || "0") > 20
        );
    }
    
    const riskCount = risks.reduce((sum, risk) => sum + (typeof risk === 'number' ? risk : risk ? 1 : 0), 0);
    return Math.min(0.2 + (riskCount * 0.03), 0.8);
}

function calculateCodeQuality(data: any): number {
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

function getSecurityIssues(data: any, goPlusData: any, isToken: boolean): string[] {
    const issues: string[] = [];
    
    // Contract code issues - only add critical ones
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
    
    return issues;
}

async function getGoPlusSecurity(address: string) {
    try {
        const resp = await axios.get(
            `https://api.gopluslabs.io/api/v1/token_security/1?contract_addresses=${address}`
        );
        return resp.data?.result?.[address.toLowerCase()] || {};
    } catch (e) {
        console.error("GoPlus API error:", e);
        return {};
    }
} 