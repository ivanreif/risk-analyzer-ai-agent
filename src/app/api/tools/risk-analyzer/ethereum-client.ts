import axios from "axios";
import { ContractData } from "./types";
import { analyzeSolidityCode } from "./code-analyzer";

// API Keys should be in environment variables
const ETHERSCAN_API_KEY = process.env.ETHERSCAN_API_KEY;

export async function checkIsEthereumContract(address: string): Promise<boolean> {
    try {
        const response = await axios.get(
            `https://api.etherscan.io/v2/api?chainid=1&module=proxy&action=eth_getCode&address=${address}&tag=latest&apikey=${ETHERSCAN_API_KEY}`
        );
        console.log(response.data);
        return response.data.result !== '0x' && response.data.result !== '0x0';
    } catch (error) {
        console.error('Error checking Ethereum contract:', error);
        return false;
    }
}

export async function checkIsContract(address: string): Promise<boolean> {
    try {
        // Get bytecode from Etherscan
        const response = await axios.get(
            `https://api.etherscan.io/v2/api?chainid=1&module=proxy&action=eth_getCode&address=${address}&tag=latest&apikey=${ETHERSCAN_API_KEY}`
        );

        const bytecode = response.data.result;
        // Check if bytecode exists and is not empty (0x or 0x0)
        return bytecode !== '0x' && bytecode !== '0x0' && bytecode.length > 2;
    } catch (error) {
        console.error('Error checking contract status:', error);
        return false;
    }
}

export async function getContractData(address: string): Promise<ContractData> {
    // Get contract verification status and source code from Etherscan
    const response = await axios.get(
        `https://api.etherscan.io/v2/api?chainid=1&module=contract&action=getsourcecode&address=${address}&apikey=${ETHERSCAN_API_KEY}`
    );
    
    // Get contract creation date and transaction history
    const txResponse = await axios.get(
        `https://api.etherscan.io/v2/api?chainid=1&module=account&action=txlist&address=${address}&startblock=0&endblock=99999999&sort=asc&apikey=${ETHERSCAN_API_KEY}`
    );

    const creationDate = txResponse.data.result[0]?.timeStamp 
        ? new Date(parseInt(txResponse.data.result[0].timeStamp) * 1000)
        : new Date();

    const sourceCode = response.data.result[0].SourceCode || '';
    const contractName = response.data.result[0].ContractName || 'Contract';
    const codeAnalysis = analyzeSolidityCode(sourceCode);

    console.log('codeAnalysis',response.data);

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