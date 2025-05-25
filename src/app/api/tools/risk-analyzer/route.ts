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
        price: number;
        high24h: number;
        low24h: number;
        totalSupply: number;
        codeAnalysis: {
            complexity: number;
            inheritanceDepth: number;
            functionCount: number;
            stateVariables: number;
            modifiers: number;
            events: number;
            hasFallback: boolean;
            hasReceive: boolean;
            hasSelfDestruct: boolean;
            hasDelegateCall: boolean;
            hasUncheckedMath: boolean;
            hasReentrancyRisk: boolean;
            hasAccessControl: boolean;
            hasPausable: boolean;
            hasUpgradeability: boolean;
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
const COINGECKO_API_KEY = process.env.COINGECKO_API_KEY;

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

        // Gather data from various sources
        const [
            contractData,
            poolData,
            securityData,
            marketData,
            governanceData,
            socialData
        ] = await Promise.all([
            getContractData(address),
            getPoolData(address),
            getSecurityData(address),
            getMarketData(address),
            getGovernanceData(address),
            getSocialMetrics(address)
        ]);

        // Calculate risk metrics
        const riskMetrics = calculateRiskMetrics(
            contractData,
            poolData,
            securityData,
            marketData,
            governanceData,
            socialData
        );

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

async function getPoolData(address: string) {
    try {
        // Get pool data from CoinGecko
        const coingeckoResponse = await axios.get(
            `https://api.coingecko.com/api/v3/simple/token_price/ethereum?contract_addresses=${address}&vs_currencies=usd&include_24hr_vol=true&include_24hr_change=true&include_last_updated_at=true`
        ).catch(error => {
            console.warn('Failed to fetch token price data:', error.message);
            return { data: {} };
        });

        // Get additional pool data from DEXScreener
        const dexscreenerResponse = await axios.get(
            `https://api.dexscreener.com/latest/dex/tokens/${address}`
        ).catch(error => {
            console.warn('Failed to fetch DEXScreener data:', error.message);
            return { data: { pairs: [] } };
        });

        const poolData = dexscreenerResponse.data.pairs?.[0] || {};
        const priceData = coingeckoResponse.data[address.toLowerCase()] || {};

        // Calculate TVL from price and liquidity
        const tvl = poolData.liquidity?.usd || 0;
        const volume24h = priceData.usd_24h_vol || 0;
        const priceImpact = calculatePriceImpact(volume24h, tvl);

        // Get historical data for volatility calculation
        let tvlHistory: any[] = [];
        let tvlVolatility = 0;

        try {
            const historicalResponse = await axios.get(
                `https://api.coingecko.com/api/v3/coins/ethereum/contract/${address}/market_chart?vs_currency=usd&days=30&interval=daily`
            );
            tvlHistory = historicalResponse.data.total_volumes || [];
            tvlVolatility = calculateVolatility(tvlHistory.map((d: any) => d[1]));
        } catch (error: any) {
            console.warn('Failed to fetch historical data:', error.message);
            // Use default values for non-token contracts
            tvlHistory = [];
            tvlVolatility = 0;
        }

        // Get liquidity distribution from DEXScreener
        const liquidityDistribution = poolData.liquidity?.distribution || {};
        const liquidityConcentration = calculateLiquidityConcentration(liquidityDistribution);

        return {
            tvl,
            volume24h,
            apy: poolData.apy || 0,
            tvlVolatility,
            priceImpact,
            liquidityConcentration,
            priceChange24h: priceData.usd_24h_change || 0,
            lastUpdated: priceData.last_updated_at,
            dexCount: dexscreenerResponse.data.pairs?.length || 0,
            isToken: !!coingeckoResponse.data[address.toLowerCase()] // Flag to indicate if this is a token
        };
    } catch (error) {
        console.error('Error in getPoolData:', error);
        // Return default values for non-token contracts
        return {
            tvl: 0,
            volume24h: 0,
            apy: 0,
            tvlVolatility: 0,
            priceImpact: 0,
            liquidityConcentration: 0,
            priceChange24h: 0,
            lastUpdated: null,
            dexCount: 0,
            isToken: false
        };
    }
}

async function getSecurityData(address: string) {
    // Get contract verification and source code from Etherscan
    const etherscanResponse = await axios.get(
        `https://api.etherscan.io/api?module=contract&action=getsourcecode&address=${address}&apikey=${ETHERSCAN_API_KEY}`
    );

    // Get security data from GoPlus Security API
    const goPlusResponse = await axios.get(
        `https://api.gopluslabs.io/api/v1/token_security/1?contract_addresses=${address}`
    );

    // Get function signatures from 4byte.directory
    const fourByteResponse = await axios.get(
        `https://www.4byte.directory/api/v1/signatures/?hex_signature=${address.slice(0, 10)}`
    );

    const contractData = etherscanResponse.data.result[0];
    const securityData = goPlusResponse.data.result[address.toLowerCase()] || {};
    const functionSignatures = fourByteResponse.data.results || [];

    // Analyze contract code for common vulnerabilities
    const codeAnalysis = analyzeContractCode(contractData.SourceCode || '');

    return {
        issues: [
            ...codeAnalysis.issues,
            ...(securityData.is_honeypot ? ['Potential honeypot detected'] : []),
            ...(securityData.is_proxy ? ['Contract is a proxy contract'] : []),
            ...(securityData.is_mintable ? ['Contract has minting capability'] : []),
            ...(securityData.is_blacklisted ? ['Contract has blacklist functionality'] : [])
        ],
        score: calculateSecurityScore(securityData, codeAnalysis),
        codeQuality: codeAnalysis.quality,
        functionSignatures: functionSignatures.map((f: any) => f.text_signature),
        isVerified: contractData.SourceCode !== '',
        compilerVersion: contractData.CompilerVersion || 'unknown',
        optimizationEnabled: contractData.OptimizationUsed === '1',
        hasProxy: securityData.is_proxy || false,
        hasMint: securityData.is_mintable || false,
        hasBlacklist: securityData.is_blacklisted || false,
        isHoneypot: securityData.is_honeypot || false
    };
}

function analyzeSolidityCode(sourceCode: string) {
    if (!sourceCode) {
        return {
            codeQuality: 0.3,
            issues: ['No source code available'],
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

    const issues: string[] = [];
    let complexity = 0;
    let inheritanceDepth = 0;
    let functionCount = 0;
    let stateVariables = 0;
    let modifiers = 0;
    let events = 0;

    // Basic metrics
    functionCount = (sourceCode.match(/function\s+[a-zA-Z0-9_]+/g) || []).length;
    stateVariables = (sourceCode.match(/[a-zA-Z0-9_]+\s+[a-zA-Z0-9_]+\s*;/g) || []).length;
    modifiers = (sourceCode.match(/modifier\s+[a-zA-Z0-9_]+/g) || []).length;
    events = (sourceCode.match(/event\s+[a-zA-Z0-9_]+/g) || []).length;

    // Inheritance depth
    const inheritanceMatches = sourceCode.match(/contract\s+[a-zA-Z0-9_]+\s+is\s+[a-zA-Z0-9_]+/g) || [];
    inheritanceDepth = inheritanceMatches.length;

    // Complexity calculation
    complexity += functionCount * 0.1;
    complexity += stateVariables * 0.05;
    complexity += inheritanceDepth * 0.2;
    complexity += (sourceCode.match(/if\s*\(/g) || []).length * 0.1;
    complexity += (sourceCode.match(/for\s*\(/g) || []).length * 0.15;
    complexity += (sourceCode.match(/while\s*\(/g) || []).length * 0.15;

    // Security checks
    const hasFallback = /fallback\s*\(\s*\)/.test(sourceCode);
    const hasReceive = /receive\s*\(\s*\)/.test(sourceCode);
    const hasSelfDestruct = /selfdestruct\s*\(/.test(sourceCode);
    const hasDelegateCall = /delegatecall\s*\(/.test(sourceCode);
    const hasUncheckedMath = /[+\-*/](?!\s*SafeMath)/.test(sourceCode);
    const hasReentrancyRisk = /\.call\(|\.transfer\(|\.send\(/.test(sourceCode);
    const hasAccessControl = /onlyOwner|onlyAdmin|onlyRole/.test(sourceCode);
    const hasPausable = /whenNotPaused|whenPaused/.test(sourceCode);
    const hasUpgradeability = /upgradeTo|upgradeToAndCall/.test(sourceCode);

    // Issue detection
    if (hasSelfDestruct) issues.push('Contract contains selfdestruct function');
    if (hasDelegateCall) issues.push('Contract uses delegatecall');
    if (hasUncheckedMath) issues.push('Unchecked math operations detected');
    if (hasReentrancyRisk) issues.push('Potential reentrancy risk detected');
    if (!hasAccessControl) issues.push('No access control mechanisms detected');
    if (complexity > 1) issues.push('High contract complexity');
    if (inheritanceDepth > 3) issues.push('Deep inheritance hierarchy');

    // Code quality score calculation
    let codeQuality = 0.7; // Base score

    // Positive factors
    if (hasAccessControl) codeQuality += 0.1;
    if (hasPausable) codeQuality += 0.1;
    if (events > 0) codeQuality += 0.05;
    if (modifiers > 0) codeQuality += 0.05;
    if (!hasUncheckedMath) codeQuality += 0.1;
    if (!hasReentrancyRisk) codeQuality += 0.1;

    // Negative factors
    if (hasSelfDestruct) codeQuality -= 0.2;
    if (hasDelegateCall) codeQuality -= 0.1;
    if (complexity > 1) codeQuality -= 0.1;
    if (inheritanceDepth > 3) codeQuality -= 0.1;
    if (issues.length > 0) codeQuality -= (issues.length * 0.05);

    return {
        codeQuality: Math.max(0, Math.min(1, codeQuality)),
        issues,
        complexity,
        inheritanceDepth,
        functionCount,
        stateVariables,
        modifiers,
        events,
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

function analyzeContractCode(sourceCode: string) {
    const issues: string[] = [];
    let quality = 0.8; // Base quality score

    if (!sourceCode) {
        return { issues: ['Contract source code not available'], quality: 0.3 };
    }

    // Check for common vulnerabilities
    const vulnerabilityPatterns = {
        'Reentrancy': /\.call\(|\.transfer\(|\.send\(/g,
        'Unchecked external calls': /\.call\([^)]*\)(?!\s*require|\s*if)/g,
        'Unsafe math': /[+\-*/](?!\s*SafeMath)/g,
        'Unprotected selfdestruct': /selfdestruct\(/g,
        'Unprotected delegatecall': /delegatecall\(/g,
        'Uninitialized storage': /mapping\s*\([^)]*\)\s*[a-zA-Z_][a-zA-Z0-9_]*\s*;/g
    };

    for (const [vuln, pattern] of Object.entries(vulnerabilityPatterns)) {
        if (pattern.test(sourceCode)) {
            issues.push(`Potential ${vuln} vulnerability detected`);
            quality -= 0.1;
        }
    }

    // Check for good practices
    const goodPractices = {
        'SafeMath usage': /SafeMath/g,
        'Events for important state changes': /event\s+[A-Za-z0-9_]+/g,
        'Function modifiers': /modifier\s+[A-Za-z0-9_]+/g,
        'NatSpec comments': /\/\/\/\s*@/g
    };

    for (const [practice, pattern] of Object.entries(goodPractices)) {
        if (pattern.test(sourceCode)) {
            quality += 0.05;
        }
    }

    return {
        issues,
        quality: Math.max(0, Math.min(1, quality))
    };
}

function calculateSecurityScore(securityData: any, codeAnalysis: any): number {
    let score = 0.7; // Base score

    // Deduct points for issues
    score -= (codeAnalysis.issues.length * 0.1);
    score -= (securityData.is_honeypot ? 0.3 : 0);
    score -= (securityData.is_blacklisted ? 0.2 : 0);

    // Add points for good practices
    if (securityData.is_verified) score += 0.2;
    if (securityData.is_proxy) score += 0.1; // Proxy contracts can be good for upgradeability
    if (codeAnalysis.quality > 0.8) score += 0.1;

    return Math.max(0, Math.min(1, score));
}

async function getMarketData(address: string) {
    try {
        // Get market data from CoinGecko free API
        const response = await axios.get(
            `https://api.coingecko.com/api/v3/coins/ethereum/contract/${address}`,
            {
                params: {
                    localization: false,
                    tickers: false,
                    market_data: true,
                    community_data: false,
                    developer_data: false
                }
            }
        );

        const marketData = response.data.market_data || {};
        
        return {
            marketCap: marketData.market_cap?.usd || 0,
            priceChange24h: marketData.price_change_percentage_24h || 0,
            volume24h: marketData.total_volume?.usd || 0,
            circulatingSupply: marketData.circulating_supply || 0,
            totalSupply: marketData.total_supply || 0,
            price: marketData.current_price?.usd || 0,
            high24h: marketData.high_24h?.usd || 0,
            low24h: marketData.low_24h?.usd || 0
        };
    } catch (error: any) {
        console.warn('Failed to fetch market data:', error.message);
        
        // If we hit rate limit, wait and retry once
        if (error.response?.status === 429) {
            console.log('Rate limit hit, waiting 60 seconds before retry...');
            await new Promise(resolve => setTimeout(resolve, 60000));
            try {
                const retryResponse = await axios.get(
                    `https://api.coingecko.com/api/v3/coins/ethereum/contract/${address}`,
                    {
                        params: {
                            localization: false,
                            tickers: false,
                            market_data: true,
                            community_data: false,
                            developer_data: false
                        }
                    }
                );
                const marketData = retryResponse.data.market_data || {};
                return {
                    marketCap: marketData.market_cap?.usd || 0,
                    priceChange24h: marketData.price_change_percentage_24h || 0,
                    volume24h: marketData.total_volume?.usd || 0,
                    circulatingSupply: marketData.circulating_supply || 0,
                    totalSupply: marketData.total_supply || 0,
                    price: marketData.current_price?.usd || 0,
                    high24h: marketData.high_24h?.usd || 0,
                    low24h: marketData.low_24h?.usd || 0
                };
            } catch (retryError) {
                console.error('Retry failed:', retryError);
            }
        }

        // Return default values if market data is not available
        return {
            marketCap: 0,
            priceChange24h: 0,
            volume24h: 0,
            circulatingSupply: 0,
            totalSupply: 0,
            price: 0,
            high24h: 0,
            low24h: 0
        };
    }
}

async function getGovernanceData(address: string) {
    try {
        // Get governance data from Snapshot
        const response = await axios.get(
            `https://hub.snapshot.org/graphql`,
            {
                params: {
                    query: `
                        query {
                            proposals(
                                first: 5,
                                where: {
                                    space_in: ["${address}"]
                                },
                                orderBy: "created",
                                orderDirection: desc
                            ) {
                                id
                                title
                                state
                                created
                                votes
                            }
                            space(id: "${address}") {
                                id
                                name
                                followersCount
                                proposalsCount
                                votesCount
                            }
                        }
                    `
                }
            }
        );

        const proposals = response.data.data?.proposals || [];
        const space = response.data.data?.space || {};

        return {
            proposalCount: space.proposalsCount || 0,
            voterCount: space.votesCount || 0,
            followerCount: space.followersCount || 0,
            lastProposalDate: proposals[0]?.created,
            activeProposals: proposals.filter((p: any) => p.state === 'active').length,
            governanceScore: calculateGovernanceScore({
                proposalCount: space.proposalsCount || 0,
                voterCount: space.votesCount || 0,
                followerCount: space.followersCount || 0,
                activeProposals: proposals.filter((p: any) => p.state === 'active').length
            })
        };
    } catch (error) {
        console.warn('Failed to fetch governance data:', error);
        // Return default values if governance data is not available
        return {
            proposalCount: 0,
            voterCount: 0,
            followerCount: 0,
            lastProposalDate: null,
            activeProposals: 0,
            governanceScore: 0.3 // Default low score for unknown governance
        };
    }
}

function calculateGovernanceScore(data: any): number {
    let score = 0.5; // Base score

    // Proposal activity
    if (data.proposalCount > 10) score += 0.2;
    else if (data.proposalCount > 5) score += 0.1;
    else if (data.proposalCount > 0) score += 0.05;

    // Voter participation
    if (data.voterCount > 1000) score += 0.2;
    else if (data.voterCount > 100) score += 0.1;
    else if (data.voterCount > 10) score += 0.05;

    // Community engagement
    if (data.followerCount > 5000) score += 0.1;
    else if (data.followerCount > 1000) score += 0.05;

    // Active proposals
    if (data.activeProposals > 0) score += 0.1;

    return Math.min(1, Math.max(0, score));
}

async function getSocialMetrics(address: string) {
    try {
        // Get social metrics from Etherscan
        const response = await axios.get(
            `https://api.etherscan.io/api?module=contract&action=getsourcecode&address=${address}&apikey=${ETHERSCAN_API_KEY}`
        );

        const contractData = response.data.result[0];
        const socialLinks = extractSocialLinks(contractData.SourceCode || '');

        return {
            socialLinks,
            socialPresence: calculateSocialPresence(socialLinks)
        };
    } catch (error) {
        console.warn('Failed to fetch social metrics:', error);
        return {
            socialLinks: {},
            socialPresence: 0.3 // Default low score for unknown social presence
        };
    }
}

function extractSocialLinks(sourceCode: string) {
    const links = {
        website: '',
        telegram: '',
        discord: '',
        github: ''
    };

    if (!sourceCode) return links;

    // Extract website
    const websiteMatch = sourceCode.match(/website\s*=\s*["']([^"']+)["']/i);
    if (websiteMatch) links.website = websiteMatch[1];

    // Extract Telegram
    const telegramMatch = sourceCode.match(/telegram\s*=\s*["']([^"']+)["']/i) || 
                         sourceCode.match(/t\.me\/([a-zA-Z0-9_]+)/);
    if (telegramMatch) links.telegram = telegramMatch[1];

    // Extract Discord
    const discordMatch = sourceCode.match(/discord\s*=\s*["']([^"']+)["']/i) || 
                        sourceCode.match(/discord\.gg\/([a-zA-Z0-9]+)/);
    if (discordMatch) links.discord = discordMatch[1];

    // Extract GitHub
    const githubMatch = sourceCode.match(/github\s*=\s*["']([^"']+)["']/i) || 
                       sourceCode.match(/github\.com\/([a-zA-Z0-9-]+\/[a-zA-Z0-9-]+)/);
    if (githubMatch) links.github = githubMatch[1];

    return links;
}

function calculateSocialPresence(socialLinks: any): number {
    let score = 0.3; // Base score

    // Website presence
    if (socialLinks.website) score += 0.2;

    // Social media presence
    if (socialLinks.telegram) score += 0.2;
    if (socialLinks.discord) score += 0.2;
    if (socialLinks.github) score += 0.3;

    return Math.min(1, score);
}

function calculateRiskMetrics(
    contractData: any,
    poolData: any,
    securityData: any,
    marketData: any,
    governanceData: any,
    socialData: any
): RiskMetrics {
    // Initialize risk scores
    let contractRisk = calculateContractRisk(contractData);
    let liquidityRisk = poolData.isToken ? calculateLiquidityRisk(poolData) : 0.5; // Default risk for non-tokens
    let volatilityRisk = poolData.isToken ? calculateVolatilityRisk(poolData) : 0.5; // Default risk for non-tokens
    let securityRisk = calculateSecurityRisk(securityData);
    let marketRisk = poolData.isToken ? calculateMarketRisk(marketData) : 0.5; // Default risk for non-tokens
    let governanceRisk = calculateGovernanceRisk(governanceData);

    // Calculate overall risk (weighted average)
    const overallRisk = (
        contractRisk * 0.25 +
        liquidityRisk * 0.25 +
        volatilityRisk * 0.15 +
        securityRisk * 0.2 +
        marketRisk * 0.15
    );

    return {
        contractRisk,
        liquidityRisk,
        volatilityRisk,
        securityRisk,
        marketRisk,
        governanceRisk,
        overallRisk,
        details: {
            contractVerified: contractData.verified,
            tvl: poolData.tvl || 0,
            volume24h: poolData.volume24h || 0,
            holderCount: marketData.circulatingSupply || 0,
            securityIssues: securityData.issues || [],
            liquidityDepth: poolData.tvl ? poolData.volume24h / poolData.tvl : 0,
            marketCap: marketData.marketCap,
            governanceScore: governanceData.governanceScore,
            codeQuality: securityData.codeQuality,
            auditStatus: securityData.audits?.map((a: any) => a.status) || [],
            historicalIncidents: securityData.issues?.filter((i: any) => i.severity === 'high') || [],
            priceImpact: poolData.priceImpact,
            concentrationRisk: calculateConcentrationRisk(marketData),
            protocolAge: contractData.protocolAge,
            socialMetrics: {
                socialLinks: socialData.socialLinks,
                socialPresence: socialData.socialPresence
            },
            price: marketData.price,
            high24h: marketData.high24h,
            low24h: marketData.low24h,
            totalSupply: marketData.totalSupply,
            codeAnalysis: {
                complexity: contractData.complexity,
                inheritanceDepth: contractData.inheritanceDepth,
                functionCount: contractData.functionCount,
                stateVariables: contractData.stateVariables,
                modifiers: contractData.modifiers,
                events: contractData.events,
                hasFallback: contractData.hasFallback,
                hasReceive: contractData.hasReceive,
                hasSelfDestruct: contractData.hasSelfDestruct,
                hasDelegateCall: contractData.hasDelegateCall,
                hasUncheckedMath: contractData.hasUncheckedMath,
                hasReentrancyRisk: contractData.hasReentrancyRisk,
                hasAccessControl: contractData.hasAccessControl,
                hasPausable: contractData.hasPausable,
                hasUpgradeability: contractData.hasUpgradeability
            },
            isContract: true,
            isToken: poolData.isToken
        }
    };
}

// Helper functions for risk calculations
function calculateContractRisk(data: any): number {
    let risk = 0;
    if (!data.verified) risk += 0.4;
    if (data.protocolAge < 1) risk += 0.3;
    if (data.protocolAge < 0.5) risk += 0.3;
    return Math.min(risk, 1);
}

function calculateLiquidityRisk(data: any): number {
    let risk = 0;
    const tvl = data.tvl || 0;
    
    // TVL-based risk
    if (tvl < 1000000) risk += 0.4;
    if (tvl < 10000000) risk += 0.3;
    
    // Price impact risk
    if (data.priceImpact > 0.1) risk += 0.3;
    
    // Liquidity concentration risk
    if (data.liquidityConcentration > 0.7) risk += 0.2;
    if (data.liquidityConcentration > 0.5) risk += 0.1;
    
    // DEX diversity risk
    const dexCount = data.dexCount || 0;
    if (dexCount < 2) risk += 0.2;
    if (dexCount < 4) risk += 0.1;
    
    return Math.min(risk, 1);
}

function calculateVolatilityRisk(data: any): number {
    let risk = 0;
    if (data.tvlVolatility > 0.5) risk += 0.4;
    if (data.tvlVolatility > 0.3) risk += 0.3;
    if (data.priceImpact > 0.05) risk += 0.3;
    return Math.min(risk, 1);
}

function calculateSecurityRisk(data: any): number {
    let risk = 0;
    if (data.score < 50) risk += 0.4;
    if (data.issues?.length > 0) risk += 0.3;
    if (data.codeQuality < 0.7) risk += 0.3;
    return Math.min(risk, 1);
}

function calculateMarketRisk(data: any): number {
    let risk = 0;
    if (data.marketCap < 10000000) risk += 0.4;
    if (Math.abs(data.priceChange24h) > 20) risk += 0.3;
    if (data.volume24h / data.marketCap < 0.1) risk += 0.3;
    return Math.min(risk, 1);
}

function calculateGovernanceRisk(data: any): number {
    let risk = 0;
    if (data.proposalCount < 5) risk += 0.4;
    if (data.voterCount < 100) risk += 0.3;
    if (data.governanceScore < 0.5) risk += 0.3;
    return Math.min(risk, 1);
}

function calculateVolatility(data: number[]): number {
    if (data.length < 2) return 0;
    const mean = data.reduce((a, b) => a + b, 0) / data.length;
    const variance = data.reduce((a, b) => a + Math.pow(b - mean, 2), 0) / data.length;
    return Math.sqrt(variance) / mean;
}

function calculatePriceImpact(volume: number, tvl: number): number {
    if (!tvl) return 1;
    return volume / tvl;
}

function calculateCodeQuality(data: any): number {
    // Implement code quality scoring based on various metrics
    return 0.8; // Placeholder
}

function calculateConcentrationRisk(data: any): number {
    // Implement concentration risk calculation
    return 0.4; // Placeholder
}

function calculateLiquidityConcentration(distribution: any): number {
    if (!distribution || Object.keys(distribution).length === 0) return 1;
    
    // Calculate Gini coefficient for liquidity distribution
    const values = Object.values(distribution).map(Number);
    const sortedValues = values.sort((a, b) => a - b);
    const n = sortedValues.length;
    
    if (n === 0) return 1;
    
    let sumOfDifferences = 0;
    let sumOfValues = 0;
    
    for (let i = 0; i < n; i++) {
        sumOfValues += sortedValues[i];
        for (let j = 0; j < n; j++) {
            sumOfDifferences += Math.abs(sortedValues[i] - sortedValues[j]);
        }
    }
    
    if (sumOfValues === 0) return 1;
    
    return sumOfDifferences / (2 * n * sumOfValues);
} 