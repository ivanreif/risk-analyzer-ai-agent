#!/usr/bin/env node

/**
 * Risk Analyzer Test Script
 * Tests the risk analyzer API against known good and bad contracts
 * Usage: npm run test
 */

const fs = require('fs');
const path = require('path');

// Configuration
const API_BASE_URL = process.env.API_BASE_URL || 'http://localhost:3000';
const TEST_DATA_PATH = path.join(__dirname, 'tests', 'risk-analyzer', 'test-data.json');

// Test results tracking
let totalTests = 0;
let passedTests = 0;
let failedTests = 0;
const testResults = [];

// Colors for console output
const colors = {
    green: '\x1b[32m',
    red: '\x1b[31m',
    yellow: '\x1b[33m',
    blue: '\x1b[34m',
    magenta: '\x1b[35m',
    cyan: '\x1b[36m',
    reset: '\x1b[0m',
    bold: '\x1b[1m'
};

function log(message, color = '') {
    console.log(`${color}${message}${colors.reset}`);
}

// Load test data
function loadTestData() {
    try {
        if (!fs.existsSync(TEST_DATA_PATH)) {
            throw new Error(`Test data file not found: ${TEST_DATA_PATH}`);
        }
        return JSON.parse(fs.readFileSync(TEST_DATA_PATH, 'utf8'));
    } catch (error) {
        log(`❌ Error loading test data: ${error.message}`, colors.red);
        process.exit(1);
    }
}

// Call the risk analyzer API
async function analyzeContract(address) {
    try {
        const response = await fetch(`${API_BASE_URL}/api/tools/risk-analyzer?address=${address}`);
        
        if (!response.ok) {
            throw new Error(`HTTP ${response.status}: ${response.statusText}`);
        }
        
        return await response.json();
    } catch (error) {
        throw new Error(`API call failed: ${error.message}`);
    }
}

// Test assertion helper
function assert(condition, message, actualValue = null, expectedRange = null) {
    totalTests++;
    
    if (condition) {
        log(`  ✅ ${message}`, colors.green);
        passedTests++;
        return true;
    } else {
        const details = actualValue !== null && expectedRange !== null 
            ? ` (got: ${actualValue}, expected: ${expectedRange})`
            : '';
        log(`  ❌ ${message}${details}`, colors.red);
        failedTests++;
        return false;
    }
}

// Expected risk ranges for different contract types
const EXPECTED_RISK_RANGES = {
    'well‑audited': { min: 0.0, max: 0.25 },
    'audited': { min: 0.0, max: 0.35 },
    'new, moderate': { min: 0.25, max: 0.6 },
    'mid‑risk': { min: 0.3, max: 0.65 },
    'custodial': { min: 0.2, max: 0.5 },
    'historic': { min: 0.15, max: 0.6 },
    'hacked': { min: 0.6, max: 1.0 },
    'high': { min: 0.7, max: 1.0 },
    'medium‑high': { min: 0.5, max: 0.8 }
};

// Test popular contracts (should have low-medium risk)
async function testPopularContracts(testData) {
    log('\n📊 Testing Popular Well-Audited Contracts...', colors.blue + colors.bold);
    
    for (const contract of testData.popular_contracts) {
        
        log(`\nTesting ${contract.name} (${contract.category})...`, colors.cyan);
        
        try {
            const result = await analyzeContract(contract.address);
            const expectedRange = EXPECTED_RISK_RANGES[contract.risk] || EXPECTED_RISK_RANGES['audited'];
            
            // Basic result structure validation
            assert(result.overallRisk !== undefined, 'Overall risk should be defined');
            assert(result.contractRisk !== undefined, 'Contract risk should be defined');
            assert(result.securityRisk !== undefined, 'Security risk should be defined');
            assert(result.details !== undefined, 'Details should be provided');
            
            // Risk score validation
            const riskInRange = result.overallRisk !== undefined && 
                               result.overallRisk >= expectedRange.min && 
                               result.overallRisk <= expectedRange.max;
            assert(
                riskInRange,
                `Risk score should be in expected range for ${contract.risk} contracts`,
                result.overallRisk ? result.overallRisk.toFixed(3) : 'undefined',
                `${expectedRange.min}-${expectedRange.max}`
            );
            
            // Contract should be verified for popular protocols
            if (result.details.contractVerified !== undefined) {
                assert(result.details.contractVerified, 'Popular contracts should be verified');
            }
            
            // Log results
            log(`    Overall Risk: ${result.overallRisk ? result.overallRisk.toFixed(3) : 'undefined'}`, colors.magenta);
            log(`    Expected Range: ${expectedRange.min}-${expectedRange.max}`, colors.magenta);
            log(`    Security Issues: ${result.details.securityIssues?.length || 0}`, colors.magenta);
            
            // Store result for summary
            testResults.push({
                type: 'popular',
                name: contract.name,
                risk: result.overallRisk,
                expected: expectedRange,
                passed: riskInRange
            });
            
        } catch (error) {
            log(`  ❌ Test failed for ${contract.name}: ${error.message}`, colors.red);
            failedTests++;
            totalTests++;
        }
        
        // Rate limiting - wait between calls
        await new Promise(resolve => setTimeout(resolve, 1000));
    }
}

// Test hacked contracts (should have high risk)
async function testHackedContracts(testData) {
    log('\n🚨 Testing Previously Hacked Contracts...', colors.red + colors.bold);
    
    for (const contract of testData.hacked_contracts) {
        
        log(`\nTesting ${contract.name} (${contract.exploit_type})...`, colors.cyan);
        
        try {
            const result = await analyzeContract(contract.address);
            const expectedRange = EXPECTED_RISK_RANGES['hacked'];
            
            // Risk score validation - hacked contracts should be high risk
            const riskInRange = result.overallRisk !== undefined && 
                               result.overallRisk >= expectedRange.min && 
                               result.overallRisk <= expectedRange.max;
            assert(
                riskInRange,
                `Hacked contracts should have high risk scores`,
                result.overallRisk ? result.overallRisk.toFixed(3) : 'undefined',
                `${expectedRange.min}-${expectedRange.max}`
            );
            
            // Should have security issues identified
            const hasSecurityIssues = result.details.securityIssues && result.details.securityIssues.length > 0;
            assert(hasSecurityIssues, 'Hacked contracts should have security issues identified');
            
            log(`    Overall Risk: ${result.overallRisk ? result.overallRisk.toFixed(3) : 'undefined'}`, colors.magenta);
            log(`    Security Issues: ${result.details.securityIssues?.length || 0}`, colors.magenta);
            log(`    Exploit: $${contract.exploit_usd?.toLocaleString() || 'Unknown'} (${contract.date})`, colors.magenta);
            
            testResults.push({
                type: 'hacked',
                name: contract.name,
                risk: result.overallRisk,
                expected: expectedRange,
                passed: riskInRange
            });
            
        } catch (error) {
            log(`  ❌ Test failed for ${contract.name}: ${error.message}`, colors.red);
            failedTests++;
            totalTests++;
        }
        
        await new Promise(resolve => setTimeout(resolve, 1000));
    }
}

// Test low quality contracts (should have medium-high risk)
async function testLowQualityContracts(testData) {
    log('\n⚠️  Testing Low Quality/Risky Contracts...', colors.yellow + colors.bold);
    
    for (const contract of testData.low_quality_contracts) {

        log(`\nTesting ${contract.name} (${contract.issue})...`, colors.cyan);
        
        try {
            const result = await analyzeContract(contract.address);
            const expectedRange = EXPECTED_RISK_RANGES[contract.risk] || EXPECTED_RISK_RANGES['medium‑high'];
            
            const riskInRange = result.overallRisk !== undefined && 
                               result.overallRisk >= expectedRange.min && 
                               result.overallRisk <= expectedRange.max;
            assert(
                riskInRange,
                `Low quality contracts should have medium-high risk scores`,
                result.overallRisk ? result.overallRisk.toFixed(3) : 'undefined',
                `${expectedRange.min}-${expectedRange.max}`
            );
            
            log(`    Overall Risk: ${result.overallRisk ? result.overallRisk.toFixed(3) : 'undefined'}`, colors.magenta);
            log(`    Issue: ${contract.issue}`, colors.magenta);
            
            testResults.push({
                type: 'low_quality',
                name: contract.name,
                risk: result.overallRisk,
                expected: expectedRange,
                passed: riskInRange
            });
            
        } catch (error) {
            log(`  ❌ Test failed for ${contract.name}: ${error.message}`, colors.red);
            failedTests++;
            totalTests++;
        }
        
        await new Promise(resolve => setTimeout(resolve, 1000));
    }
}

// Test risk calculation consistency
async function testRiskCalculationConsistency() {
    log('\n🔢 Testing Risk Calculation Consistency...', colors.blue + colors.bold);
    
    // Test with a popular contract
    const testContract = '0xA0b86a33E6441b74D3cC5A4f1Ba2cEE59baF5EF5'; // USDC
    
    try {
        const result = await analyzeContract(testContract);
        
        // Overall risk should be average of contract and security risk
        const expectedOverall = (result.contractRisk + result.securityRisk) / 2;
        const difference = Math.abs(result.overallRisk - expectedOverall);
        
        assert(
            difference < 0.001,
            'Overall risk should equal average of contract and security risk',
            difference.toFixed(6),
            '< 0.001'
        );
        
        // Risk scores should be between 0 and 1
        assert(result.overallRisk >= 0 && result.overallRisk <= 1, 'Overall risk should be between 0 and 1');
        assert(result.contractRisk >= 0 && result.contractRisk <= 1, 'Contract risk should be between 0 and 1');
        assert(result.securityRisk >= 0 && result.securityRisk <= 1, 'Security risk should be between 0 and 1');
        
    } catch (error) {
        log(`  ❌ Consistency test failed: ${error.message}`, colors.red);
        failedTests++;
        totalTests++;
    }
}

// Generate test summary
function generateSummary() {
    log('\n' + '='.repeat(60), colors.bold);
    log('📊 Risk Analyzer Test Results Summary', colors.bold + colors.blue);
    log('='.repeat(60), colors.bold);
    
    log(`\nOverall Results:`, colors.bold);
    log(`Total Tests: ${totalTests}`);
    log(`Passed: ${passedTests} ✅`, colors.green);
    log(`Failed: ${failedTests} ❌`, colors.red);
    log(`Success Rate: ${((passedTests / totalTests) * 100).toFixed(1)}%`, colors.bold);
    
    // Breakdown by contract type
    const typeBreakdown = testResults.reduce((acc, result) => {
        if (!acc[result.type]) acc[result.type] = { total: 0, passed: 0 };
        acc[result.type].total++;
        if (result.passed) acc[result.type].passed++;
        return acc;
    }, {});
    
    log(`\nBreakdown by Contract Type:`, colors.bold);
    Object.entries(typeBreakdown).forEach(([type, stats]) => {
        const rate = ((stats.passed / stats.total) * 100).toFixed(1);
        log(`  ${type}: ${stats.passed}/${stats.total} (${rate}%)`);
    });
    
    // Risk score analysis
    log(`\nRisk Score Analysis:`, colors.bold);
    const popularAvg = testResults.filter(r => r.type === 'popular' && r.passed)
        .reduce((sum, r) => sum + r.risk, 0) / testResults.filter(r => r.type === 'popular' && r.passed).length;
    const hackedAvg = testResults.filter(r => r.type === 'hacked' && r.passed)
        .reduce((sum, r) => sum + r.risk, 0) / testResults.filter(r => r.type === 'hacked' && r.passed).length;
    
    if (popularAvg) log(`  Popular contracts average: ${popularAvg.toFixed(3)}`);
    if (hackedAvg) log(`  Hacked contracts average: ${hackedAvg.toFixed(3)}`);
    
    // Recommendations
    log(`\nRecommendations:`, colors.bold + colors.yellow);
    if (failedTests === 0) {
        log(`  🎉 All tests passed! Your risk analyzer is working well.`, colors.green);
    } else if (failedTests / totalTests > 0.3) {
        log(`  ⚠️  High failure rate (${((failedTests / totalTests) * 100).toFixed(1)}%). Consider reviewing the algorithm.`, colors.red);
    } else {
        log(`  ⚠️  Some tests failed. Review individual results above.`, colors.yellow);
    }
    
    log('='.repeat(60), colors.bold);
}

// Main test runner
async function runTests() {
    log('🚀 Starting Risk Analyzer Tests...', colors.bold + colors.blue);
    log(`API Base URL: ${API_BASE_URL}`, colors.cyan);
    
    // Check if API is accessible
    try {
        const response = await fetch(`${API_BASE_URL}/api/tools/risk-analyzer?address=0xA0b86a33E6441b74D3cC5A4f1Ba2cEE59baF5EF5`);
        if (!response.ok) {
            throw new Error(`API not accessible: ${response.status}`);
        }
        log('✅ API is accessible', colors.green);
    } catch (error) {
        log(`❌ Cannot access API: ${error.message}`, colors.red);
        log(`Please ensure the server is running on ${API_BASE_URL}`, colors.yellow);
        process.exit(1);
    }
    
    const testData = loadTestData();
    const startTime = Date.now();
    
    try {
        await testPopularContracts(testData);
        await testHackedContracts(testData);
        await testLowQualityContracts(testData);
        await testRiskCalculationConsistency();
        
        const duration = Date.now() - startTime;
        log(`\nTotal test duration: ${(duration / 1000).toFixed(1)} seconds`, colors.cyan);
        
        generateSummary();
        
        // Exit with appropriate code
        process.exit(failedTests > 0 ? 1 : 0);
        
    } catch (error) {
        log(`\n❌ Test suite failed: ${error.message}`, colors.red);
        process.exit(1);
    }
}

// Handle unhandled promises
process.on('unhandledRejection', (reason, promise) => {
    log(`❌ Unhandled rejection: ${reason}`, colors.red);
    process.exit(1);
});

// Check if fetch is available (Node.js 18+)
if (typeof fetch === 'undefined') {
    log('❌ This script requires Node.js 18+ for fetch API support', colors.red);
    log('Please upgrade Node.js or install node-fetch package', colors.yellow);
    process.exit(1);
}

// Run tests
runTests(); 