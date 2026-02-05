const fs = require('fs');
const path = require('path');
const { Document, Packer, Paragraph, HeadingLevel, TextRun, Table, TableRow, TableCell, WidthType } = require('docx');

// List of markdown files to convert
const markdownFiles = [
  'INSTALLATION_GUIDE.md',
  'PRODUCT_INVENTORY.md',
  'ROOM_SPEAKER_SETUP.md',
  'MULTI_DISPLAY_SETUP.md',
  'HARDWARE_SETUP.md',
  'GPIO_PIN_REFERENCE.md',
  'LIGHT_CONTROLLER_INTEGRATION.md'
];

// Simple markdown parser
function parseMarkdown(markdown) {
  const lines = markdown.split('\n');
  const elements = [];
  let inCodeBlock = false;
  let codeBlockLanguage = '';
  let codeBlockContent = [];
  let inList = false;
  let listItems = [];

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    const trimmed = line.trim();

    // Code blocks
    if (trimmed.startsWith('```')) {
      if (inCodeBlock) {
        // End code block
        elements.push({
          type: 'code',
          language: codeBlockLanguage,
          content: codeBlockContent.join('\n')
        });
        codeBlockContent = [];
        inCodeBlock = false;
      } else {
        // Start code block
        inCodeBlock = true;
        codeBlockLanguage = trimmed.substring(3).trim();
      }
      continue;
    }

    if (inCodeBlock) {
      codeBlockContent.push(line);
      continue;
    }

    // Headers
    if (trimmed.startsWith('# ')) {
      if (inList) {
        elements.push({ type: 'list', items: listItems });
        listItems = [];
        inList = false;
      }
      elements.push({ type: 'h1', text: trimmed.substring(2).trim() });
      continue;
    }
    if (trimmed.startsWith('## ')) {
      if (inList) {
        elements.push({ type: 'list', items: listItems });
        listItems = [];
        inList = false;
      }
      elements.push({ type: 'h2', text: trimmed.substring(3).trim() });
      continue;
    }
    if (trimmed.startsWith('### ')) {
      if (inList) {
        elements.push({ type: 'list', items: listItems });
        listItems = [];
        inList = false;
      }
      elements.push({ type: 'h3', text: trimmed.substring(4).trim() });
      continue;
    }
    if (trimmed.startsWith('#### ')) {
      if (inList) {
        elements.push({ type: 'list', items: listItems });
        listItems = [];
        inList = false;
      }
      elements.push({ type: 'h4', text: trimmed.substring(5).trim() });
      continue;
    }

    // Horizontal rules
    if (trimmed === '---' || trimmed === '***') {
      if (inList) {
        elements.push({ type: 'list', items: listItems });
        listItems = [];
        inList = false;
      }
      elements.push({ type: 'hr' });
      continue;
    }

    // Lists
    if (trimmed.startsWith('- ') || trimmed.startsWith('* ') || trimmed.startsWith('+ ')) {
      if (!inList) {
        inList = true;
      }
      listItems.push(trimmed.substring(2).trim());
      continue;
    }

    // Checkboxes
    if (trimmed.startsWith('- [ ]') || trimmed.startsWith('- [x]')) {
      if (!inList) {
        inList = true;
      }
      const checked = trimmed.startsWith('- [x]');
      const text = trimmed.substring(5).trim();
      listItems.push({ type: 'checkbox', checked, text });
      continue;
    }

    // Regular paragraphs
    if (trimmed.length > 0) {
      if (inList) {
        elements.push({ type: 'list', items: listItems });
        listItems = [];
        inList = false;
      }
      elements.push({ type: 'paragraph', text: line });
      continue;
    }

    // Empty lines
    if (trimmed.length === 0) {
      if (inList && listItems.length > 0) {
        elements.push({ type: 'list', items: listItems });
        listItems = [];
        inList = false;
      }
      elements.push({ type: 'break' });
      continue;
    }
  }

  if (inList && listItems.length > 0) {
    elements.push({ type: 'list', items: listItems });
  }

  return elements;
}

// Convert markdown elements to docx elements
function createDocxElements(elements) {
  const docxElements = [];

  for (const element of elements) {
    switch (element.type) {
      case 'h1':
        docxElements.push(
          new Paragraph({
            text: element.text,
            heading: HeadingLevel.HEADING_1,
            spacing: { after: 200 }
          })
        );
        break;

      case 'h2':
        docxElements.push(
          new Paragraph({
            text: element.text,
            heading: HeadingLevel.HEADING_2,
            spacing: { after: 150 }
          })
        );
        break;

      case 'h3':
        docxElements.push(
          new Paragraph({
            text: element.text,
            heading: HeadingLevel.HEADING_3,
            spacing: { after: 100 }
          })
        );
        break;

      case 'h4':
        docxElements.push(
          new Paragraph({
            text: element.text,
            heading: HeadingLevel.HEADING_4,
            spacing: { after: 80 }
          })
        );
        break;

      case 'paragraph':
        // Parse inline formatting (bold, italic, code)
        const runs = parseInlineFormatting(element.text);
        docxElements.push(
          new Paragraph({
            children: runs,
            spacing: { after: 100 }
          })
        );
        break;

      case 'code':
        docxElements.push(
          new Paragraph({
            children: [
              new TextRun({
                text: element.content,
                font: 'Courier New',
                size: 20
              })
            ],
            spacing: { after: 100 },
            shading: { fill: 'F5F5F5' }
          })
        );
        break;

      case 'list':
        for (const item of element.items) {
          if (typeof item === 'object' && item.type === 'checkbox') {
            const checkboxText = item.checked ? '☑' : '☐';
            docxElements.push(
              new Paragraph({
                children: [
                  new TextRun({
                    text: `${checkboxText} ${item.text}`,
                    bold: false
                  })
                ],
                spacing: { after: 50 },
                bullet: { level: 0 }
              })
            );
          } else {
            docxElements.push(
              new Paragraph({
                text: item,
                spacing: { after: 50 },
                bullet: { level: 0 }
              })
            );
          }
        }
        break;

      case 'hr':
        docxElements.push(
          new Paragraph({
            text: '─────────────────────────────────────────────────────────',
            spacing: { after: 200, before: 200 }
          })
        );
        break;

      case 'break':
        docxElements.push(
          new Paragraph({
            text: '',
            spacing: { after: 50 }
          })
        );
        break;
    }
  }

  return docxElements;
}

// Parse inline formatting (bold, italic, code)
function parseInlineFormatting(text) {
  const runs = [];
  let currentIndex = 0;
  let inBold = false;
  let inItalic = false;
  let inCode = false;
  let buffer = '';

  while (currentIndex < text.length) {
    const char = text[currentIndex];
    const nextChar = text[currentIndex + 1];

    // Bold (**text**)
    if (char === '*' && nextChar === '*' && !inCode) {
      if (buffer.length > 0) {
        runs.push(new TextRun({
          text: buffer,
          bold: inBold,
          italics: inItalic
        }));
        buffer = '';
      }
      inBold = !inBold;
      currentIndex += 2;
      continue;
    }

    // Italic (*text*)
    if (char === '*' && nextChar !== '*' && !inCode) {
      if (buffer.length > 0) {
        runs.push(new TextRun({
          text: buffer,
          bold: inBold,
          italics: inItalic
        }));
        buffer = '';
      }
      inItalic = !inItalic;
      currentIndex++;
      continue;
    }

    // Code (`text`)
    if (char === '`' && !inCode) {
      if (buffer.length > 0) {
        runs.push(new TextRun({
          text: buffer,
          bold: inBold,
          italics: inItalic
        }));
        buffer = '';
      }
      inCode = !inCode;
      currentIndex++;
      continue;
    }

    buffer += char;
    currentIndex++;
  }

  if (buffer.length > 0) {
    runs.push(new TextRun({
      text: buffer,
      bold: inBold,
      italics: inItalic,
      font: inCode ? 'Courier New' : undefined
    }));
  }

  return runs.length > 0 ? runs : [new TextRun({ text: text })];
}

// Convert a markdown file to Word document
async function convertToWord(markdownFile) {
  try {
    console.log(`Converting ${markdownFile}...`);
    
    const markdownContent = fs.readFileSync(markdownFile, 'utf8');
    const elements = parseMarkdown(markdownContent);
    const docxElements = createDocxElements(elements);

    const doc = new Document({
      sections: [{
        properties: {},
        children: docxElements
      }]
    });

    const outputFile = markdownFile.replace('.md', '.docx');
    const buffer = await Packer.toBuffer(doc);
    fs.writeFileSync(outputFile, buffer);
    
    console.log(`✓ Created ${outputFile}`);
  } catch (error) {
    console.error(`Error converting ${markdownFile}:`, error.message);
  }
}

// Main function
async function main() {
  console.log('Installing docx library...');
  // Check if docx is installed
  try {
    require.resolve('docx');
  } catch (e) {
    console.log('Please install docx: npm install docx');
    process.exit(1);
  }

  console.log('Converting markdown files to Word documents...\n');

  for (const file of markdownFiles) {
    if (fs.existsSync(file)) {
      await convertToWord(file);
    } else {
      console.log(`⚠ File not found: ${file}`);
    }
  }

  console.log('\n✓ Conversion complete!');
}

main().catch(console.error);
