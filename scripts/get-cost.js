// Monthly cost data fetcher using AWS Cost Explorer
const { CostExplorerClient, GetCostAndUsageCommand } = require('@aws-sdk/client-cost-explorer');

const targetYear = 2025;
const targetMonth = 3;

// AWS Account configuration
const AWS_ACCOUNT_ID = '073848713973'; // GitHubに保存されているアカウントID

async function fetchMonthlyCost(year, month) {
    console.log(`Fetching monthly cost data for ${year}-${String(month).padStart(2, '0')}`);
    
    const startDate = `${year}-${String(month).padStart(2, '0')}-01`;
    const endDate = new Date(year, month, 0).toISOString().split('T')[0]; // Last day of the month

    const client = new CostExplorerClient({
        region: 'us-east-1'
    });

    const command = new GetCostAndUsageCommand({
        TimePeriod: {
            Start: startDate,
            End: endDate
        },
        Granularity: 'MONTHLY',
        Metrics: ['UnblendedCost'],
        GroupBy: [{ Type: 'DIMENSION', Key: 'LINKED_ACCOUNT' }],
        Filter: {
            And: [
                {
                    Dimensions: {
                        Key: 'RECORD_TYPE',
                        Values: ['Usage', 'Tax', 'Other']
                    }
                }
            ]
        }
    });

    try {
        const data = await client.send(command);
        const totalCost = data.ResultsByTime.reduce((acc, result) => {
            return acc + parseFloat(result.Total.UnblendedCost.Amount);
        }, 0);

        return {
            year,
            month,
            totalCost: parseFloat(totalCost.toFixed(2))
        };
    } catch (error) {
        console.error('Account ID:', AWS_ACCOUNT_ID);
        throw new Error(`Failed to fetch cost data: ${error.message}`);
    }
}

async function main() {
    try {
        const result = await fetchMonthlyCost(targetYear, targetMonth);
        console.log('Monthly cost:', result);
    } catch (error) {
        console.error('Error fetching cost data:', error);
        process.exit(1);
    }
}

main();