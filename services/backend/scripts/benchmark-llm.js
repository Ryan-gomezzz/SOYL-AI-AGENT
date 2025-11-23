/**
 * LLM Latency Benchmark Script
 * Measures Ollama inference latency with different prompt sizes
 * 
 * Usage:
 *   OLLAMA_URL=http://localhost:11434 node scripts/benchmark-llm.js
 *   OLLAMA_URL=http://<ec2-ip>:11434 OLLAMA_MODEL=llama3.2 ITERATIONS=10 node scripts/benchmark-llm.js
 */

const http = require('http');
const fs = require('fs').promises;
const path = require('path');

const OLLAMA_URL = process.env.OLLAMA_URL || 'http://localhost:11434';
const MODEL = process.env.OLLAMA_MODEL || 'llama3.2';
const ITERATIONS = parseInt(process.env.ITERATIONS || '10', 10);

const testPrompts = [
    { name: 'Small', text: 'What is 2+2?', expectedSize: '~10 tokens' },
    { name: 'Medium', text: 'Summarize the following text: ' + 'Lorem ipsum dolor sit amet. '.repeat(20), expectedSize: '~100 tokens' },
    { name: 'Large', text: 'Analyze this text: ' + 'Lorem ipsum dolor sit amet, consectetur adipiscing elit. '.repeat(100), expectedSize: '~500 tokens' }
];

async function makeRequest(prompt) {
    return new Promise((resolve, reject) => {
        const startTime = Date.now();
        const data = JSON.stringify({
            model: MODEL,
            prompt: prompt,
            stream: false
        });

        const url = new URL(OLLAMA_URL);
        const options = {
            hostname: url.hostname,
            port: url.port || 11434,
            path: '/api/generate',
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Content-Length': Buffer.byteLength(data)
            }
        };

        const req = http.request(options, (res) => {
            let body = '';
            res.on('data', (chunk) => { body += chunk; });
            res.on('end', () => {
                const endTime = Date.now();
                const latency = endTime - startTime;
                try {
                    const result = JSON.parse(body);
                    resolve({ latency, success: true, response: result });
                } catch (e) {
                    reject(new Error(`Invalid JSON response: ${e.message}`));
                }
            });
        });

        req.on('error', (error) => {
            reject(error);
        });

        req.setTimeout(60000, () => {
            req.destroy();
            reject(new Error('Request timeout after 60s'));
        });

        req.write(data);
        req.end();
    });
}

function calculateStats(latencies) {
    if (latencies.length === 0) return null;
    
    const sorted = [...latencies].sort((a, b) => a - b);
    const avg = latencies.reduce((a, b) => a + b, 0) / latencies.length;
    const p50 = sorted[Math.floor(sorted.length * 0.50)];
    const p95 = sorted[Math.floor(sorted.length * 0.95)];
    const p99 = sorted[Math.floor(sorted.length * 0.99)];

    return { 
        avg: Math.round(avg * 100) / 100, 
        p50: Math.round(p50 * 100) / 100, 
        p95: Math.round(p95 * 100) / 100, 
        p99: Math.round(p99 * 100) / 100, 
        min: sorted[0], 
        max: sorted[sorted.length - 1],
        count: latencies.length
    };
}

async function runBenchmark(promptConfig) {
    console.log(`\n📊 Benchmarking ${promptConfig.name} prompt (${promptConfig.expectedSize})...`);
    console.log('─'.repeat(60));

    const latencies = [];
    const errors = [];

    for (let i = 0; i < ITERATIONS; i++) {
        try {
            const result = await makeRequest(promptConfig.text);
            latencies.push(result.latency);
            process.stdout.write(`\r  Progress: ${i + 1}/${ITERATIONS} (${result.latency}ms)`);
        } catch (error) {
            errors.push({ iteration: i + 1, error: error.message });
            console.error(`\n  ❌ Error on iteration ${i + 1}: ${error.message}`);
        }
        // Small delay between requests
        if (i < ITERATIONS - 1) {
            await new Promise(resolve => setTimeout(resolve, 500));
        }
    }

    console.log('\n');

    if (latencies.length === 0) {
        console.log('❌ All requests failed. Cannot calculate statistics.');
        return null;
    }

    const stats = calculateStats(latencies);
    console.log(`  ✅ Successful requests: ${latencies.length}/${ITERATIONS}`);
    console.log(`  ⏱️  Average latency: ${stats.avg}ms`);
    console.log(`  📈 P50 latency: ${stats.p50}ms`);
    console.log(`  📈 P95 latency: ${stats.p95}ms`);
    console.log(`  📈 P99 latency: ${stats.p99}ms`);
    console.log(`  ⚡ Min latency: ${stats.min}ms`);
    console.log(`  🐌 Max latency: ${stats.max}ms`);

    if (errors.length > 0) {
        console.log(`  ⚠️  Errors: ${errors.length}`);
        errors.forEach(err => {
            console.log(`      - Iteration ${err.iteration}: ${err.error}`);
        });
    }

    return { ...stats, errors: errors.length };
}

async function main() {
    console.log('🚀 LLM Latency Benchmark');
    console.log('─'.repeat(60));
    console.log(`Ollama URL: ${OLLAMA_URL}`);
    console.log(`Model: ${MODEL}`);
    console.log(`Iterations per test: ${ITERATIONS}`);
    console.log(`Total tests: ${testPrompts.length}`);

    // Test connection first
    console.log('\n🔍 Testing Ollama connection...');
    try {
        const url = new URL(OLLAMA_URL);
        const testUrl = `${OLLAMA_URL}/api/tags`;
        const testData = await new Promise((resolve, reject) => {
            const req = http.get(testUrl, (res) => {
                let body = '';
                res.on('data', chunk => body += chunk);
                res.on('end', () => {
                    try {
                        resolve(JSON.parse(body));
                    } catch (e) {
                        reject(e);
                    }
                });
            });
            req.on('error', reject);
            req.setTimeout(5000, () => {
                req.destroy();
                reject(new Error('Connection timeout'));
            });
        });
        console.log('✅ Ollama connection successful');
        console.log(`   Available models: ${testData.models?.map(m => m.name).join(', ') || 'Unknown'}`);
    } catch (error) {
        console.error(`❌ Failed to connect to Ollama: ${error.message}`);
        console.error('   Please verify OLLAMA_URL and that Ollama is running');
        process.exit(1);
    }

    const results = {};

    for (const promptConfig of testPrompts) {
        const stats = await runBenchmark(promptConfig);
        if (stats) {
            results[promptConfig.name] = stats;
        }
        // Wait 2 seconds between tests
        await new Promise(resolve => setTimeout(resolve, 2000));
    }

    console.log('\n📊 Benchmark Summary');
    console.log('─'.repeat(60));
    console.log(JSON.stringify(results, null, 2));

    // Save results to file
    const resultsDir = path.join(__dirname, '../../docs');
    try {
        await fs.mkdir(resultsDir, { recursive: true });
        const resultsFile = path.join(resultsDir, `LLM_BENCHMARK_${new Date().toISOString().split('T')[0]}.json`);
        await fs.writeFile(resultsFile, JSON.stringify({
            date: new Date().toISOString(),
            ollama_url: OLLAMA_URL,
            model: MODEL,
            iterations: ITERATIONS,
            results: results
        }, null, 2));
        console.log(`\n✅ Results saved to: ${resultsFile}`);
    } catch (error) {
        console.error(`\n⚠️  Failed to save results file: ${error.message}`);
    }
}

if (require.main === module) {
    main().catch(error => {
        console.error('❌ Benchmark failed:', error);
        process.exit(1);
    });
}

module.exports = { runBenchmark, makeRequest };

