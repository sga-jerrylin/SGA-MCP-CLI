import { PDFParse } from 'pdf-parse';

import { PdfTool } from './pdf-tool';

jest.mock('pdf-parse', () => ({
  PDFParse: jest.fn()
}));

describe('PdfTool', () => {
  it('extracts text and pages from buffer', async () => {
    const getText = jest.fn().mockResolvedValue({
      text: 'Sample PDF text',
      total: 2
    });
    const getInfo = jest.fn().mockResolvedValue({
      info: { Producer: 'jest' }
    });
    const destroy = jest.fn().mockResolvedValue(undefined);

    const parseClassMock = PDFParse as unknown as jest.Mock;
    parseClassMock.mockImplementation(() => ({
      getText,
      getInfo,
      destroy
    }));

    const tool = new PdfTool();
    const result = await tool.extractFromBuffer(Buffer.from('pdf-bytes'));

    expect(parseClassMock).toHaveBeenCalledTimes(1);
    expect(result.text).toBe('Sample PDF text');
    expect(result.pages).toBe(2);
    expect(destroy).toHaveBeenCalledTimes(1);
  });
});
