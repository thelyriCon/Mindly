/**
 * Document Ingestion Service
 * Supports PDF (via pdf-parse), DOCX (via mammoth), Markdown, Plain Text, CSV, JSON
 * Meets V1.5 specifications: preserving headings, paragraphs, page boundaries, and file metadata.
 */
import * as pdfParseModule from 'pdf-parse';
import mammoth from 'mammoth';
import { ExtractedDocument } from '../../src/types';

// Handle both ESM and CJS packaging of pdf-parse
const pdfParse: any = (pdfParseModule as any).default || pdfParseModule;

export class DocumentService {
  /**
   * Ingests a document from a Buffer or base64 string and extracts clean structured text
   */
  async extractText(
    fileBuffer: Buffer,
    fileName: string,
    mimeType?: string
  ): Promise<ExtractedDocument & { wordCount: number; isScanned?: boolean }> {
    const ext = fileName.split('.').pop()?.toLowerCase() || '';
    const fileSize = fileBuffer.length;

    let text = '';
    let pageCount: number | undefined;
    let metadata: Record<string, any> = {};
    let isScanned = false;

    // 1. PDF Processing
    if (ext === 'pdf' || mimeType === 'application/pdf') {
      try {
        const pdfData = await pdfParse(fileBuffer, {
          // Custom pager to preserve page boundaries
          pagerender: (pageData: any) => {
            return pageData.getTextContent().then((textContent: any) => {
              let lastY: number | null = null;
              let pageText = '';
              for (const item of textContent.items) {
                if (lastY === null || Math.abs(item.transform[5] - lastY) > 5) {
                  pageText += '\n' + item.str;
                } else {
                  pageText += ' ' + item.str;
                }
                lastY = item.transform[5];
              }
              return `\n--- [Page ${pageData.pageIndex + 1}] ---\n${pageText}\n`;
            });
          },
        });

        text = (pdfData.text || '').trim();
        pageCount = pdfData.numpages;
        metadata = {
          info: pdfData.info,
          version: pdfData.version,
        };

        // Check if scanned/empty text
        const safePages = pageCount ?? 0;
        if (text.length < 50 && safePages > 0) {
          isScanned = true;
          text = `[Scanned Document Notice: This PDF appears to contain mostly scanned images or diagrams with minimal embedded text. (${safePages} page${safePages > 1 ? 's' : ''})]\n` + text;
        }
      } catch (err) {
        console.error('[DOC] PDF extraction error:', err);
        throw new Error('Failed to parse PDF document. The file may be password protected or corrupted.');
      }
    }
    // 2. DOCX Processing
    else if (ext === 'docx' || mimeType === 'application/vnd.openxmlformats-officedocument.wordprocessingml.document') {
      try {
        const result = await mammoth.extractRawText({ buffer: fileBuffer });
        text = result.value.trim();
        metadata = {
          messages: result.messages,
        };
      } catch (err) {
        console.error('[DOC] DOCX extraction error:', err);
        throw new Error('Failed to extract text from DOCX file. Ensure it is a valid Word document.');
      }
    }
    // 3. Plain text / Markdown / JSON / CSV
    else {
      try {
        text = fileBuffer.toString('utf-8');
      } catch (err) {
        console.error('[DOC] Text decode error:', err);
        throw new Error('Could not decode file content as text.');
      }
    }

    const wordCount = text.trim().split(/\s+/).filter(Boolean).length;

    return {
      text,
      fileName,
      fileType: ext || 'text',
      fileSize,
      pageCount,
      wordCount,
      metadata,
      isScanned,
    };
  }
}

export const documentService = new DocumentService();
