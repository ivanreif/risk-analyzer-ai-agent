# Bitte Risk Analyzer Agent

A specialized AI agent for analyzing smart contract risks and security metrics.

## Features

### Risk Analyzer Tool
The risk analyzer tool provides comprehensive analysis of Ethereum smart contracts, evaluating multiple risk factors:

- **Contract Security**
  - Code verification status
  - Security vulnerabilities
  - Code quality metrics
  - Common vulnerability patterns
  - Access control mechanisms

- **Liquidity Analysis**
  - Total Value Locked (TVL)
  - Liquidity depth
  - Price impact
  - Liquidity concentration
  - DEX presence

- **Market Metrics**
  - Price volatility
  - Trading volume
  - Market cap
  - Price impact
  - Historical data analysis

- **Governance Analysis**
  - Proposal activity
  - Voter participation
  - Community engagement
  - Active proposals
  - Governance structure

## API Endpoints

### Risk Analyzer
```http
GET /api/tools/risk-analyzer?address={contractAddress}
```

Analyzes risk metrics for an Ethereum smart contract.

**Parameters:**
- `address` (required): Ethereum smart contract address to analyze

**Response:**
```json
{
    "contractRisk": number,
    "liquidityRisk": number,
    "volatilityRisk": number,
    "securityRisk": number,
    "marketRisk": number,
    "governanceRisk": number,
    "overallRisk": number,
    "details": {
        "contractVerified": boolean,
        "tvl": number,
        "volume24h": number,
        "holderCount": number,
        "securityIssues": string[],
        "liquidityDepth": number,
        "marketCap": number,
        "governanceScore": number,
        "codeQuality": number,
        "auditStatus": string[],
        "historicalIncidents": string[],
        "priceImpact": number,
        "concentrationRisk": number,
        "protocolAge": number,
        "socialMetrics": {
            "socialLinks": {
                "website": string,
                "telegram": string,
                "discord": string,
                "github": string
            },
            "socialPresence": number
        },
        "codeAnalysis": {
            "complexity": number,
            "inheritanceDepth": number,
            "functionCount": number,
            "stateVariables": number,
            "modifiers": number,
            "events": number,
            "hasFallback": boolean,
            "hasReceive": boolean,
            "hasSelfDestruct": boolean,
            "hasDelegateCall": boolean,
            "hasUncheckedMath": boolean,
            "hasReentrancyRisk": boolean,
            "hasAccessControl": boolean,
            "hasPausable": boolean,
            "hasUpgradeability": boolean
        },
        "isContract": boolean,
        "isToken": boolean
    }
}
```

**Error Responses:**
- `400 Bad Request`: Invalid address or non-contract address
- `500 Server Error`: Internal server error

## Environment Variables

Required environment variables:
```env
ETHEREUM_RPC_URL=your_ethereum_rpc_url
ETHERSCAN_API_KEY=your_etherscan_api_key
```

## Installation

1. Clone the repository:
```bash
git clone https://github.com/yourusername/bitte-oracle-agent.git
cd bitte-oracle-agent
```

2. Install dependencies:
```bash
npm install
```

3. Set up environment variables:
```bash
cp .env.example .env.local
# Edit .env.local with your API keys
```

4. Run the development server:
```bash
npm run dev
```

## API Integration

The risk analyzer tool is designed to be integrated with AI agents and can be used to:
- Evaluate smart contract security
- Assess liquidity risks
- Analyze market metrics
- Review governance structure
- Provide comprehensive risk scores

## Contributing

Contributions are welcome! Please feel free to submit a Pull Request.

## License

This project is licensed under the MIT License - see the LICENSE file for details.
