import jsPDF from 'jspdf';
import html2canvas from 'html2canvas';

interface PDFData {
  propertyData: {
    area: number;
    orientation: string;
    frontageCount: number;
    center: { lat: number; lng: number };
  };
  analysisResults: any;
}

export async function generatePDF(data: PDFData) {
  const pdf = new jsPDF('p', 'mm', 'a4');
  const pageWidth = pdf.internal.pageSize.getWidth();
  const pageHeight = pdf.internal.pageSize.getHeight();
  const margin = 15;
  let yPos = margin;

  pdf.setFont('helvetica', 'bold');
  pdf.setFontSize(20);
  pdf.text('BÁO CÁO PHÂN TÍCH BẤT ĐỘNG SẢN', pageWidth / 2, yPos, { align: 'center' });
  yPos += 15;

  pdf.setFont('helvetica', 'normal');
  pdf.setFontSize(10);
  pdf.text(`Ngày tạo: ${new Date().toLocaleDateString('vi-VN')}`, pageWidth / 2, yPos, { align: 'center' });
  yPos += 15;

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
      pdf.setFontSize(14);
      pdf.text('BẢN ĐỒ VỊ TRÍ', margin, yPos);
      yPos += 8;

      const canvas = await html2canvas(mapElement, {
        useCORS: true,
        allowTaint: true,
        backgroundColor: '#ffffff'
      });
      
      const imgData = canvas.toDataURL('image/jpeg', 0.8);
      const imgWidth = pageWidth - (2 * margin);
      const imgHeight = (canvas.height * imgWidth) / canvas.width;
      
      if (yPos + imgHeight > pageHeight - margin) {
        pdf.addPage();
        yPos = margin;
      }
      
      pdf.addImage(imgData, 'JPEG', margin, yPos, imgWidth, imgHeight);
      yPos += imgHeight + 10;
    }
  } catch (error) {
    console.error('Error capturing map:', error);
  }

  if (yPos > pageHeight - 40) {
    pdf.addPage();
    yPos = margin;
  }

  if (data.analysisResults?.aiAnalysis) {
    pdf.setFont('helvetica', 'bold');
    pdf.setFontSize(14);
    pdf.text('ĐÁNH GIÁ TỪ AI', margin, yPos);
    yPos += 8;

    const scores = data.analysisResults.aiAnalysis.scores;
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
  const fileName = `bao-cao-phan-tich-${Date.now()}.pdf`;
  pdf.save(fileName);
  
  return fileName;
}
