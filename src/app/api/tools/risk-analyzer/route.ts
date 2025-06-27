import { NextResponse } from "next/server";
import { checkIsEthereumContract, checkIsContract, getContractData } from "./ethereum-client";
import { isTokenContract } from "./code-analyzer";
import { calculateRiskMetrics } from "./risk-calculator";
import { getGoPlusSecurity } from "./goplus-client";

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