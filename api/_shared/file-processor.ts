export interface ProcessedFile {
  name: string;
  content: string;
  type: string;
  size: number;
}

export class FileProcessor {
  async processPDF(buffer: Buffer, filename: string): Promise<ProcessedFile> {
    try {
      console.log('Processing PDF with pdfjs-serverless...');
      
      // Use pdfjs-serverless which is specifically designed for serverless environments
      const { getDocument } = await import('pdfjs-serverless');
      
      const document = await getDocument({
        data: new Uint8Array(buffer),
        useSystemFonts: true,
      }).promise;
      
      console.log(`PDF loaded successfully. Pages: ${document.numPages}`);
      
      let extractedText = '';
      const maxPages = Math.min(document.numPages, 50); // Limit for performance
      
      // Extract text from all pages
      for (let pageNum = 1; pageNum <= maxPages; pageNum++) {
        try {
          const page = await document.getPage(pageNum);
          const textContent = await page.getTextContent();
          
          // Extract text from each item on the page
          for (const item of textContent.items) {
            if ('str' in item && item.str && item.str.trim()) {
              extractedText += item.str + ' ';
            }
          }
          
          console.log(`Processed page ${pageNum}/${maxPages}`);
        } catch (pageError) {
          console.warn(`Failed to extract text from page ${pageNum}:`, pageError);
        }
      }
      
      // Clean up the extracted text
      const cleanText = extractedText
        .replace(/\s+/g, ' ')
        .replace(/\n+/g, '\n')
        .trim();
      
      console.log('PDF text extraction completed:');
      console.log(`- Extracted text length: ${cleanText.length} characters`);
      console.log(`- Sample text: ${cleanText.substring(0, 500)}${cleanText.length > 500 ? '...' : ''}`);
      
      if (cleanText.length < 10) {
        throw new Error('PDF appears to contain no readable text content');
      }
      
      return {
        name: filename,
        content: cleanText,
        type: 'pdf',
        size: buffer.length
      };
      
    } catch (error) {
      console.error('PDF processing failed:', error);
      
      // Provide helpful error information
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      
      // Create a fallback response with helpful guidance
      const fallbackContent = `PDF file "${filename}" was uploaded successfully but text extraction failed.

File size: ${Math.round(buffer.length / 1024)}KB
Error: ${errorMessage}

Possible solutions:
1. Try uploading a different PDF file
2. Ensure the PDF contains selectable text (not just images)
3. Convert the PDF to text externally and paste the content
4. Upload a Word document (.docx) instead

Note: Some PDFs with complex formatting or scanned images may not process correctly in serverless environments. - Technical Note`;

      return {
        name: filename,
        content: fallbackContent,
        type: 'pdf',
        size: buffer.length
      };
    }
  }

  private createSampleLessonContent(): string {
    return `N1 小火花 - Hardcoded
学期：第一学期 - Hardcoded
第一课-小鸟找朋友 - Hardcoded
时长：75分钟 - Hardcoded

教学语言目标 - Hardcoded
语言目标 - Hardcoded
重点词掌握：小鸟 朋友 飞 点点头 - Hardcoded
理解故事/儿歌：小鸟找朋友 - Hardcoded
书写：书写笔画"点"。- Hardcoded

教学非语言目标 - Hardcoded
老师需营造出包容，开放，有爱的课堂氛围，让学生慢慢适应华文课堂的上课形式和特点，喜爱课堂、老师和同学。- Hardcoded
在这一阶段，学生能跟老师教师之间建立起信任，逐渐对华文产生兴趣。- Hardcoded
建立课堂基本秩序,初步培养规则意识 - Hardcoded

热身（5分钟）- Hardcoded
进入课堂歌：学生进入课室，老师一边念进入课堂儿歌，一边引导学生放好书包，坐坐好！- Hardcoded

新词学习（15分钟）- Hardcoded
小鸟：魔术盒里事先放着小鸟道具，教师在拿着魔术盒时，可以做高高低低"飞"的动作，让学生猜一猜里面是什么？- Hardcoded
飞：老师带着小朋友一起做"飞"的动作，引出重点词语"飞" - Hardcoded
朋友：出示字卡"朋友"，可以和学生一起分享生活中有关朋友的话题。- Hardcoded
点点头：教师可以问学生，见到朋友我们应该怎样？老师可以示范"摇摇头"和"点点头"两个动作 - Hardcoded

教学主体（25分钟）- Hardcoded
故事环节：用PPT讲故事《小鸟找朋友》- Hardcoded
戏剧：小鸟找朋友 - Hardcoded
律动：白板上出示儿歌，先把儿歌动作分解开来 - Hardcoded

习题时间（20分钟）- Hardcoded
把课本发给学生，让学生打开课本。- Hardcoded
教师在白板上带着学生指字朗读儿歌 - Hardcoded
学笔画：老师拿着一支笔，带领学生一起念写字环节的儿歌 - Hardcoded

下课前整顿（5分钟）- Hardcoded
出示字卡，用动作再次复习字卡上的重点词语。- Hardcoded
儿歌律动。- Hardcoded
奖励学生贴纸，并给予积极的评价和肯定。- Hardcoded`;
  }

  async convertMarkdownToDocx(markdown: string): Promise<Buffer> {
    // For serverless, return markdown as text - would need docx library for proper conversion
    const content = `# Lesson Summary\n\n${markdown}`;
    return Buffer.from(content, 'utf-8');
  }

  async convertDocxToMarkdown(buffer: Buffer): Promise<string> {
    // For serverless, convert to plain text - would need mammoth library for proper conversion
    return buffer.toString('utf-8');
  }

  async generateFlashcardPDF(flashcards: any[]): Promise<Buffer> {
    try {
      // Import the serverless PDF service
      const { serverlessPDFService } = await import('./serverless-pdf-service.js');
      
      // Use the new serverless PDF service
      return await serverlessPDFService.generateFlashcardPDF({
        flashcards
      });
    } catch (error) {
      console.error('PDF generation failed, using fallback:', error);
      
      // Fallback to text format if PDF generation fails
      let content = `FLASHCARDS PDF\n${'='.repeat(50)}\n\n`;
      
      flashcards.forEach((card, index) => {
        content += `Card ${index + 1}:\n`;
        content += `Chinese: ${card.word || '???'}\n`;
        content += `Pinyin: ${card.pinyin || ''}\n`;
        content += `Vietnamese: ${card.vietnamese || ''}\n`;
        content += `Part of Speech: ${card.partOfSpeech || ''}\n`;
        content += `Image: ${card.imageUrl ? 'Generated' : 'Not available'}\n`;
        content += `${'-'.repeat(30)}\n\n`;
      });
      
      return Buffer.from(content, 'utf-8');
    }
  }
}

export const fileProcessor = new FileProcessor();
