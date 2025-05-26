import { NextResponse } from "next/server";
import Web3 from "web3";
import axios from "axios";
import { JsonRpcProvider } from "ethers";

// Types for our risk analysis
interface RiskMetrics {
    contractRisk: number;
    liquidityRisk: number;
    volatilityRisk: number;
    securityRisk: number;
    marketRisk: number;
    governanceRisk: number;
    overallRisk: number;
    details: {
        contractVerified: boolean;
        tvl: number;
        volume24h: number;
        holderCount: number;
        securityIssues: string[];
        liquidityDepth: number;
        marketCap: number;
        governanceScore: number;
        codeQuality: number;
        auditStatus: string[];
        historicalIncidents: string[];
        priceImpact: number;
        concentrationRisk: number;
        protocolAge: number;
        socialMetrics: {
            socialLinks: {
                website: string;
                telegram: string;
                discord: string;
                github: string;
            };
            socialPresence: number;
        };
        isContract: boolean;
        isToken: boolean;
    };
}

// Initialize Web3 and Ethers
const web3 = new Web3(process.env.ETHEREUM_RPC_URL || "https://mainnet.infura.io/v3/your-api-key");
const provider = new JsonRpcProvider(process.env.ETHEREUM_RPC_URL);

// API Keys should be in environment variables
const ETHERSCAN_API_KEY = process.env.ETHERSCAN_API_KEY;

export async function GET(request: Request) {
    const { searchParams } = new URL(request.url);
    const address = searchParams.get("address");

    if (!address) {
        return NextResponse.json({ error: "Address parameter is required" }, { status: 400 });
    }

    try {
        // Validate address
        if (!web3.utils.isAddress(address)) {
            return NextResponse.json({ error: "Invalid Ethereum address" }, { status: 400 });
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

        // Gather data from Etherscan only
        const contractData = await getContractData(address);

        // Calculate risk metrics with simplified data
        const riskMetrics = calculateRiskMetrics(contractData);

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

    // Get contract ABI
    const abiResponse = await axios.get(
        `https://api.etherscan.io/api?module=contract&action=getabi&address=${address}&apikey=${ETHERSCAN_API_KEY}`
    );

    const creationDate = txResponse.data.result[0]?.timeStamp 
        ? new Date(parseInt(txResponse.data.result[0].timeStamp) * 1000)
        : new Date();

    const sourceCode = response.data.result[0].SourceCode || '';
    const codeAnalysis = analyzeSolidityCode(sourceCode);

    return {
        isContract: true,
        verified: response.data.result[0].SourceCode !== "",
        abi: abiResponse.data.result,
        contractName: response.data.result[0].ContractName,
        creationDate,
        protocolAge: Math.floor((new Date().getTime() - creationDate.getTime()) / (1000 * 60 * 60 * 24 * 365)),
        compilerVersion: response.data.result[0].CompilerVersion,
        optimizationEnabled: response.data.result[0].OptimizationUsed === '1',
        ...codeAnalysis
    };
}

function analyzeSolidityCode(sourceCode: string) {
    if (!sourceCode) {
        return {
            complexity: 0,
            inheritanceDepth: 0,
            functionCount: 0,
            stateVariables: 0,
            modifiers: 0,
            events: 0,
            hasFallback: false,
            hasReceive: false,
            hasSelfDestruct: false,
            hasDelegateCall: false,
            hasUncheckedMath: false,
            hasReentrancyRisk: false,
            hasAccessControl: false,
            hasPausable: false,
            hasUpgradeability: false
        };
    }

    // Basic code analysis
    const hasFallback = sourceCode.includes('fallback()') || sourceCode.includes('function()');
    const hasReceive = sourceCode.includes('receive()');
    const hasSelfDestruct = sourceCode.includes('selfdestruct') || sourceCode.includes('suicide');
    const hasDelegateCall = sourceCode.includes('delegatecall');
    const hasUncheckedMath = sourceCode.includes('unchecked');
    const hasReentrancyRisk = sourceCode.includes('call') && !sourceCode.includes('reentrancyGuard');
    const hasAccessControl = sourceCode.includes('onlyOwner') || sourceCode.includes('accessControl');
    const hasPausable = sourceCode.includes('pausable') || sourceCode.includes('pause');
    const hasUpgradeability = sourceCode.includes('upgrade') || sourceCode.includes('proxy');

    return {
        complexity: 0.5, // Simplified complexity score
        inheritanceDepth: 1, // Simplified inheritance depth
        functionCount: (sourceCode.match(/function/g) || []).length,
        stateVariables: (sourceCode.match(/uint|int|address|bool|string|bytes/g) || []).length,
        modifiers: (sourceCode.match(/modifier/g) || []).length,
        events: (sourceCode.match(/event/g) || []).length,
        hasFallback,
        hasReceive,
        hasSelfDestruct,
        hasDelegateCall,
        hasUncheckedMath,
        hasReentrancyRisk,
        hasAccessControl,
        hasPausable,
        hasUpgradeability
    };
}

function calculateRiskMetrics(contractData: any): RiskMetrics {
    const contractRisk = calculateContractRisk(contractData);
    const securityRisk = calculateSecurityRisk(contractData);
    
    // Simplified risk metrics with default values
    return {
        contractRisk,
        liquidityRisk: 0.5, // Default value
        volatilityRisk: 0.5, // Default value
        securityRisk,
        marketRisk: 0.5, // Default value
        governanceRisk: 0.5, // Default value
        overallRisk: (contractRisk + securityRisk + 2.5) / 5, // Average of all risks
        details: {
            contractVerified: contractData.verified,
            tvl: 0,
            volume24h: 0,
            holderCount: 0,
            securityIssues: [],
            liquidityDepth: 0,
            marketCap: 0,
            governanceScore: 0.5,
            codeQuality: calculateCodeQuality(contractData),
            auditStatus: [],
            historicalIncidents: [],
            priceImpact: 0,
            concentrationRisk: 0.5,
            protocolAge: contractData.protocolAge,
            socialMetrics: {
                socialLinks: {
                    website: "",
                    telegram: "",
                    discord: "",
                    github: ""
                },
                socialPresence: 0.5
            },
            isContract: true,
            isToken: false
        }
    };
}

function calculateContractRisk(data: any): number {
    if (!data.verified) return 0.9;
    if (data.protocolAge < 1) return 0.8;
    if (data.protocolAge < 2) return 0.6;
    return 0.4;
}

function calculateSecurityRisk(data: any): number {
    const risks = [
        data.hasSelfDestruct,
        data.hasDelegateCall,
        data.hasUncheckedMath,
        data.hasReentrancyRisk,
        !data.hasAccessControl,
        !data.hasPausable
    ];
    
    const riskCount = risks.filter(Boolean).length;
    return Math.min(0.3 + (riskCount * 0.1), 0.9);
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
    return Math.max(0.1, qualityScore);
} 