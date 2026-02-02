import { SavingsOpportunity } from '../types/opportunity';

interface HtmlReportMetadata {
  provider: string;
  region?: string;
  totalSavings: number;
  scanDate: Date;
}

interface HtmlReportOptions {
  includeCharts?: boolean;
  theme?: 'light' | 'dark';
}

export function exportToHtml(
  opportunities: SavingsOpportunity[],
  metadata: HtmlReportMetadata,
  options: HtmlReportOptions = {}
): string {
  const opts: HtmlReportOptions = {
    includeCharts: true,
    theme: 'light' as const,
    ...options,
  };

  return generateHtmlDocument(opportunities, metadata, opts);
}

function generateHtmlDocument(
  opportunities: SavingsOpportunity[],
  metadata: HtmlReportMetadata,
  options: HtmlReportOptions
): string {
  const includeCharts = options.includeCharts !== false;
  const theme = options.theme || 'light';
  
  const dateStr = metadata.scanDate.toISOString().split('T')[0];
  const monthlySavings = metadata.totalSavings;
  const yearlySavings = monthlySavings * 12;
  const avgSavings = opportunities.length > 0 ? monthlySavings / opportunities.length : 0;

  // Group opportunities by service for pie chart
  const serviceData: { [key: string]: number } = {};
  opportunities.forEach(opp => {
    const service = opp.resourceType;
    serviceData[service] = (serviceData[service] || 0) + opp.estimatedSavings;
  });

  const html = `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Cloud Cost Report - ${dateStr}</title>
  ${getInlineStyles(theme)}
</head>
<body>
  <div class="container">
    ${renderHeader(metadata)}
    ${renderSummary(monthlySavings, yearlySavings, opportunities.length, avgSavings)}
    ${includeCharts ? renderChartsSection(serviceData, opportunities) : ''}
    ${renderOpportunitiesTable(opportunities)}
    ${renderFooter()}
  </div>

  <script>
    ${getChartJsLibrary()}
    ${getInteractivityScript()}
    
    // Embed scan data
    const scanData = ${JSON.stringify({
      opportunities,
      metadata: {
        provider: metadata.provider,
        region: metadata.region,
        totalSavings: metadata.totalSavings,
        scanDate: metadata.scanDate.toISOString(),
      },
      serviceData,
    }, null, 2)};
    
    // Initialize
    window.addEventListener('DOMContentLoaded', function() {
      ${includeCharts ? 'initializeCharts(scanData);' : ''}
      initializeTable();
    });
  </script>
</body>
</html>`;

  return html;
}

function getInlineStyles(theme: 'light' | 'dark'): string {
  const isDark = theme === 'dark';
  
  return `<style>
    /* Reset and base styles */
    * { margin: 0; padding: 0; box-sizing: border-box; }
    
    body {
      font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Oxygen, Ubuntu, Cantarell, sans-serif;
      line-height: 1.6;
      color: ${isDark ? '#e5e7eb' : '#1f2937'};
      background: ${isDark ? '#111827' : '#f9fafb'};
      padding: 20px;
    }
    
    .container {
      max-width: 1400px;
      margin: 0 auto;
      background: ${isDark ? '#1f2937' : '#ffffff'};
      padding: 40px;
      border-radius: 12px;
      box-shadow: 0 4px 6px rgba(0, 0, 0, 0.1);
    }
    
    /* Header */
    header {
      border-bottom: 3px solid #3b82f6;
      padding-bottom: 20px;
      margin-bottom: 40px;
    }
    
    header h1 {
      font-size: 2.5rem;
      color: #3b82f6;
      margin-bottom: 10px;
      display: flex;
      align-items: center;
      gap: 12px;
    }
    
    header .meta {
      color: ${isDark ? '#9ca3af' : '#6b7280'};
      font-size: 1rem;
    }
    
    /* Summary Cards */
    .summary {
      display: grid;
      grid-template-columns: repeat(auto-fit, minmax(280px, 1fr));
      gap: 24px;
      margin-bottom: 40px;
    }
    
    .card {
      background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
      color: white;
      padding: 32px;
      border-radius: 12px;
      text-align: center;
      box-shadow: 0 4px 6px rgba(102, 126, 234, 0.25);
      transition: transform 0.2s;
    }
    
    .card:hover {
      transform: translateY(-4px);
    }
    
    .card h3 {
      font-size: 0.875rem;
      text-transform: uppercase;
      letter-spacing: 1.5px;
      opacity: 0.95;
      margin-bottom: 12px;
      font-weight: 600;
    }
    
    .card .big-number {
      font-size: 3rem;
      font-weight: bold;
      margin-bottom: 8px;
      line-height: 1;
    }
    
    .card .sub {
      font-size: 1rem;
      opacity: 0.85;
    }
    
    /* Charts Section */
    .charts {
      display: grid;
      grid-template-columns: repeat(auto-fit, minmax(450px, 1fr));
      gap: 32px;
      margin-bottom: 48px;
    }
    
    .chart-container {
      background: ${isDark ? '#374151' : '#ffffff'};
      padding: 28px;
      border: 1px solid ${isDark ? '#4b5563' : '#e5e7eb'};
      border-radius: 12px;
      box-shadow: 0 2px 4px rgba(0, 0, 0, 0.05);
    }
    
    .chart-container h3 {
      margin-bottom: 24px;
      color: ${isDark ? '#f3f4f6' : '#1f2937'};
      font-size: 1.25rem;
      font-weight: 600;
    }
    
    .chart-wrapper {
      position: relative;
      height: 300px;
    }
    
    /* Opportunities Section */
    .opportunities h2 {
      font-size: 1.75rem;
      margin-bottom: 24px;
      color: ${isDark ? '#f3f4f6' : '#1f2937'};
    }
    
    .filters {
      display: flex;
      gap: 16px;
      margin-bottom: 24px;
      flex-wrap: wrap;
    }
    
    .filters input,
    .filters select {
      padding: 10px 16px;
      border: 1px solid ${isDark ? '#4b5563' : '#d1d5db'};
      border-radius: 8px;
      font-size: 0.9rem;
      background: ${isDark ? '#374151' : '#ffffff'};
      color: ${isDark ? '#f3f4f6' : '#1f2937'};
      transition: border-color 0.2s;
    }
    
    .filters input:focus,
    .filters select:focus {
      outline: none;
      border-color: #3b82f6;
      box-shadow: 0 0 0 3px rgba(59, 130, 246, 0.1);
    }
    
    .filters input {
      flex: 1;
      min-width: 250px;
    }
    
    /* Table */
    .table-wrapper {
      overflow-x: auto;
      border-radius: 8px;
      border: 1px solid ${isDark ? '#4b5563' : '#e5e7eb'};
    }
    
    table {
      width: 100%;
      border-collapse: collapse;
    }
    
    thead {
      background: ${isDark ? '#374151' : '#f9fafb'};
      position: sticky;
      top: 0;
    }
    
    th {
      text-align: left;
      padding: 16px;
      font-weight: 600;
      color: ${isDark ? '#f3f4f6' : '#374151'};
      border-bottom: 2px solid ${isDark ? '#4b5563' : '#e5e7eb'};
      cursor: pointer;
      user-select: none;
      white-space: nowrap;
    }
    
    th:hover {
      background: ${isDark ? '#4b5563' : '#f3f4f6'};
    }
    
    th .sort-indicator {
      margin-left: 8px;
      color: #3b82f6;
      font-size: 0.8rem;
    }
    
    td {
      padding: 14px 16px;
      border-bottom: 1px solid ${isDark ? '#374151' : '#e5e7eb'};
      color: ${isDark ? '#d1d5db' : '#4b5563'};
    }
    
    tbody tr {
      transition: background-color 0.15s;
    }
    
    tbody tr:hover {
      background: ${isDark ? '#374151' : '#f9fafb'};
    }
    
    tbody tr.hidden {
      display: none;
    }
    
    .provider-badge {
      display: inline-block;
      padding: 4px 10px;
      border-radius: 6px;
      font-size: 0.75rem;
      font-weight: 600;
      text-transform: uppercase;
      letter-spacing: 0.5px;
    }
    
    .provider-aws {
      background: #ff9900;
      color: white;
    }
    
    .provider-azure {
      background: #0078d4;
      color: white;
    }
    
    .provider-gcp {
      background: #4285f4;
      color: white;
    }
    
    .resource-id {
      font-family: 'SF Mono', Monaco, 'Cascadia Code', 'Courier New', monospace;
      font-size: 0.85rem;
      color: ${isDark ? '#9ca3af' : '#6b7280'};
    }
    
    .savings {
      color: #059669;
      font-weight: 600;
      font-size: 1rem;
    }
    
    .recommendation {
      max-width: 400px;
    }
    
    /* Footer */
    footer {
      margin-top: 48px;
      padding-top: 24px;
      border-top: 1px solid ${isDark ? '#374151' : '#e5e7eb'};
      text-align: center;
      color: ${isDark ? '#9ca3af' : '#6b7280'};
      font-size: 0.9rem;
    }
    
    footer a {
      color: #3b82f6;
      text-decoration: none;
      font-weight: 500;
    }
    
    footer a:hover {
      text-decoration: underline;
    }
    
    /* Print styles */
    @media print {
      body {
        background: white;
        padding: 0;
      }
      
      .container {
        box-shadow: none;
        max-width: 100%;
      }
      
      .filters {
        display: none;
      }
      
      .card {
        break-inside: avoid;
      }
      
      .chart-container {
        break-inside: avoid;
      }
      
      tbody tr:hover {
        background: transparent;
      }
    }
    
    /* Responsive */
    @media (max-width: 768px) {
      .container {
        padding: 20px;
      }
      
      header h1 {
        font-size: 1.75rem;
      }
      
      .summary {
        grid-template-columns: 1fr;
      }
      
      .charts {
        grid-template-columns: 1fr;
      }
      
      .filters {
        flex-direction: column;
      }
      
      .filters input,
      .filters select {
        width: 100%;
      }
      
      table {
        font-size: 0.85rem;
      }
      
      th, td {
        padding: 10px;
      }
    }
  </style>`;
}

function renderHeader(metadata: HtmlReportMetadata): string {
  const dateStr = metadata.scanDate.toLocaleString('en-US', {
    year: 'numeric',
    month: 'long',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
    timeZoneName: 'short',
  });

  return `
    <header>
      <h1>☁️ Cloud Cost Optimization Report</h1>
      <div class="meta">
        Generated: ${dateStr} | 
        Provider: ${metadata.provider.toUpperCase()} | 
        Region: ${metadata.region || 'N/A'}
      </div>
    </header>
  `;
}

function renderSummary(
  monthlySavings: number,
  yearlySavings: number,
  opportunitiesCount: number,
  avgSavings: number
): string {
  return `
    <section class="summary">
      <div class="card">
        <h3>Total Potential Savings</h3>
        <div class="big-number">$${monthlySavings.toFixed(0)}</div>
        <div class="sub">$${yearlySavings.toFixed(0)}/year</div>
      </div>
      <div class="card">
        <h3>Opportunities Found</h3>
        <div class="big-number">${opportunitiesCount}</div>
        <div class="sub">${opportunitiesCount === 1 ? 'resource' : 'resources'} to optimize</div>
      </div>
      <div class="card">
        <h3>Average Savings</h3>
        <div class="big-number">$${avgSavings.toFixed(0)}</div>
        <div class="sub">per opportunity</div>
      </div>
    </section>
  `;
}

function renderChartsSection(
  serviceData: { [key: string]: number },
  opportunities: SavingsOpportunity[]
): string {
  return `
    <section class="charts">
      <div class="chart-container">
        <h3>💰 Savings by Service</h3>
        <div class="chart-wrapper">
          <canvas id="savingsByService"></canvas>
        </div>
      </div>
      <div class="chart-container">
        <h3>📊 Top 10 Opportunities</h3>
        <div class="chart-wrapper">
          <canvas id="topOpportunities"></canvas>
        </div>
      </div>
    </section>
  `;
}

function renderOpportunitiesTable(opportunities: SavingsOpportunity[]): string {
  const rows = opportunities
    .map((opp, index) => {
      return `
      <tr>
        <td>${index + 1}</td>
        <td><span class="provider-badge provider-${opp.provider}">${opp.provider}</span></td>
        <td>${opp.resourceType}</td>
        <td class="resource-id">${escapeHtml(opp.resourceId)}</td>
        <td class="recommendation">${escapeHtml(opp.recommendation)}</td>
        <td class="savings">$${opp.estimatedSavings.toFixed(2)}</td>
      </tr>
    `;
    })
    .join('');

  return `
    <section class="opportunities">
      <h2>🔍 All Opportunities</h2>
      <div class="filters">
        <input type="search" id="searchInput" placeholder="Search resources, services, or recommendations..." />
        <select id="sortBy">
          <option value="savings-desc">Sort by: Savings (High to Low)</option>
          <option value="savings-asc">Sort by: Savings (Low to High)</option>
          <option value="service">Sort by: Service</option>
          <option value="provider">Sort by: Provider</option>
        </select>
      </div>
      <div class="table-wrapper">
        <table id="opportunitiesTable">
          <thead>
            <tr>
              <th data-sort="index">#</th>
              <th data-sort="provider">Provider <span class="sort-indicator"></span></th>
              <th data-sort="service">Service <span class="sort-indicator"></span></th>
              <th data-sort="resource">Resource ID <span class="sort-indicator"></span></th>
              <th data-sort="recommendation">Recommendation <span class="sort-indicator"></span></th>
              <th data-sort="savings">Savings/mo <span class="sort-indicator"></span></th>
            </tr>
          </thead>
          <tbody>
            ${rows}
          </tbody>
        </table>
      </div>
    </section>
  `;
}

function renderFooter(): string {
  return `
    <footer>
      <p>Generated by <strong>cloud-cost-cli</strong></p>
      <p>
        <a href="https://github.com/vuhp/cloud-cost-cli" target="_blank">GitHub</a> | 
        <a href="https://www.npmjs.com/package/cloud-cost-cli" target="_blank">npm</a>
      </p>
    </footer>
  `;
}

function escapeHtml(text: string): string {
  // Simple HTML escaping (works in Node and browser)
  return text.replace(/[&<>"']/g, (char) => {
    const entities: { [key: string]: string } = {
      '&': '&amp;',
      '<': '&lt;',
      '>': '&gt;',
      '"': '&quot;',
      "'": '&#39;',
    };
    return entities[char] || char;
  });
}

function getChartJsLibrary(): string {
  // For now, use CDN link in script tag
  // Later we can inline the minified Chart.js
  return `
    // Chart.js will be loaded from CDN
  `;
}

function getInteractivityScript(): string {
  return `
    // Chart.js CDN (v4.4.1)
    const chartScript = document.createElement('script');
    chartScript.src = 'https://cdn.jsdelivr.net/npm/chart.js@4.4.1/dist/chart.umd.min.js';
    document.head.appendChild(chartScript);
    
    function initializeCharts(data) {
      chartScript.onload = function() {
        // Savings by Service Pie Chart
        const ctx1 = document.getElementById('savingsByService');
        if (ctx1 && data.serviceData) {
          const services = Object.keys(data.serviceData);
          const savings = Object.values(data.serviceData);
          
          new Chart(ctx1, {
            type: 'pie',
            data: {
              labels: services,
              datasets: [{
                data: savings,
                backgroundColor: [
                  '#3b82f6', '#10b981', '#f59e0b', '#ef4444',
                  '#8b5cf6', '#ec4899', '#06b6d4', '#f97316'
                ],
                borderWidth: 2,
                borderColor: '#ffffff'
              }]
            },
            options: {
              responsive: true,
              maintainAspectRatio: false,
              plugins: {
                legend: {
                  position: 'bottom',
                  labels: {
                    padding: 15,
                    font: { size: 12 }
                  }
                },
                tooltip: {
                  callbacks: {
                    label: function(context) {
                      const label = context.label || '';
                      const value = context.parsed || 0;
                      return label + ': $' + value.toFixed(2) + '/mo';
                    }
                  }
                }
              }
            }
          });
        }
        
        // Top 10 Opportunities Bar Chart
        const ctx2 = document.getElementById('topOpportunities');
        if (ctx2 && data.opportunities) {
          const top10 = data.opportunities.slice(0, 10);
          
          // Shorter labels for Y-axis (just show #1, #2, etc. and service type)
          const labels = top10.map((o, i) => {
            return '#' + (i + 1) + ' ' + o.resourceType;
          });
          
          const savings = top10.map(o => o.estimatedSavings);
          
          new Chart(ctx2, {
            type: 'bar',
            data: {
              labels: labels,
              datasets: [{
                label: 'Savings ($)',
                data: savings,
                backgroundColor: '#3b82f6',
                borderRadius: 6
              }]
            },
            options: {
              responsive: true,
              maintainAspectRatio: false,
              indexAxis: 'y',
              plugins: {
                legend: { display: false },
                tooltip: {
                  callbacks: {
                    title: function(context) {
                      const index = context[0].dataIndex;
                      const opp = top10[index];
                      return opp.resourceType + ': ' + opp.resourceId;
                    },
                    label: function(context) {
                      const index = context.dataIndex;
                      const opp = top10[index];
                      return [
                        'Savings: $' + context.parsed.x.toFixed(2) + '/mo',
                        'Recommendation: ' + opp.recommendation
                      ];
                    }
                  }
                }
              },
              scales: {
                x: {
                  beginAtZero: true,
                  ticks: {
                    callback: function(value) {
                      return '$' + value;
                    }
                  }
                },
                y: {
                  ticks: {
                    font: {
                      size: 11
                    }
                  }
                }
              }
            }
          });
        }
      };
    }
    
    function initializeTable() {
      const searchInput = document.getElementById('searchInput');
      const sortSelect = document.getElementById('sortBy');
      const table = document.getElementById('opportunitiesTable');
      const tbody = table.querySelector('tbody');
      const rows = Array.from(tbody.querySelectorAll('tr'));
      
      // Search functionality
      if (searchInput) {
        searchInput.addEventListener('input', function(e) {
          const query = e.target.value.toLowerCase();
          rows.forEach(row => {
            const text = row.textContent.toLowerCase();
            if (text.includes(query)) {
              row.classList.remove('hidden');
            } else {
              row.classList.add('hidden');
            }
          });
        });
      }
      
      // Sort functionality
      if (sortSelect) {
        sortSelect.addEventListener('change', function(e) {
          const sortBy = e.target.value;
          const sortedRows = [...rows];
          
          sortedRows.sort((a, b) => {
            if (sortBy === 'savings-desc') {
              const aVal = parseFloat(a.cells[5].textContent.replace(/[$,]/g, ''));
              const bVal = parseFloat(b.cells[5].textContent.replace(/[$,]/g, ''));
              return bVal - aVal;
            } else if (sortBy === 'savings-asc') {
              const aVal = parseFloat(a.cells[5].textContent.replace(/[$,]/g, ''));
              const bVal = parseFloat(b.cells[5].textContent.replace(/[$,]/g, ''));
              return aVal - bVal;
            } else if (sortBy === 'service') {
              return a.cells[2].textContent.localeCompare(b.cells[2].textContent);
            } else if (sortBy === 'provider') {
              return a.cells[1].textContent.localeCompare(b.cells[1].textContent);
            }
            return 0;
          });
          
          // Re-append sorted rows
          sortedRows.forEach(row => tbody.appendChild(row));
          
          // Update row numbers
          sortedRows.forEach((row, index) => {
            row.cells[0].textContent = (index + 1).toString();
          });
        });
      }
    }
  `;
}
