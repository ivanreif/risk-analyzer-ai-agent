#!/usr/bin/env node

/**
 * Simplified Risk Analyzer Test Script
 * Tests the calculateRiskMetrics method directly with test data
 * Usage: node test-risk-analyzer.js
 */

const fs = require('fs');
const path = require('path');

// Load test data
const testData = JSON.parse(fs.readFileSync(path.join(__dirname, 'tests', 'risk-analyzer', 'test-data.json'), 'utf8'));

// API endpoint
const API_URL = 'http://localhost:3002/api/tools/risk-analyzer';

// Test function
async function testContract(name, address, category) {
    try {
        const response = await fetch(`${API_URL}?address=${address}`);
        const result = await response.json();
        
        console.log(`\n${name} (${category})`);
        console.log(`Address: ${address}`);
        console.log(`Risk: ${result.overallRisk?.toFixed(3) || 'N/A'}`);
        console.log(`Verified: ${result.details?.contractVerified || false}`);
        console.log(`Issues: ${result.details?.securityIssues?.length || 0}`);
        console.log(result);
        return result.overallRisk || 0;
    } catch (error) {
        console.log(`\n${name} - ERROR: ${error.message}`);
        return null;
    }
}

// Run tests
async function runTests() {
    console.log('🧪 Risk Analyzer API Test\n');
    
    const results = [];
    
    // Test popular contracts
    console.log('📊 Popular Contracts:');
    for (const contract of testData.popular_contracts.slice(0, 5)) {
        const risk = await testContract(contract.name, contract.address, contract.category);
        if (risk !== null) results.push(risk);
        await new Promise(resolve => setTimeout(resolve, 500)); // Rate limit
    }
    
    // Test hacked contracts
    console.log('\n🚨 Hacked Contracts:');
    for (const contract of testData.hacked_contracts) {
        const risk = await testContract(contract.name, contract.address, contract.exploit_type);
        if (risk !== null) results.push(risk);
        await new Promise(resolve => setTimeout(resolve, 500));
    }
    
    // Test low quality contracts
    console.log('\n⚠️  Low Quality Contracts:');
    for (const contract of testData.low_quality_contracts) {
        const risk = await testContract(contract.name, contract.address, contract.issue);
        if (risk !== null) results.push(risk);
        await new Promise(resolve => setTimeout(resolve, 500));
    }
    
    // Summary
    console.log('\n📊 Summary:');
    console.log(`Tested: ${results.length} contracts`);
    console.log(`Average Risk: ${(results.reduce((a, b) => a + b, 0) / results.length).toFixed(3)}`);
    console.log(`Min Risk: ${Math.min(...results).toFixed(3)}`);
    console.log(`Max Risk: ${Math.max(...results).toFixed(3)}`);
}

// Check if fetch is available (Node.js 18+)
if (typeof fetch === 'undefined') {
    console.error('❌ This script requires Node.js 18+ for fetch API support');
    process.exit(1);
}

runTests().catch(console.error); 