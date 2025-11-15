import jsPDF from 'jspdf';
import html2canvas from 'html2canvas';
import { toPng } from 'html-to-image';

interface PDFData {
  propertyData: {
    area: number;
    orientation: string;
    frontageCount: number;
    center: { lat: number; lng: number };
  };
  analysisResults: any;
}

export async function generatePDF(data: PDFData, options?: {
  returnAsBlob?: boolean;
  filename?: string;
}): Promise<string | Blob> {
  const pdf = new jsPDF('p', 'mm', 'a4');
  const pageWidth = pdf.internal.pageSize.getWidth();
  const pageHeight = pdf.internal.pageSize.getHeight();
  const margin = 15;
  let yPos = margin;

  // Add header with better formatting
  pdf.setFont('helvetica', 'bold');
  pdf.setFontSize(22);
  pdf.text('BÁO CÁO PHÂN TÍCH BẤT ĐỘNG SẢN', pageWidth / 2, yPos, { align: 'center' });
  yPos += 10;

  pdf.setFont('helvetica', 'normal');
  pdf.setFontSize(11);
  pdf.text(`Ngày tạo: ${new Date().toLocaleDateString('vi-VN')} lúc ${new Date().toLocaleTimeString('vi-VN')}`, pageWidth / 2, yPos, { align: 'center' });
  yPos += 15;

  // Add decorative line
  pdf.setDrawColor(3, 169, 244); // Blue color
  pdf.setLineWidth(0.5);
  pdf.line(margin, yPos, pageWidth - margin, yPos);
  yPos += 10;

  pdf.setFont('helvetica', 'bold');
  pdf.setFontSize(14);
  pdf.text('THÔNG TIN KHU ĐẤT', margin, yPos);
  yPos += 8;

  pdf.setFont('helvetica', 'normal');
  pdf.setFontSize(11);
  pdf.text(`Diện tích: ${data.propertyData.area.toLocaleString('vi-VN')} m²`, margin, yPos);
  yPos += 6;
  pdf.text(`Hướng: ${data.propertyData.orientation}`, margin, yPos);
  yPos += 6;
  pdf.text(`Số mặt tiền: ${data.propertyData.frontageCount}`, margin, yPos);
  yPos += 6;
  pdf.text(`Tọa độ: ${data.propertyData.center.lat.toFixed(6)}, ${data.propertyData.center.lng.toFixed(6)}`, margin, yPos);
  yPos += 12;

  try {
    const mapElement = document.querySelector('[data-testid="map-container"]') as HTMLElement;
    if (mapElement) {
      pdf.setFont('helvetica', 'bold');
      pdf.setFontSize(16);
      pdf.text('BẢN ĐỒ VỊ TRÍ VÀ TIỆN ÍCH', margin, yPos);
      yPos += 8;

      // Enhanced map capture with better quality
      const canvas = await html2canvas(mapElement, {
        useCORS: true,
        allowTaint: true,
        backgroundColor: '#ffffff',
        scale: 2, // Higher resolution
        logging: false,
        width: mapElement.offsetWidth,
        height: mapElement.offsetHeight
      });

      const imgData = canvas.toDataURL('image/jpeg', 0.9);
      const imgWidth = pageWidth - (2 * margin);
      const imgHeight = (canvas.height * imgWidth) / canvas.width;

      if (yPos + imgHeight > pageHeight - margin) {
        pdf.addPage();
        yPos = margin;
      }

      // Add border around map image
      pdf.setDrawColor(200, 200, 200);
      pdf.setLineWidth(0.5);
      pdf.rect(margin - 1, yPos - 1, imgWidth + 2, imgHeight + 2);

      pdf.addImage(imgData, 'JPEG', margin, yPos, imgWidth, imgHeight);
      yPos += imgHeight + 15;

      // Add map legend
      pdf.setFont('helvetica', 'italic');
      pdf.setFontSize(9);
      pdf.setTextColor(100, 100, 100);
      pdf.text('Bản đồ hiển thị vị trí khu đất và các tiện ích xung quanh', margin, yPos);
      pdf.setTextColor(0, 0, 0);
      yPos += 8;
    }
  } catch (error) {
    console.error('Error capturing map:', error);
  }

  if (yPos > pageHeight - 40) {
    pdf.addPage();
    yPos = margin;
  }

  // Add section separator
  if (yPos > pageHeight - 40) {
    pdf.addPage();
    yPos = margin;
  }

  pdf.setDrawColor(3, 169, 244);
  pdf.setLineWidth(0.3);
  pdf.line(margin, yPos, pageWidth - margin, yPos);
  yPos += 8;

  if (data.analysisResults?.aiAnalysis) {
    pdf.setFont('helvetica', 'bold');
    pdf.setFontSize(16);
    pdf.text('ĐÁNH GIÁ TỪ AI', margin, yPos);
    yPos += 10;

    const scores = data.analysisResults.aiAnalysis.scores;

    // Draw score visualization
    if (scores) {
      yPos += drawScoreChart(pdf, scores, margin, yPos, pageWidth - (2 * margin));
    }

    pdf.setFont('helvetica', 'normal');
    pdf.setFontSize(11);

    pdf.text(`Điểm vị trí: ${scores?.location || 'N/A'}/10`, margin, yPos);
    yPos += 6;
    pdf.text(`Điểm tiện ích: ${scores?.amenities || 'N/A'}/10`, margin, yPos);
    yPos += 6;
    pdf.text(`Điểm hạ tầng: ${scores?.infrastructure || 'N/A'}/10`, margin, yPos);
    yPos += 6;
    pdf.text(`Điểm tiềm năng: ${scores?.potential || 'N/A'}/10`, margin, yPos);
    yPos += 6;
    pdf.text(`Điểm tổng thể: ${scores?.overall || 'N/A'}/10`, margin, yPos);
    yPos += 10;

    if (data.analysisResults.aiAnalysis.estimatedPrice) {
      pdf.setFont('helvetica', 'bold');
      pdf.text(`Giá ước tính: ${data.analysisResults.aiAnalysis.estimatedPrice}`, margin, yPos);
      yPos += 10;
    }

    if (data.analysisResults.aiAnalysis.summary) {
      pdf.setFont('helvetica', 'bold');
      pdf.setFontSize(12);
      pdf.text('Tóm tắt:', margin, yPos);
      yPos += 6;
      
      pdf.setFont('helvetica', 'normal');
      pdf.setFontSize(10);
      const summaryLines = pdf.splitTextToSize(data.analysisResults.aiAnalysis.summary, pageWidth - (2 * margin));
      summaryLines.forEach((line: string) => {
        if (yPos > pageHeight - margin) {
          pdf.addPage();
          yPos = margin;
        }
        pdf.text(line, margin, yPos);
        yPos += 5;
      });
      yPos += 5;
    }

    if (data.analysisResults.aiAnalysis.recommendation) {
      pdf.setFont('helvetica', 'bold');
      pdf.setFontSize(12);
      pdf.text('Khuyến nghị:', margin, yPos);
      yPos += 6;
      
      pdf.setFont('helvetica', 'normal');
      pdf.setFontSize(10);
      const recLines = pdf.splitTextToSize(data.analysisResults.aiAnalysis.recommendation, pageWidth - (2 * margin));
      recLines.forEach((line: string) => {
        if (yPos > pageHeight - margin) {
          pdf.addPage();
          yPos = margin;
        }
        pdf.text(line, margin, yPos);
        yPos += 5;
      });
      yPos += 10;
    }
  }

  if (yPos > pageHeight - 40) {
    pdf.addPage();
    yPos = margin;
  }

  if (data.analysisResults?.amenities && data.analysisResults.amenities.length > 0) {
    pdf.setFont('helvetica', 'bold');
    pdf.setFontSize(14);
    pdf.text('TIỆN ÍCH XUNG QUANH', margin, yPos);
    yPos += 8;

    const categoryCounts: Record<string, number> = {};
    data.analysisResults.amenities.forEach((amenity: any) => {
      categoryCounts[amenity.category] = (categoryCounts[amenity.category] || 0) + 1;
    });

    pdf.setFont('helvetica', 'normal');
    pdf.setFontSize(11);
    Object.entries(categoryCounts).forEach(([category, count]) => {
      const categoryName = 
        category === 'education' ? 'Giáo dục' :
        category === 'healthcare' ? 'Y tế' :
        category === 'shopping' ? 'Mua sắm' :
        category === 'entertainment' ? 'Giải trí' : category;
      
      pdf.text(`${categoryName}: ${count} địa điểm`, margin, yPos);
      yPos += 6;
    });
    yPos += 6;

    pdf.setFont('helvetica', 'bold');
    pdf.setFontSize(11);
    pdf.text('Top 10 tiện ích gần nhất:', margin, yPos);
    yPos += 6;

    pdf.setFont('helvetica', 'normal');
    pdf.setFontSize(9);
    const topAmenities = data.analysisResults.amenities
      .sort((a: any, b: any) => (a.distance || 0) - (b.distance || 0))
      .slice(0, 10);

    topAmenities.forEach((amenity: any, index: number) => {
      if (yPos > pageHeight - margin) {
        pdf.addPage();
        yPos = margin;
      }
      const distance = amenity.distance ? `${Math.round(amenity.distance)}m` : 'N/A';
      pdf.text(`${index + 1}. ${amenity.name} - ${distance}`, margin + 3, yPos);
      yPos += 5;
    });
    yPos += 8;
  }

  if (yPos > pageHeight - 40) {
    pdf.addPage();
    yPos = margin;
  }

  if (data.analysisResults?.marketData) {
    pdf.setFont('helvetica', 'bold');
    pdf.setFontSize(14);
    pdf.text('DỮ LIỆU THỊ TRƯỜNG', margin, yPos);
    yPos += 8;

    pdf.setFont('helvetica', 'normal');
    pdf.setFontSize(11);
    
    if (data.analysisResults.marketData.averagePrice) {
      pdf.text(`Giá trung bình: ${data.analysisResults.marketData.averagePrice}`, margin, yPos);
      yPos += 6;
    }
    
    if (data.analysisResults.marketData.priceRange) {
      pdf.text(`Khoảng giá: ${data.analysisResults.marketData.priceRange}`, margin, yPos);
      yPos += 6;
    }

    if (data.analysisResults.marketData.listingsCount) {
      pdf.text(`Số tin đăng: ${data.analysisResults.marketData.listingsCount}`, margin, yPos);
      yPos += 10;
    }
  }

  if (yPos > pageHeight - 40) {
    pdf.addPage();
    yPos = margin;
  }

  if (data.analysisResults?.risks && data.analysisResults.risks.length > 0) {
    pdf.setFont('helvetica', 'bold');
    pdf.setFontSize(14);
    pdf.text('ĐÁNH GIÁ RỦI RO', margin, yPos);
    yPos += 8;

    pdf.setFont('helvetica', 'normal');
    pdf.setFontSize(10);
    
    data.analysisResults.risks.forEach((risk: any) => {
      if (yPos > pageHeight - margin - 15) {
        pdf.addPage();
        yPos = margin;
      }

      const riskColor = risk.severity === 'high' ? '#EF4444' : 
                       risk.severity === 'medium' ? '#F59E0B' : '#10B981';
      
      pdf.setTextColor(riskColor);
      pdf.setFont('helvetica', 'bold');
      pdf.text(`• ${risk.type}`, margin, yPos);
      yPos += 5;
      
      pdf.setTextColor('#000000');
      pdf.setFont('helvetica', 'normal');
      const descLines = pdf.splitTextToSize(risk.description, pageWidth - (2 * margin) - 5);
      descLines.forEach((line: string) => {
        if (yPos > pageHeight - margin) {
          pdf.addPage();
          yPos = margin;
        }
        pdf.text(line, margin + 5, yPos);
        yPos += 5;
      });
      yPos += 3;
    });
  }

  pdf.setTextColor('#000000');
  // Add watermark and footer
  addWatermarkAndFooter(pdf);

  const fileName = options?.filename || `bao-cao-phan-tich-${Date.now()}.pdf`;

  // Serverless-compatible export options
  if (options?.returnAsBlob) {
    // Return as blob for serverless upload or further processing
    return pdf.output('blob');
  } else {
    // Direct download (client-side only - serverless compatible)
    pdf.save(fileName);
    return fileName;
  }
}

// Serverless-compatible function to generate PDF as base64 for upload
export async function generatePDFForUpload(data: PDFData, filename?: string): Promise<{
  data: string; // base64 string
  filename: string;
  mimeType: string;
}> {
  const result = await generatePDF(data, { returnAsBlob: true, filename });

  // Type guard to ensure we have a Blob
  if (!(result instanceof Blob)) {
    throw new Error('PDF generation failed to return a Blob');
  }

  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onloadend = () => {
      const base64String = reader.result as string;
      const actualFilename = filename || `bao-cao-phan-tich-${Date.now()}.pdf`;

      resolve({
        data: base64String,
        filename: actualFilename,
        mimeType: 'application/pdf'
      });
    };
    reader.onerror = reject;
    reader.readAsDataURL(result);
  });
}

// Helper function to draw score chart
function drawScoreChart(pdf: jsPDF, scores: any, x: number, y: number, width: number): number {
  const barHeight = 8;
  const spacing = 4;
  const chartHeight = (barHeight + spacing) * 5 + 10;
  const barWidth = width * 0.7;
  const labelWidth = width * 0.25;

  const scoreCategories = [
    { key: 'location', label: 'Vị trí' },
    { key: 'amenities', label: 'Tiện ích' },
    { key: 'infrastructure', label: 'Hạ tầng' },
    { key: 'potential', label: 'Tiềm năng' },
    { key: 'overall', label: 'Tổng thể' }
  ];

  pdf.setFont('helvetica', 'normal');
  pdf.setFontSize(9);

  let currentY = y;
  scoreCategories.forEach(category => {
    const score = scores[category.key] || 0;
    const normalizedScore = (score / 10) * barWidth;

    // Draw background bar
    pdf.setFillColor(240, 240, 240);
    pdf.rect(x + labelWidth, currentY, barWidth, barHeight, 'F');

    // Draw score bar with color based on score
    if (score >= 8) {
      pdf.setFillColor(16, 185, 129); // Green
    } else if (score >= 6) {
      pdf.setFillColor(251, 146, 60); // Orange
    } else {
      pdf.setFillColor(239, 68, 68); // Red
    }
    pdf.rect(x + labelWidth, currentY, normalizedScore, barHeight, 'F');

    // Draw border
    pdf.setDrawColor(200, 200, 200);
    pdf.setLineWidth(0.5);
    pdf.rect(x + labelWidth, currentY, barWidth, barHeight);

    // Draw label
    pdf.setTextColor(60, 60, 60);
    pdf.text(`${category.label}:`, x, currentY + 6);

    // Draw score value
    pdf.setTextColor(30, 30, 30);
    pdf.setFont('helvetica', 'bold');
    pdf.text(`${score}/10`, x + labelWidth + barWidth + 5, currentY + 6);
    pdf.setFont('helvetica', 'normal');

    currentY += barHeight + spacing;
  });

  return chartHeight;
}

// Helper function to add watermark and footer
function addWatermarkAndFooter(pdf: jsPDF) {
  const pageWidth = pdf.internal.pageSize.getWidth();
  const pageHeight = pdf.internal.pageSize.getHeight();
  const pageCount = (pdf as any).internal.getNumberOfPages();

  for (let i = 1; i <= pageCount; i++) {
    pdf.setPage(i);

    // Add watermark
    pdf.setTextColor(240, 240, 240);
    pdf.setFont('helvetica', 'bold');
    pdf.setFontSize(60);
    (pdf as any).saveGraphicsState();
    (pdf as any).setGState({ opacity: 0.1 });
    pdf.text('Vietnam Real Estate Analysis', pageWidth / 2, pageHeight / 2, {
      align: 'center',
      angle: 45
    });
    (pdf as any).restoreGraphicsState();

    // Add footer
    pdf.setTextColor(100, 100, 100);
    pdf.setFont('helvetica', 'italic');
    pdf.setFontSize(8);
    pdf.text('Báo cáo này được tạo tự động bởi hệ thống phân tích bất động sản Việt Nam', pageWidth / 2, pageHeight - 10, {
      align: 'center'
    });

    // Add page number
    pdf.setFont('helvetica', 'normal');
    pdf.text(`Trang ${i} / ${pageCount}`, pageWidth - 25, pageHeight - 5);

    // Add disclaimer
    pdf.setFontSize(7);
    pdf.setTextColor(150, 150, 150);
    pdf.text('* Thông tin chỉ mang tính chất tham khảo, vui lòng xác thực lại trước khi ra quyết định', pageWidth / 2, pageHeight - 5, {
      align: 'center'
    });
  }

  pdf.setTextColor(0, 0, 0); // Reset text color
}
