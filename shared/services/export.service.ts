import { PropertyAnalysis } from '../services/api/services.js';

export interface ExportOptions {
  format: 'html' | 'markdown' | 'json' | 'csv';
  includeRawData: boolean;
  includeHistorical: boolean;
  includeCharts: boolean;
  template: 'modern' | 'classic' | 'minimal';
}

export interface ExportData {
  analysis: PropertyAnalysis;
  rawData: any;
  historicalData?: any;
  timestamp: Date;
}

export class ExportService {
  /**
   * Generate comprehensive report with all data
   */
  static async generateFullReport(
    analysis: PropertyAnalysis,
    options: ExportOptions
  ): Promise<{
    content: string;
    filename: string;
    format: string;
    metadata: any;
  }> {
    const exportData: ExportData = {
      analysis,
      rawData: this.extractRawData(analysis),
      historicalData: options.includeHistorical ? await this.getHistoricalData(analysis) : null,
      timestamp: new Date()
    };

    switch (options.format) {
      case 'html':
        return this.generateHTMLReport(exportData, options);
      case 'markdown':
        return this.generateMarkdownReport(exportData, options);
      case 'json':
        return this.generateJSONReport(exportData, options);
      case 'csv':
        return this.generateCSVReport(exportData, options);
      default:
        throw new Error(`Unsupported format: ${options.format}`);
    }
  }

  /**
   * Generate HTML report with embedded CSS
   */
  private static generateHTMLReport(
    data: ExportData,
    options: ExportOptions
  ): { content: string; filename: string; format: string; metadata: any } {
    const { analysis, rawData, historicalData } = data;
    const template = options.template || 'modern';

    const htmlContent = `
<!DOCTYPE html>
<html lang="vi">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Báo Cáo Phân Tích Bất Động Sản - ${this.formatDate(new Date())}</title>
    <style>
        ${this.getTemplateCSS(template)}
    </style>
</head>
<body>
    <div class="report-container">
        ${this.generateHTMLHeader(analysis, data.timestamp)}

        <main class="report-content">
            ${this.generateHTMLSection('basic-info', '📊 Thông tin cơ bản', this.generateBasicInfoHTML(analysis, rawData))}
            ${this.generateHTMLSection('location', '📍 Vị trí', this.generateLocationHTML(analysis))}
            ${this.generateHTMLSection('amenities', '🏪 Tiện ích xung quanh', this.generateAmenitiesHTML(analysis.amenities, rawData))}
            ${this.generateHTMLSection('infrastructure', '🛣️ Hạ tầng giao thông', this.generateInfrastructureHTML(analysis.infrastructure, rawData))}
            ${this.generateHTMLSection('market', '📈 Phân tích thị trường', this.generateMarketHTML(analysis.marketData, rawData))}
            ${this.generateHTMLSection('ai-analysis', '🤖 Phân tích AI', this.generateAIAnalysisHTML(analysis.aiAnalysis, rawData))}
            ${options.includeHistorical && historicalData ? this.generateHTMLSection('historical', '📊 Dữ liệu lịch sử', this.generateHistoricalHTML(historicalData, rawData)) : ''}
            ${options.includeRawData ? this.generateHTMLSection('raw-data', '📋 Dữ liệu thô', this.generateRawDataHTML(rawData)) : ''}
        </main>

        ${this.generateHTMLFooter(data.timestamp)}
    </div>

    <script>
        ${this.getTemplateJS(template)}
    </script>
</body>
</html>`;

    return {
      content: htmlContent,
      filename: `property-analysis-${analysis.id}-${Date.now()}.html`,
      format: 'html',
      metadata: {
        template,
        sections: this.getReportSections(options),
        dataSize: htmlContent.length,
        generatedAt: data.timestamp
      }
    };
  }

  /**
   * Generate enhanced Markdown report
   */
  private static generateMarkdownReport(
    data: ExportData,
    options: ExportOptions
  ): { content: string; filename: string; format: string; metadata: any } {
    const { analysis, rawData, historicalData } = data;

    let markdown = `# 🏠 Báo Cáo Phân Tích Bất Động Sản\n\n`;

    // Header
    markdown += `**Ngày tạo:** ${this.formatDate(data.timestamp)}\n`;
    markdown += `**ID Phân tích:** \`${analysis.id}\`\n`;
    if (analysis.center) {
      markdown += `**Vị trí:** [Xem trên Google Maps](https://maps.google.com/?q=${analysis.center.lat},${analysis.center.lng})\n`;
    }
    markdown += `\n---\n\n`;

    // Basic Info
    markdown += `## 📊 Thông tin cơ bản\n\n`;
    markdown += `| Thuộc tính | Giá trị | Chi tiết |\n`;
    markdown += `|-----------|---------|---------|\n`;
    markdown += `| **Diện tích** | ${analysis.area ? analysis.area.toLocaleString('vi-VN') : 'N/A'} m² | ${rawData.areaDetails || ''} |\n`;
    markdown += `| **Hướng** | ${analysis.orientation || 'N/A'} | ${rawData.orientationDetails || ''} |\n`;
    markdown += `| **Số mặt tiền** | ${analysis.frontageCount || 'N/A'} | ${rawData.frontageDetails || ''} |\n`;
    markdown += `| **Tọa độ** | ${analysis.center ? `${analysis.center.lat.toFixed(6)}, ${analysis.center.lng.toFixed(6)}` : 'N/A'} | [WGS84](https://www.google.com/maps?q=${analysis.center?.lat},${analysis.center?.lng}) |\n`;
    markdown += `| **Bán kính tìm kiếm** | ${rawData.searchRadius || 'N/A'}m | Phạm vi phân tích tiện ích |\n`;
    markdown += `\n`;

    // Raw data if requested
    if (options.includeRawData && rawData.coordinates) {
      markdown += `### 📐 Tọa độ chi tiết\n\n`;
      markdown += `\`\`\`json\n${JSON.stringify(rawData.coordinates, null, 2)}\n\`\`\`\n\n`;
    }

    // Location
    if (analysis.center) {
      markdown += `## 📍 Vị trí\n\n`;
      markdown += `- **Latitude:** ${analysis.center.lat}\n`;
      markdown += `- **Longitude:** ${analysis.center.lng}\n`;
      markdown += `- **Địa dịch:** ${rawData.reverseGeocoded || 'Đang xử lý...'}\n`;
      markdown += `- **Quận/Huyện:** ${rawData.district || 'N/A'}\n`;
      markdown += `- **Tỉnh/Thành phố:** ${rawData.province || 'N/A'}\n\n`;
    }

    // Amenities
    if (analysis.amenities) {
      markdown += `## 🏪 Tiện ích xung quanh\n\n`;
      analysis.amenities.forEach((category: any) => {
        markdown += `### ${category.name}\n\n`;
        if (category.items && category.items.length > 0) {
          markdown += `- **Tổng số:** ${category.items.length}\n`;
          markdown += `- **Các tiện ích nổi bật:**\n`;
          category.items.slice(0, 10).forEach((item: any, index: number) => {
            markdown += `  ${index + 1}. **${item.name}** - ${item.distance ? `${item.distance}m` : 'N/A'}\n`;
          });
          if (category.items.length > 10) {
            markdown += `  ... và ${category.items.length - 10} tiện ích khác\n`;
          }
        } else {
          markdown += `- Chưa tìm thấy tiện ích trong khu vực\n`;
        }
        markdown += `\n`;
      });
    }

    // Infrastructure
    if (analysis.infrastructure) {
      markdown += `## 🛣️ Hạ tầng giao thông\n\n`;
      markdown += `| Loại | Tên | Khoảng cách | Mô tả |\n`;
      markdown += `|------|-----|------------|-------|\n`;
      analysis.infrastructure.forEach((infra: any) => {
        markdown += `| ${infra.type || 'N/A'} | ${infra.name || 'N/A'} | ${infra.distance || 'N/A'}m | ${infra.description || ''} |\n`;
      });
      markdown += `\n`;
    }

    // Market Data
    if (analysis.marketData) {
      markdown += `## 📈 Phân tích thị trường\n\n`;

      if (analysis.marketData.avgPrice) {
        markdown += `### Thống kê giá\n\n`;
        markdown += `- **Giá trung bình:** ${this.formatCurrency(analysis.marketData.avgPrice)}\n`;
        markdown += `- **Giá trung bình/m²:** ${analysis.marketData.avgPricePerSqm ? this.formatCurrency(analysis.marketData.avgPricePerSqm) : 'N/A'}\n`;
        markdown += `- **Số lượng so sánh:** ${analysis.marketData.comparableListings ? analysis.marketData.comparableListings.length : 0}\n\n`;
      }

      if (analysis.marketData.comparableListings && analysis.marketData.comparableListings.length > 0) {
        markdown += `### Bất động sản tương tự\n\n`;
        markdown += `| STT | Tên | Giá | Diện tích | Giá/m² | Nguồn |\n`;
        markdown += `|-----|-----|-----|----------|--------|-------|\n`;
        analysis.marketData.comparableListings.forEach((listing: any, index: number) => {
          markdown += `| ${index + 1} | ${listing.title || 'N/A'} | ${this.formatCurrency(listing.price)} | ${listing.area || 'N/A'} m² | ${listing.pricePerSqm ? this.formatCurrency(listing.pricePerSqm) : 'N/A'} | ${listing.source || 'N/A'} |\n`;
        });
        markdown += `\n`;
      }
    }

    // AI Analysis
    if (analysis.aiAnalysis) {
      markdown += `## 🤖 Phân tích AI\n\n`;

      if (analysis.aiAnalysis.score !== undefined) {
        markdown += `### Đánh giá tổng quan\n\n`;
        markdown += `**Điểm số:** ${analysis.aiAnalysis.score}/100\n\n`;

        const scoreColor = analysis.aiAnalysis.score > 70 ? '🟢' : analysis.aiAnalysis.score > 50 ? '🟡' : '🔴';
        markdown += `${scoreColor} **Đánh giá:** ${this.getScoreInterpretation(analysis.aiAnalysis.score)}\n\n`;
      }

      if (analysis.aiAnalysis.recommendations) {
        markdown += `### Đề xuất đầu tư\n\n`;
        analysis.aiAnalysis.recommendations.forEach((rec: string, index: number) => {
          markdown += `${index + 1}. ${rec}\n`;
        });
        markdown += `\n`;
      }

      if (analysis.aiAnalysis.risks) {
        markdown += `### Phân tích rủi ro\n\n`;
        analysis.aiAnalysis.risks.forEach((risk: any) => {
          const riskIcon = risk.level === 'high' ? '🔴' : risk.level === 'medium' ? '🟡' : '🟢';
          markdown += `- ${riskIcon} **${risk.type}:** ${risk.level} - ${risk.description}\n`;
        });
        markdown += `\n`;
      }
    }

    // Historical Data
    if (options.includeHistorical && historicalData) {
      markdown += `## 📊 Dữ liệu lịch sử\n\n`;
      markdown += `### Xu hướng giá\n\n`;

      const trends = historicalData.trends || {};
      const periods = ['1month', '3months', '6months', '1year'];

      periods.forEach(period => {
        if (trends[period]) {
          const trend = trends[period];
          const icon = trend.trendDirection === 'up' ? '📈' : trend.trendDirection === 'down' ? '📉' : '➡️';
          markdown += `- **${this.formatPeriod(period)}:** ${icon} ${trend.changePercent > 0 ? '+' : ''}${trend.changePercent}% (${this.formatCurrency(trend.changeAmount)})\n`;
        }
      });

      markdown += `\n`;

      if (historicalData.quickStats) {
        markdown += `### Thống kê nhanh\n\n`;
        markdown += `- **Giá trung bình:** ${this.formatCurrency(historicalData.quickStats.avgPrice)}\n`;
        markdown += `- **Giá/m² trung bình:** ${this.formatCurrency(historicalData.quickStats.avgPricePerSqm)}\n`;
        markdown += `- **Tổng số listing:** ${historicalData.quickStats.totalListings}\n`;
        markdown += `- **Nhiệt độ thị trường:** ${historicalData.quickStats.marketHeat}\n\n`;
      }
    }

    // Raw Data Section
    if (options.includeRawData) {
      markdown += `## 📋 Dữ liệu thô\n\n`;
      markdown += `<details>\n<summary>🔍 Xem dữ liệu thô đầy đủ</summary>\n\n`;
      markdown += `\`\`\`json\n${JSON.stringify({ analysis, rawData, historicalData }, null, 2)}\n\`\`\`\n\n`;
      markdown += `</details>\n\n`;
    }

    // Footer
    markdown += `---\n\n`;
    markdown += `## 🎯 Kết luận\n\n`;
    markdown += `**Khuyến nghị:** ${analysis.aiAnalysis && analysis.aiAnalysis.score ?
      (analysis.aiAnalysis.score > 70 ? '✅ **NÊN ĐẦU TƯ** - Đất nền có tiềm năng tốt' :
       analysis.aiAnalysis.score > 50 ? '⚠️ **CÂN NHẮN** - Cần xem xét thêm yếu tố khác' :
       '❌ **CHƯA NÊN ĐẦU TƯ** - Rủi ro cao hơn lợi nhuận') :
      '⏳ **ĐANG PHÂN TÍCH** - Vui lòng đợi AI hoàn thành đánh giá'}\n\n`;

    markdown += `---\n\n`;
    markdown += `*Báo cáo được tạo tự động bởi Vietnam Real Estate Analysis Platform*\n`;
    markdown += `*Ngày tạo: ${this.formatDate(data.timestamp)}*\n`;
    markdown += `*ID: ${analysis.id}*\n`;

    return {
      content: markdown,
      filename: `property-analysis-${analysis.id}-${Date.now()}.md`,
      format: 'markdown',
      metadata: {
        sections: this.getReportSections(options),
        dataSize: markdown.length,
        generatedAt: data.timestamp
      }
    };
  }

  /**
   * Generate JSON report
   */
  private static generateJSONReport(
    data: ExportData,
    options: ExportOptions
  ): { content: string; filename: string; format: string; metadata: any } {
    const report = {
      metadata: {
        id: data.analysis.id,
        generatedAt: data.timestamp,
        format: options.format,
        version: '1.0'
      },
      analysis: data.analysis,
      ...(options.includeRawData && { rawData: data.rawData }),
      ...(options.includeHistorical && { historicalData: data.historicalData })
    };

    return {
      content: JSON.stringify(report, null, 2),
      filename: `property-analysis-${data.analysis.id}-${Date.now()}.json`,
      format: 'json',
      metadata: {
        sections: this.getReportSections(options),
        dataSize: JSON.stringify(report).length,
        generatedAt: data.timestamp
      }
    };
  }

  /**
   * Generate CSV report
   */
  private static generateCSVReport(
    data: ExportData,
    options: ExportOptions
  ): { content: string; filename: string; format: string; metadata: any } {
    let csv = 'Category,Item,Value,Unit,Details\n';

    // Basic metrics
    csv += `Basic Info,Area,${data.analysis.area || 'N/A'},m²,Property area\n`;
    csv += `Basic Info,Orientation,${data.analysis.orientation || 'N/A'},,Property orientation\n`;
    csv += `Basic Info,Frontage Count,${data.analysis.frontageCount || 'N/A'},,Number of street fronts\n`;

    if (data.analysis.center) {
      csv += `Location,Latitude,${data.analysis.center.lat},,,\n`;
      csv += `Location,Longitude,${data.analysis.center.lng},,,\n`;
    }

    // Amenities
    if (data.analysis.amenities) {
      data.analysis.amenities.forEach((category: any) => {
        csv += `Amenities,${category.name},${category.items ? category.items.length : 0},count,Total amenities in category\n`;
        if (category.items) {
          category.items.slice(0, 5).forEach((item: any) => {
            csv += `Amenities,${item.name},${item.distance || 'N/A'},m,${category.name} amenity\n`;
          });
        }
      });
    }

    // Market data
    if (data.analysis.marketData) {
      csv += `Market,Average Price,${data.analysis.marketData.avgPrice || 'N/A'},VND,Khu vực giá trung bình\n`;
      csv += `Market,Price/m²,${data.analysis.marketData.avgPricePerSqm || 'N/A'},VND/m²,Giá trên mét vuông\n`;
    }

    // AI Analysis
    if (data.analysis.aiAnalysis) {
      csv += `AI Analysis,Score,${data.analysis.aiAnalysis.score || 'N/A'},/100,AI confidence score\n`;
      if (data.analysis.aiAnalysis.recommendations) {
        data.analysis.aiAnalysis.recommendations.forEach((rec: string, index: number) => {
          csv += `AI Analysis,Recommendation ${index + 1},"${rec.replace(/"/g, '""')}",,AI recommendation\n`;
        });
      }
    }

    return {
      content: csv,
      filename: `property-analysis-${data.analysis.id}-${Date.now()}.csv`,
      format: 'csv',
      metadata: {
        sections: this.getReportSections(options),
        dataSize: csv.length,
        generatedAt: data.timestamp
      }
    };
  }

  /**
   * Extract raw data from analysis
   */
  private static extractRawData(analysis: PropertyAnalysis): any {
    return {
      coordinates: analysis.coordinates,
      areaDetails: `${analysis.area || 0}m² (${analysis.area ? (analysis.area * 10.764) : 0} sq ft)`,
      orientationDetails: analysis.orientation ? `Hướng ${analysis.orientation}` : null,
      frontageDetails: analysis.frontageCount ? `${analysis.frontageCount} mặt tiền` : null,
      searchRadius: 2000, // Default search radius
      amenitiesCount: analysis.amenities ? analysis.amenities.reduce((sum: number, cat: any) => sum + (cat.items ? cat.items.length : 0), 0) : 0,
      infrastructureCount: analysis.infrastructure ? analysis.infrastructure.length : 0,
      marketDataCount: analysis.marketData && analysis.marketData.comparableListings ? analysis.marketData.comparableListings.length : 0,
      aiScore: analysis.aiAnalysis ? analysis.aiAnalysis.score : null,
      risksCount: analysis.aiAnalysis && analysis.aiAnalysis.risks ? analysis.aiAnalysis.risks.length : 0
    };
  }

  /**
   * Get historical data (mock for now)
   */
  private static async getHistoricalData(analysis: PropertyAnalysis): Promise<any> {
    // Mock data - in production would query real historical data
    return {
      location: analysis.center ? `${analysis.center.lat}, ${analysis.center.lng}` : 'Unknown',
      quickStats: {
        avgPrice: 45000000000,
        avgPricePerSqm: 45000000,
        totalListings: 89,
        marketHeat: 'warm'
      },
      trends: {
        '1month': { changePercent: 2.5, changeAmount: 1125000000, trendDirection: 'up' },
        '3months': { changePercent: 7.2, changeAmount: 3240000000, trendDirection: 'up' },
        '6months': { changePercent: 12.8, changeAmount: 5760000000, trendDirection: 'up' },
        '1year': { changePercent: 18.5, changeAmount: 8325000000, trendDirection: 'up' }
      },
      recommendations: [
        'Giá đang có xu hướng tăng đều trong 12 tháng qua',
        'Nhu cầu cao trong khu vực do phát triển hạ tầng',
        'Tiềm năng tăng giá tốt trong trung và dài hạn'
      ]
    };
  }

  /**
   * Template CSS
   */
  private static getTemplateCSS(template: string): string {
    switch (template) {
      case 'modern':
        return `
          @import url('https://fonts.googleapis.com/css2?family=Inter:wght@300;400;500;600;700&display=swap');

          * { margin: 0; padding: 0; box-sizing: border-box; }

          body {
            font-family: 'Inter', -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif;
            line-height: 1.6;
            color: #1a1a1a;
            background: #f8fafc;
          }

          .report-container {
            max-width: 1200px;
            margin: 0 auto;
            background: white;
            box-shadow: 0 0 40px rgba(0,0,0,0.1);
          }

          .report-header {
            background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
            color: white;
            padding: 3rem 2rem;
            text-align: center;
          }

          .report-header h1 {
            font-size: 2.5rem;
            margin-bottom: 1rem;
            font-weight: 700;
          }

          .report-header .meta {
            opacity: 0.9;
            font-size: 1.1rem;
          }

          .report-content {
            padding: 3rem 2rem;
          }

          .section {
            margin-bottom: 4rem;
          }

          .section-title {
            font-size: 1.5rem;
            font-weight: 600;
            margin-bottom: 2rem;
            color: #2563eb;
            display: flex;
            align-items: center;
            gap: 0.5rem;
          }

          .data-table {
            width: 100%;
            border-collapse: collapse;
            margin: 2rem 0;
            background: white;
            border-radius: 8px;
            overflow: hidden;
            box-shadow: 0 1px 3px rgba(0,0,0,0.1);
          }

          .data-table th {
            background: #f1f5f9;
            padding: 1rem;
            text-align: left;
            font-weight: 600;
            color: #374151;
          }

          .data-table td {
            padding: 1rem;
            border-bottom: 1px solid #e5e7eb;
          }

          .data-table tr:hover {
            background: #f9fafb;
          }

          .metric-grid {
            display: grid;
            grid-template-columns: repeat(auto-fit, minmax(250px, 1fr));
            gap: 1.5rem;
            margin: 2rem 0;
          }

          .metric-card {
            background: #f8fafc;
            padding: 1.5rem;
            border-radius: 8px;
            border-left: 4px solid #3b82f6;
          }

          .metric-label {
            font-size: 0.875rem;
            color: #6b7280;
            margin-bottom: 0.5rem;
          }

          .metric-value {
            font-size: 1.5rem;
            font-weight: 600;
            color: #1f2937;
          }

          .score-badge {
            display: inline-block;
            padding: 0.5rem 1rem;
            border-radius: 9999px;
            font-weight: 600;
            font-size: 0.875rem;
          }

          .score-high { background: #dcfce7; color: #166534; }
          .score-medium { background: #fef3c7; color: #92400e; }
          .score-low { background: #fee2e2; color: #991b1b; }

          .report-footer {
            background: #f8fafc;
            padding: 2rem;
            text-align: center;
            border-top: 1px solid #e5e7eb;
            color: #6b7280;
          }

          @media print {
            .report-container { box-shadow: none; }
            body { background: white; }
            .section { page-break-inside: avoid; }
          }
        `;

      case 'classic':
        return `
          body {
            font-family: 'Times New Roman', serif;
            line-height: 1.8;
            color: #000;
            background: white;
          }

          .report-container {
            max-width: 800px;
            margin: 0 auto;
            padding: 2rem;
          }

          .report-header {
            text-align: center;
            border-bottom: 2px solid #000;
            padding-bottom: 2rem;
            margin-bottom: 3rem;
          }

          .report-header h1 {
            font-size: 2rem;
            margin-bottom: 1rem;
          }

          .section {
            margin-bottom: 3rem;
          }

          .section-title {
            font-size: 1.3rem;
            font-weight: bold;
            margin-bottom: 1.5rem;
            border-bottom: 1px solid #ccc;
            padding-bottom: 0.5rem;
          }

          .data-table {
            width: 100%;
            border-collapse: collapse;
            margin: 1.5rem 0;
          }

          .data-table th,
          .data-table td {
            border: 1px solid #ccc;
            padding: 0.75rem;
            text-align: left;
          }

          .data-table th {
            background: #f5f5f5;
            font-weight: bold;
          }
        `;

      case 'minimal':
        return `
          body {
            font-family: 'Monaco', 'Menlo', monospace;
            line-height: 1.6;
            color: #333;
            background: #fff;
            max-width: 900px;
            margin: 0 auto;
            padding: 2rem;
          }

          .report-header {
            border-bottom: 2px solid #333;
            padding-bottom: 1rem;
            margin-bottom: 2rem;
          }

          .report-header h1 {
            font-size: 1.5rem;
            font-weight: normal;
          }

          .section {
            margin-bottom: 2rem;
          }

          .section-title {
            font-size: 1.1rem;
            font-weight: bold;
            margin-bottom: 1rem;
            text-transform: uppercase;
            letter-spacing: 1px;
          }

          .data-table {
            width: 100%;
            border-collapse: collapse;
            margin: 1rem 0;
          }

          .data-table th,
          .data-table td {
            border: 1px solid #333;
            padding: 0.5rem;
            text-align: left;
          }
        `;

      default:
        return '';
    }
  }

  /**
   * Template JavaScript
   */
  private static getTemplateJS(template: string): string {
    return `
      // Print functionality
      function printReport() {
        window.print();
      }

      // Export functionality
      function exportToJSON() {
        const data = document.querySelector('.raw-data pre')?.textContent;
        if (data) {
          const blob = new Blob([data], { type: 'application/json' });
          const url = URL.createObjectURL(blob);
          const a = document.createElement('a');
          a.href = url;
          a.download = 'analysis-data.json';
          a.click();
        }
      }

      // Interactive charts placeholder
      function initCharts() {
        console.log('Charts initialized');
      }

      // Initialize when DOM is loaded
      document.addEventListener('DOMContentLoaded', function() {
        initCharts();
      });
    `;
  }

  /**
   * HTML generation helpers
   */
  private static generateHTMLHeader(analysis: PropertyAnalysis, timestamp: Date): string {
    return `
      <header class="report-header">
        <h1>🏠 Báo Cáo Phân Tích Bất Động Sản</h1>
        <div class="meta">
          <div>Ngày tạo: ${this.formatDate(timestamp)}</div>
          <div>ID Phân tích: <code>${analysis.id}</code></div>
          ${analysis.center ? `<div>Vị trí: ${analysis.center.lat.toFixed(6)}, ${analysis.center.lng.toFixed(6)}</div>` : ''}
        </div>
      </header>
    `;
  }

  private static generateHTMLFooter(timestamp: Date): string {
    return `
      <footer class="report-footer">
        <p>Báo cáo được tạo tự động bởi Vietnam Real Estate Analysis Platform</p>
        <p>Ngày tạo: ${this.formatDate(timestamp)}</p>
        <p><button onclick="printReport()">🖨️ In báo cáo</button> | <button onclick="exportToJSON()">💾 Xuất JSON</button></p>
      </footer>
    `;
  }

  private static generateHTMLSection(id: string, title: string, content: string): string {
    return `
      <section class="section" id="${id}">
        <h2 class="section-title">${title}</h2>
        ${content}
      </section>
    `;
  }

  private static generateBasicInfoHTML(analysis: PropertyAnalysis, rawData: any): string {
    return `
      <div class="metric-grid">
        <div class="metric-card">
          <div class="metric-label">Diện tích</div>
          <div class="metric-value">${analysis.area ? analysis.area.toLocaleString('vi-VN') : 'N/A'} m²</div>
        </div>
        <div class="metric-card">
          <div class="metric-label">Hướng</div>
          <div class="metric-value">${analysis.orientation || 'N/A'}</div>
        </div>
        <div class="metric-card">
          <div class="metric-label">Số mặt tiền</div>
          <div class="metric-value">${analysis.frontageCount || 'N/A'}</div>
        </div>
        <div class="metric-card">
          <div class="metric-label">Bán kính tìm kiếm</div>
          <div class="metric-value">${rawData.searchRadius || 'N/A'}m</div>
        </div>
      </div>

      ${rawData.coordinates ? `
        <h3>Tọa độ chi tiết</h3>
        <pre><code>${JSON.stringify(rawData.coordinates, null, 2)}</code></pre>
      ` : ''}
    `;
  }

  private static generateLocationHTML(analysis: PropertyAnalysis): string {
    return analysis.center ? `
      <table class="data-table">
        <tr><th>Thuộc tính</th><th>Giá trị</th></tr>
        <tr><td>Latitude</td><td>${analysis.center.lat}</td></tr>
        <tr><td>Longitude</td><td>${analysis.center.lng}</td></tr>
        <tr><td>Google Maps</td><td><a href="https://maps.google.com/?q=${analysis.center.lat},${analysis.center.lng}" target="_blank">Xem trên bản đồ</a></td></tr>
      </table>
    ` : '<p>Không có thông tin vị trí</p>';
  }

  private static generateAmenitiesHTML(amenities: any[], rawData: any): string {
    if (!amenities || amenities.length === 0) {
      return '<p>Không có dữ liệu tiện ích</p>';
    }

    return amenities.map(category => `
      <h3>${category.name}</h3>
      <p><strong>Tổng số:</strong> ${category.items ? category.items.length : 0}</p>
      ${category.items && category.items.length > 0 ? `
        <table class="data-table">
          <tr><th>Tên tiện ích</th><th>Khoảng cách</th></tr>
          ${category.items.slice(0, 10).map((item: any) => `
            <tr><td>${item.name || 'N/A'}</td><td>${item.distance || 'N/A'}m</td></tr>
          `).join('')}
        </table>
      ` : '<p>Không có tiện ích trong danh mục này</p>'}
    `).join('');
  }

  private static generateInfrastructureHTML(infrastructure: any[], rawData: any): string {
    if (!infrastructure || infrastructure.length === 0) {
      return '<p>Không có dữ liệu hạ tầng</p>';
    }

    return `
      <table class="data-table">
        <tr><th>Loại</th><th>Tên</th><th>Khoảng cách</th><th>Mô tả</th></tr>
        ${infrastructure.map(infra => `
          <tr>
            <td>${infra.type || 'N/A'}</td>
            <td>${infra.name || 'N/A'}</td>
            <td>${infra.distance || 'N/A'}m</td>
            <td>${infra.description || ''}</td>
          </tr>
        `).join('')}
      </table>
    `;
  }

  private static generateMarketHTML(marketData: any, rawData: any): string {
    if (!marketData) {
      return '<p>Không có dữ liệu thị trường</p>';
    }

    let html = '';

    if (marketData.avgPrice) {
      html += `
        <div class="metric-grid">
          <div class="metric-card">
            <div class="metric-label">Giá trung bình</div>
            <div class="metric-value">${this.formatCurrency(marketData.avgPrice)}</div>
          </div>
          <div class="metric-card">
            <div class="metric-label">Giá/m² trung bình</div>
            <div class="metric-value">${marketData.avgPricePerSqm ? this.formatCurrency(marketData.avgPricePerSqm) : 'N/A'}</div>
          </div>
          <div class="metric-card">
            <div class="metric-label">Số lượng so sánh</div>
            <div class="metric-value">${marketData.comparableListings ? marketData.comparableListings.length : 0}</div>
          </div>
        </div>
      `;
    }

    if (marketData.comparableListings && marketData.comparableListings.length > 0) {
      html += `
        <h3>Bất động sản tương tự</h3>
        <table class="data-table">
          <tr><th>STT</th><th>Tên</th><th>Giá</th><th>Diện tích</th><th>Giá/m²</th><th>Nguồn</th></tr>
          ${marketData.comparableListings.map((listing: any, index: number) => `
            <tr>
              <td>${index + 1}</td>
              <td>${listing.title || 'N/A'}</td>
              <td>${this.formatCurrency(listing.price)}</td>
              <td>${listing.area || 'N/A'} m²</td>
              <td>${listing.pricePerSqm ? this.formatCurrency(listing.pricePerSqm) : 'N/A'}</td>
              <td>${listing.source || 'N/A'}</td>
            </tr>
          `).join('')}
        </table>
      `;
    }

    return html;
  }

  private static generateAIAnalysisHTML(aiAnalysis: any, rawData: any): string {
    if (!aiAnalysis) {
      return '<p>Đang phân tích...</p>';
    }

    let html = '';

    if (aiAnalysis.score !== undefined) {
      const scoreClass = aiAnalysis.score > 70 ? 'score-high' : aiAnalysis.score > 50 ? 'score-medium' : 'score-low';
      html += `
        <div class="metric-grid">
          <div class="metric-card">
            <div class="metric-label">Điểm số AI</div>
            <div class="metric-value"><span class="score-badge ${scoreClass}">${aiAnalysis.score}/100</span></div>
          </div>
        </div>
        <p><strong>Đánh giá:</strong> ${this.getScoreInterpretation(aiAnalysis.score)}</p>
      `;
    }

    if (aiAnalysis.recommendations) {
      html += `
        <h3>Đề xuất đầu tư</h3>
        <ul>
          ${aiAnalysis.recommendations.map((rec: string) => `<li>${rec}</li>`).join('')}
        </ul>
      `;
    }

    if (aiAnalysis.risks) {
      html += `
        <h3>Phân tích rủi ro</h3>
        <table class="data-table">
          <tr><th>Loại rủi ro</th><th>Mức độ</th><th>Mô tả</th></tr>
          ${aiAnalysis.risks.map((risk: any) => `
            <tr>
              <td>${risk.type || 'N/A'}</td>
              <td>${risk.level || 'N/A'}</td>
              <td>${risk.description || ''}</td>
            </tr>
          `).join('')}
        </table>
      `;
    }

    return html;
  }

  private static generateHistoricalHTML(historicalData: any, rawData: any): string {
    if (!historicalData) {
      return '<p>Không có dữ liệu lịch sử</p>';
    }

    let html = '';

    if (historicalData.trends) {
      html += '<h3>Xu hướng giá</h3>';
      const periods = ['1month', '3months', '6months', '1year'];
      periods.forEach(period => {
        if (historicalData.trends[period]) {
          const trend = historicalData.trends[period];
          const icon = trend.trendDirection === 'up' ? '📈' : trend.trendDirection === 'down' ? '📉' : '➡️';
          html += `<p><strong>${this.formatPeriod(period)}:</strong> ${icon} ${trend.changePercent > 0 ? '+' : ''}${trend.changePercent}% (${this.formatCurrency(trend.changeAmount)})</p>`;
        }
      });
    }

    if (historicalData.quickStats) {
      html += `
        <div class="metric-grid">
          <div class="metric-card">
            <div class="metric-label">Giá trung bình</div>
            <div class="metric-value">${this.formatCurrency(historicalData.quickStats.avgPrice)}</div>
          </div>
          <div class="metric-card">
            <div class="metric-label">Giá/m² trung bình</div>
            <div class="metric-value">${this.formatCurrency(historicalData.quickStats.avgPricePerSqm)}</div>
          </div>
          <div class="metric-card">
            <div class="metric-label">Tổng listing</div>
            <div class="metric-value">${historicalData.quickStats.totalListings}</div>
          </div>
          <div class="metric-card">
            <div class="metric-label">Nhiệt độ thị trường</div>
            <div class="metric-value">${historicalData.quickStats.marketHeat}</div>
          </div>
        </div>
      `;
    }

    if (historicalData.recommendations) {
      html += `
        <h3>Đề xuất dựa trên xu hướng</h3>
        <ul>
          ${historicalData.recommendations.map((rec: string) => `<li>${rec}</li>`).join('')}
        </ul>
      `;
    }

    return html;
  }

  private static generateRawDataHTML(rawData: any): string {
    return `
      <details>
        <summary><strong>🔍 Xem dữ liệu thô đầy đủ</strong></summary>
        <pre><code>${JSON.stringify(rawData, null, 2)}</code></pre>
      </details>
    `;
  }

  /**
   * Helper methods
   */
  private static formatDate(date: Date): string {
    return date.toLocaleDateString('vi-VN', {
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
      hour: '2-digit',
      minute: '2-digit'
    });
  }

  private static formatCurrency(amount: number): string {
    if (amount >= 1000000000) {
      return `${(amount / 1000000000).toFixed(2)} tỷ VNĐ`;
    } else if (amount >= 1000000) {
      return `${(amount / 1000000).toFixed(0)} triệu VNĐ`;
    } else {
      return `${amount.toLocaleString('vi-VN')} VNĐ`;
    }
  }

  private static getScoreInterpretation(score: number): string {
    if (score > 70) return '✅ NÊN ĐẦU TƯ - Đất nền có tiềm năng tốt';
    if (score > 50) return '⚠️ CÂN NHẮN - Cần xem xét thêm yếu tố khác';
    return '❌ CHƯA NÊN ĐẦU TƯ - Rủi ro cao hơn lợi nhuận';
  }

  private static formatPeriod(period: string): string {
    const periods: { [key: string]: string } = {
      '1month': '1 tháng',
      '3months': '3 tháng',
      '6months': '6 tháng',
      '1year': '1 năm'
    };
    return periods[period] || period;
  }

  private static getReportSections(options: ExportOptions): string[] {
    const sections = ['basic-info', 'location', 'amenities', 'infrastructure', 'market', 'ai-analysis'];
    if (options.includeHistorical) sections.push('historical');
    if (options.includeRawData) sections.push('raw-data');
    return sections;
  }
}